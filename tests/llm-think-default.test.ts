import { describe, expect, it } from 'vitest';
import { ollamaThink } from '../scripts/llm-provider.ts';

// Headless runs let qwen3 reason before every answer unless told not to: turns took 10-30 s and most
// missed the 10 s limit. The browser game never thinks, so the scripts now match it unless --think is given.
describe('headless Ollama thinking', () => {
  it('is off by default, like the browser game', () => {
    expect(ollamaThink({})).toBe(false);
  });

  it('is on only with --think', () => {
    expect(ollamaThink({ think: true })).toBe(true);
  });

  it('stays off with the old --no-think flag', () => {
    expect(ollamaThink({ 'no-think': true })).toBe(false);
    expect(ollamaThink({ think: true, 'no-think': true })).toBe(false);
  });
});
