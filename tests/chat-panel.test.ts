import { describe, expect, it } from 'vitest';
import { FRESH_MS, chatMode } from '../src/render/chat.ts';

// The General's taunts must not cover the map: a new line shows briefly, then the panel folds to a chip.
describe('chat panel mode', () => {
  it('stays folded before any message', () => {
    expect(chatMode(null, 5000, false)).toBe('folded');
  });

  it('shows a new message while fresh, then folds', () => {
    expect(chatMode(1000, 1000, false)).toBe('fresh');
    expect(chatMode(1000, 1000 + FRESH_MS - 1, false)).toBe('fresh');
    expect(chatMode(1000, 1000 + FRESH_MS, false)).toBe('folded');
  });

  it('stays open while the player has it open', () => {
    expect(chatMode(null, 0, true)).toBe('open');
    expect(chatMode(1000, 1000 + FRESH_MS * 10, true)).toBe('open');
  });
});
