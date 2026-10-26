import { describe, expect, it } from 'vitest';
import { createVoxtaChat, type SocketLike } from '../src/ai/llm/voxta-chat.ts';

// M2.7 (#57): the Voxta realtime chat client, against a scripted fake server (no network).
const RS = '\x1e';
type Msg = { $type: string; [k: string]: unknown };

/** A fake Voxta hub: answers the handshake and messages the way the spike saw the real server do. */
function fakeVoxta(script: { greeting?: boolean; reply?: 'normal' | 'silent' | 'error' | 'close' } = {}) {
  const sent: Msg[] = [];
  let url = '';
  const listeners: Record<string, ((e: { data?: unknown; code?: number }) => void)[]> = {};
  const emit = (type: string, e: { data?: unknown; code?: number } = {}) => setTimeout(() => listeners[type]?.forEach((l) => l(e)), 0);
  const push = (...msgs: Msg[]) => emit('message', { data: msgs.map((m) => JSON.stringify({ type: 1, target: 'ReceiveMessage', arguments: [m] }) + RS).join('') });
  const reply = (id: string, text: string, extra: Msg[] = []) => push(
    { $type: 'replyStart', messageId: id }, ...extra,
    { $type: 'replyChunk', messageId: id, text, audioUrl: `/api/tts/${id}.mp3` }, { $type: 'replyEnd', messageId: id },
  );
  const socket: SocketLike = {
    addEventListener: (type, l) => { (listeners[type] ??= []).push(l); },
    close: () => emit('close', { code: 1000 }),
    send(data) {
      const frame = JSON.parse(String(data).replace(RS, '')) as { protocol?: string; arguments?: Msg[] };
      if (frame.protocol) { emit('message', { data: `{}${RS}` }); return; }
      const msg = frame.arguments![0]!;
      sent.push(msg);
      if (msg.$type === 'authenticate') push({ $type: 'welcome', user: { name: 'DJ' } });
      if (msg.$type === 'loadCharactersList') push({ $type: 'charactersListLoaded', characters: [{ id: 'c1', name: 'The Model' }, { id: 'c2', name: 'Other' }] });
      if (msg.$type === 'startChat') {
        push({ $type: 'chatStarted', sessionId: 's1', chatStyle: 'Roleplay' });
        if (script.greeting !== false) reply('g1', 'So, a human wants to play.');
      }
      if (msg.$type === 'send') {
        if (script.reply === 'silent') return;
        if (script.reply === 'error') { push({ $type: 'chatSessionError', message: 'model unavailable' }); return; }
        if (script.reply === 'close') { emit('close', { code: 1006 }); return; }
        reply('r1', 'Your center is mine.', [
          { $type: 'toolCallRequest', requestId: 'q1', name: 'attack_sector', arguments: '{"sector":"C"}' },
          { $type: 'replyToolCall', toolCallId: 't1', name: 'attack_sector' },
          { $type: 'toolCallRequest', requestId: 'q2', name: 'set_army_mix', arguments: 'not json' },
        ]);
      }
    },
  };
  return { sent, factory: (u: string) => { url = u; emit('open'); return socket; }, url: () => url };
}

const tools = [{ name: 'attack_sector', description: 'Attack.', arguments: [{ name: 'sector', type: 'String' as const, description: 'Sector.', required: true, choices: ['C', 'W'] }] }];

describe('Voxta chat client', () => {
  it('connects with the key in the hub URL, lists characters, and starts a chat with tools and rules', async () => {
    const v = fakeVoxta();
    const chat = createVoxtaChat({ apiKey: 'k&y', socket: v.factory, greetingWaitMs: 500 });
    expect(await chat.characters()).toEqual([{ id: 'c1', name: 'The Model' }, { id: 'c2', name: 'Other' }]);
    expect(v.url()).toBe('ws://localhost:5384/hub?access_token=k%26y');
    await chat.start({ characterId: 'c1', tools, context: 'RULES' });
    const start = v.sent.find((m) => m.$type === 'startChat')!;
    expect(start).toMatchObject({ characterId: 'c1', ephemeral: true, contexts: [{ text: 'RULES' }] });
    expect((start.tools as Msg[])[0]).toMatchObject({ name: 'attack_sector', permission: 'InChat', display: 'Hidden' });
    expect(v.sent.find((m) => m.$type === 'authenticate')).toMatchObject({ client: 'AiCyberwar', scope: ['role:app'] });
    chat.close();
  });

  it('reports the greeting played, then returns a turn: tool calls answered once each, text, audio', async () => {
    const v = fakeVoxta();
    const played: string[] = [];
    const chat = createVoxtaChat({ apiKey: 'k', socket: v.factory, greetingWaitMs: 500, playback: async (r) => { played.push(r.messageId); } });
    await chat.start({ characterId: 'c1', tools, context: '' });
    const turn = await chat.turn('GAME TURN 1');
    expect(turn.calls).toEqual([{ name: 'attack_sector', args: { sector: 'C' } }, { name: 'set_army_mix', args: {} }]);
    expect(turn).toMatchObject({ messageId: 'r1', text: 'Your center is mine.', audioUrls: ['/api/tts/r1.mp3'] });
    await new Promise((r) => setTimeout(r, 10));
    const results = v.sent.filter((m) => m.$type === 'toolCallResult');
    expect(results.map((m) => m.requestId)).toEqual(['q1', 'q2']);
    expect(results.every((m) => m.sessionId === 's1' && m.isError === false)).toBe(true);
    expect(played).toEqual(['g1', 'r1']);
    expect(v.sent.filter((m) => m.$type === 'speechPlaybackComplete').map((m) => m.messageId)).toEqual(['g1', 'r1']);
    expect(v.sent.find((m) => m.$type === 'send')).toMatchObject({ sessionId: 's1', text: 'GAME TURN 1', doReply: true });
    chat.close();
  });

  it('starts without waiting forever when the character has no greeting', async () => {
    const chat = createVoxtaChat({ apiKey: 'k', socket: fakeVoxta({ greeting: false }).factory, greetingWaitMs: 30 });
    await chat.start({ characterId: 'c1', tools, context: '' });
    chat.close();
  });

  it.each([
    ['silent', 'no reply in time'],
    ['error', 'chatSessionError: model unavailable'],
    ['close', 'connection closed (1006)'],
  ] as const)('a %s server fails the turn instead of hanging', async (reply, message) => {
    const chat = createVoxtaChat({ apiKey: 'k', socket: fakeVoxta({ reply }).factory, greetingWaitMs: 50 });
    await chat.start({ characterId: 'c1', tools, context: '' });
    await expect(chat.turn('GAME TURN', 100)).rejects.toThrow(message);
    chat.close();
  });

  it('refuses a turn before a chat is started', async () => {
    await expect(createVoxtaChat({ apiKey: 'k', socket: fakeVoxta().factory }).turn('x')).rejects.toThrow('no chat started');
  });
});
