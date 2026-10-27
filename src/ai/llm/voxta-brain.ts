// A Voxta character as the General (M2.7, D-023, issue #58): a Brain whose turns go through a Voxta chat.
// The character answers each game turn with native tool calls and a spoken line. The calls become an
// ordinary JSON turn, so the same validator, planner, APM cap, reaction delay and scripted fallback apply
// as for every General; the line becomes the turn's taunt (filtered like any chat).
import type { Faction } from '../../sim/index.ts';
import { TICK_RATE } from '../../sim/index.ts';
import type { Brain } from './general.ts';
import { systemPrompt, userPrompt } from './prompt.ts';
import { MAX_ORDERS_PER_TURN, MAX_TAUNT_LENGTH, toolSpecs } from './tools.ts';
import type { VoxtaChat, VoxtaTool, VoxtaTurn } from './voxta-chat.ts';

/** The game's tools in Voxta's flat format. No taunt (the spoken line is the taunt) and no wait (no call is a wait). */
export function voxtaTools(faction: Faction): VoxtaTool[] {
  return toolSpecs(faction).filter((t) => t.name !== 'taunt' && t.name !== 'wait').map((t) => ({
    name: t.name,
    description: t.description,
    arguments: Object.entries(t.params).map(([name, p]) =>
      p.kind === 'enum' ? { name, type: 'String' as const, description: p.description, required: true, choices: [...p.values] }
      : p.kind === 'int' ? { name, type: 'Integer' as const, description: `${p.description} (${p.min}-${p.max})`, required: true }
      : { name, type: 'String' as const, description: p.description, required: true }),
  }));
}

/** A reply as an ordinary turn: tool calls as orders, the spoken line as a taunt (clipped to the taunt limit). */
export function turnFromReply(reply: VoxtaTurn): string {
  // Backends without native tool calling may send numbers as strings; the validator wants integers.
  const args = (a: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(a).map(([k, v]) => [k, typeof v === 'string' && /^-?\d+$/.test(v) ? Number(v) : v]));
  const line = reply.text.replace(/\s+/g, ' ').trim();
  // The line keeps one of the turn's order slots, so a character that over-orders still talks.
  const orders: { tool: string; args: Record<string, unknown> }[] = reply.calls.slice(0, MAX_ORDERS_PER_TURN - (line ? 1 : 0))
    .map((c) => ({ tool: c.name, args: args(c.args) }));
  if (line) {
    const clipped = line.length > MAX_TAUNT_LENGTH ? `${line.slice(0, MAX_TAUNT_LENGTH - 1)}…` : line;
    orders.push({ tool: 'taunt', args: { message: clipped } });
  }
  return JSON.stringify({ orders });
}

/**
 * How long a character's turn may take: 18 s, inside the 20 s turn interval. Voxta asks the model twice per
 * turn (once for the tool calls, again after their results for the spoken line), so the 10 s LLM default is
 * too short. Fun mode (D-023): a slow turn still costs the General its reaction time, as for any brain.
 */
export const VOXTA_TURN_MS = 18_000;
/** The same budget in ticks, for the General's `timeout`. */
export const VOXTA_TURN_TIMEOUT = (VOXTA_TURN_MS / 1000) * TICK_RATE;

export interface VoxtaBrainOptions {
  chat: VoxtaChat;
  characterId: string;
  faction: Faction;
  /** How long a turn may take; the General's own timeout still decides late turns. Default VOXTA_TURN_MS. */
  timeoutMs?: number;
  /** Each reply as it arrives (the browser plays its audio). */
  onReply?: (reply: VoxtaTurn) => void;
}

/** A Brain backed by a Voxta chat, plus `close()` to end the chat after the match. */
export function createVoxtaBrain(opts: VoxtaBrainOptions): Brain & { close(): void } {
  let started: Promise<void> | null = null;
  let busy = false;
  const brain = async ({ digest, youSaid }: Parameters<Brain>[0]): Promise<string | null> => {
    // One turn at a time: a turn asked while one is out counts as late.
    if (busy) return null;
    busy = true;
    try {
      // A reply that timed out takes a moment to be stopped; wait for that rather than give up the turn,
      // or a headless match would race through every late turn in an instant. The wait counts as latency.
      const budget = opts.timeoutMs ?? VOXTA_TURN_MS;
      const asked = Date.now();
      while (opts.chat.busy && Date.now() - asked < budget) await new Promise((r) => setTimeout(r, 100));
      if (opts.chat.busy) return null;
      started ??= opts.chat.start({ characterId: opts.characterId, tools: voxtaTools(opts.faction), context: systemPrompt(opts.faction, 'tools') })
        // A chat that failed to start is tried again next turn; this turn falls back.
        .catch((e: unknown) => { started = null; throw e; });
      await started;
      const reply = await opts.chat.turn(`GAME TURN. ${userPrompt(digest, youSaid ?? [])}`, opts.timeoutMs ?? VOXTA_TURN_MS);
      opts.onReply?.(reply);
      return turnFromReply(reply);
    } finally {
      busy = false;
    }
  };
  return Object.assign(brain, { close: () => opts.chat.close() });
}
