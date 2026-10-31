import { describe, expect, it } from 'vitest';
import { REPLY_CAP_CLOUD, replyCapFor, talkRecords } from '../src/ai/llm/talk.ts';
import { hearNotice, isTypingTarget } from '../src/render/chat.ts';

// Proposal 0007 / D-027 step 4: the chat box in the panel.
describe('chat box notices', () => {
  it('say nothing when a message is sent, and why when it is not', () => {
    expect(hearNotice('sent', 'The Model')).toBeNull();
    expect(hearNotice('too-soon', 'The Model')).toMatch(/wait/i);
    expect(hearNotice('busy', 'The Model')).toMatch(/typing/i);
    expect(hearNotice('quiet', 'The Model')).toBe('The Model has stopped answering.');
    expect(hearNotice('empty', 'The Model')).toMatch(/not sent/i);
    expect(hearNotice('off', 'The Model')).toMatch(/isn't listening/i);
  });
});

describe('typing in the chat box', () => {
  it('is not read as game hotkeys', () => {
    expect(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'CANVAS' } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('reply cap', () => {
  it('is 20 replies for a paid model and none for a local one', () => {
    expect(REPLY_CAP_CLOUD).toBe(20);
    expect(replyCapFor(true)).toBe(Infinity);
    expect(replyCapFor(false)).toBe(REPLY_CAP_CLOUD);
  });
});

describe('talk in replays', () => {
  it('keeps who said what and when, and why the General did not answer', () => {
    expect(talkRecords([
      { tick: 100, from: 'player', text: 'hello' },
      { tick: 120, from: 'general', text: 'Noted.' },
      { tick: 400, from: 'player', text: 'well?' },
      { tick: 420, from: 'general', text: null, error: 'Error: offline' },
    ])).toEqual([
      { tick: 100, from: 'player', text: 'hello' },
      { tick: 120, from: 'general', text: 'Noted.' },
      { tick: 400, from: 'player', text: 'well?' },
      { tick: 420, from: 'general', text: null, error: 'Error: offline' },
    ]);
  });
});
