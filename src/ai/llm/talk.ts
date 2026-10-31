// Player chat with the General (proposal 0007, D-027). The player's messages go only to the reply call; this
// module never sees the command brain, the digest or the directive, and nothing here returns commands.
// The General hands it its own chat lines (so replies don't repeat them) and whether a command call is out
// (the command call goes first, so chat never makes an order late).
import { TICK_RATE, type FactionView } from '../../sim/index.ts';
import { cleanPlayerMessage, REPLY_HISTORY, type ReplyBrain } from './reply.ts';

/** At most one player message per 10 s of match time. */
export const PLAYER_MESSAGE_GAP = 10 * TICK_RATE;
/** A message still waiting for a free moment after 10 s is dropped. */
export const REPLY_WAIT_MAX = 10 * TICK_RATE;

/** Why a message was or wasn't sent. */
export type HearResult = 'sent' | 'off' | 'empty' | 'too-soon' | 'busy' | 'quiet';

export interface TalkEntry {
  tick: number;
  from: 'player' | 'general';
  /** The cleaned message or the reply; null when the General didn't answer. */
  text: string | null;
  /** Why there was no answer. */
  error?: string;
}

export interface Talk {
  readonly log: TalkEntry[];
  hear(text: string, tick: number): HearResult;
  /** One of the General's own lines (a taunt), so the reply call can avoid repeating it. */
  spoke(line: string): void;
  /** Called on each decision: starts a reply when the command call isn't out, and logs replies that came back. */
  pump(view: FactionView, commandOut: boolean): void;
}

const clock = (tick: number) => {
  const s = Math.floor(tick / TICK_RATE);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function createTalk(reply: ReplyBrain | undefined, cap = Infinity): Talk {
  const log: TalkEntry[] = [];
  let lastHeard = -Infinity;
  let requests = 0;
  /** The player's message waiting for a reply call to start. */
  let queued: number | null = null;
  /** A reply call that is out; `done` once it settled. */
  let out: { done: boolean; text: string | null; error?: string } | null = null;
  let theySaid: string[] = [];
  /** The General's own lines, taunts and replies, oldest first. */
  let own: string[] = [];

  return {
    log,
    hear(text, tick) {
      if (!reply) return 'off';
      if (requests >= cap) return 'quiet';
      const clean = cleanPlayerMessage(text);
      if (!clean) return 'empty';
      if (tick - lastHeard < PLAYER_MESSAGE_GAP) return 'too-soon';
      if (queued !== null || out) return 'busy';
      lastHeard = tick;
      queued = tick;
      theySaid = [...theySaid, clean].slice(-REPLY_HISTORY);
      log.push({ tick, from: 'player', text: clean });
      return 'sent';
    },
    spoke(line) {
      own = [...own, line].slice(-REPLY_HISTORY);
    },
    pump(view, commandOut) {
      if (out?.done) {
        const entry: TalkEntry = { tick: view.tick, from: 'general', text: out.text };
        if (out.error) entry.error = out.error;
        log.push(entry);
        if (out.text) own = [...own, out.text].slice(-REPLY_HISTORY);
        out = null;
      }
      if (queued === null || !reply) return;
      if (view.tick - queued >= REPLY_WAIT_MAX) {
        log.push({ tick: view.tick, from: 'general', text: null, error: 'no reply: the General was busy' });
        queued = null;
        return;
      }
      if (commandOut || out || requests >= cap) return;
      queued = null;
      requests++;
      const call = { done: false, text: null as string | null } as { done: boolean; text: string | null; error?: string };
      out = call;
      const input = { clock: clock(view.tick), youSaid: [...own], theySaid: [...theySaid] };
      Promise.resolve().then(() => reply(input)).then(
        (text) => { call.text = text; },
        (e) => { call.error = String(e); },
      ).finally(() => { call.done = true; });
    },
  };
}
