import { describe, expect, it } from 'vitest';
import { createVoxtaBrain, turnFromReply, voxtaTools } from '../src/ai/llm/voxta-brain.ts';
import { MAX_ORDERS_PER_TURN, parseTurn } from '../src/ai/llm/tools.ts';
import { systemPrompt } from '../src/ai/llm/prompt.ts';
import type { VoxtaChat, VoxtaTurn } from '../src/ai/llm/voxta-chat.ts';

// M2.7 (#58): a Voxta character as the General. Tool calls + spoken line become an ordinary JSON turn.
const reply = (calls: VoxtaTurn['calls'], text = ''): VoxtaTurn => ({ messageId: 'r', text, audioUrls: [], calls });

function fakeChat(replies: (VoxtaTurn | Error)[], delayMs = 0) {
  const sent: string[] = [];
  const starts: Parameters<VoxtaChat['start']>[0][] = [];
  let closed = false;
  const chat: VoxtaChat = {
    characters: async () => [{ id: 'c1', name: 'The Model' }],
    start: async (o) => { starts.push(o); },
    turn: async (text) => {
      sent.push(text);
      await new Promise((r) => setTimeout(r, delayMs));
      const r = replies.shift()!;
      if (r instanceof Error) throw r;
      return r;
    },
    busy: false,
    close: () => { closed = true; },
  };
  return { chat, sent, starts, closed: () => closed };
}

const digest = { tick: 0 } as never;

describe('Voxta character brain', () => {
  it('declares the game tools in Voxta form, without taunt or wait', () => {
    const names = voxtaTools('ai').map((t) => t.name);
    expect(names).not.toContain('taunt');
    expect(names).not.toContain('wait');
    const attack = voxtaTools('ai').find((t) => t.name === 'attack_sector')!;
    expect(attack.arguments[0]).toMatchObject({ type: 'String', required: true });
    expect(attack.arguments[0]!.choices).toContain('C');
  });

  it('turns tool calls and the spoken line into a turn the validator accepts', () => {
    const json = turnFromReply(reply([{ name: 'attack_sector', args: { sector: 'C' } }], '  Your center\nis mine. '));
    expect(JSON.parse(json)).toEqual({ orders: [
      { tool: 'attack_sector', args: { sector: 'C' } },
      { tool: 'taunt', args: { message: 'Your center is mine.' } },
    ] });
    expect(parseTurn('ai', json).errors).toEqual([]);
  });

  it('turns digit strings into integers and clips a long line', () => {
    const json = JSON.parse(turnFromReply(reply([{ name: 'x', args: { n: '3', s: 'C' } }], 'a'.repeat(500))));
    expect(json.orders[0].args).toEqual({ n: 3, s: 'C' });
    expect(json.orders[1].args.message.length).toBeLessThanOrEqual(140);
  });

  it('keeps an order slot for the line when the character over-orders', () => {
    const calls = Array.from({ length: 7 }, () => ({ name: 'expand', args: {} }));
    const orders = JSON.parse(turnFromReply(reply(calls, 'Mine.'))).orders as { tool: string }[];
    expect(orders).toHaveLength(MAX_ORDERS_PER_TURN);
    expect(orders.at(-1)!.tool).toBe('taunt');
  });

  it('no calls and no line is an empty turn (a wait)', () => {
    expect(JSON.parse(turnFromReply(reply([])))).toEqual({ orders: [] });
  });

  it('starts one chat with tool-mode rules, sends each digest, and closes', async () => {
    const f = fakeChat([reply([{ name: 'attack_sector', args: { sector: 'C' } }]), reply([], 'Still here.')]);
    const seen: VoxtaTurn[] = [];
    const brain = createVoxtaBrain({ chat: f.chat, characterId: 'c1', faction: 'ai', onReply: (r) => seen.push(r) });
    await brain({ tick: 0, digest });
    await brain({ tick: 1, digest, youSaid: ['Hi.'] });
    expect(f.starts).toHaveLength(1);
    expect(f.starts[0]).toMatchObject({ characterId: 'c1', context: systemPrompt('ai', 'tools') });
    expect(f.sent[0]!.startsWith('GAME TURN. ')).toBe(true);
    expect(f.sent[1]).toContain('"you_said":["Hi."]');
    expect(seen).toHaveLength(2);
    brain.close();
    expect(f.closed()).toBe(true);
  });

  it('a turn asked while the chat is still finishing a timed-out reply is late, and sends nothing', async () => {
    const f = fakeChat([reply([])]);
    const brain = createVoxtaBrain({ chat: { ...f.chat, busy: true }, characterId: 'c1', faction: 'ai' });
    expect(await brain({ tick: 0, digest })).toBeNull();
    expect(f.sent).toHaveLength(0);
  });

  it('a turn asked while one is out is late (null); a failed turn throws for the fallback', async () => {
    const f = fakeChat([reply([]), new Error('voxta: no reply in time')], 20);
    const brain = createVoxtaBrain({ chat: f.chat, characterId: 'c1', faction: 'ai' });
    const first = brain({ tick: 0, digest });
    expect(await brain({ tick: 1, digest })).toBeNull();
    await first;
    await expect(Promise.resolve(brain({ tick: 2, digest }))).rejects.toThrow('no reply in time');
  });
});

describe('tool-mode system prompt', () => {
  it('drops the JSON reply rule and asks for tool calls and a spoken line', () => {
    const p = systemPrompt('ai', 'tools');
    expect(p).not.toContain('Reply with JSON only');
    expect(p).toContain('calling your tools');
    expect(systemPrompt('ai')).toContain('Reply with JSON only');
  });
});
