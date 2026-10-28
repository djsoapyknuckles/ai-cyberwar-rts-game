import { describe, expect, it } from 'vitest';
import { failureHint } from '../scripts/llm-provider.ts';

// llm-turn printed "Is Ollama running?" after any failed request, even from a cloud provider.
describe('llm-turn failure hint', () => {
  it('points at Ollama only for the Ollama provider', () => {
    expect(failureHint({ provider: 'ollama', url: 'http://localhost:11434' })).toContain('ollama pull qwen3:8b');
    expect(failureHint({ provider: 'ollama', url: 'http://localhost:11434', model: 'm' })).toContain('ollama pull m');
  });

  it('names the key variable for a cloud provider, never Ollama', () => {
    const hint = failureHint({ provider: 'openrouter', url: 'http://localhost:11434' });
    expect(hint).toContain('OPENROUTER_API_KEY');
    expect(hint).not.toMatch(/ollama/i);
    expect(failureHint({ provider: 'openai', url: '' })).toContain('OPENAI_API_KEY');
    expect(failureHint({ provider: 'voxta', url: '' })).not.toMatch(/ollama/i);
  });
});
