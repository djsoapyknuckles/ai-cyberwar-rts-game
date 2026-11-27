import { describe, expect, it } from 'vitest';
import { REPLY_SCHEMA, replySystemPrompt } from '../src/ai/llm/reply.ts';
import { generalPromptVersion, promptVersion, replyPromptText, replyPromptVersion } from '../scripts/prompt-version.ts';

describe('reply prompt fingerprint (#97)', () => {
  it('is 8 hex characters, stable, and covers the reply prompt plus its schema', () => {
    expect(replyPromptVersion()).toMatch(/^[0-9a-f]{8}$/);
    expect(replyPromptVersion()).toBe(replyPromptVersion());
    const text = replyPromptText();
    expect(text).toContain(replySystemPrompt('ai'));
    expect(text).toContain(JSON.stringify(REPLY_SCHEMA));
    expect(promptVersion(text)).toBe(replyPromptVersion());
  });

  it('changes when one word of the reply prompt changes', () => {
    const text = replyPromptText();
    const word = replySystemPrompt('ai').match(/[A-Za-z]{5,}/)![0];
    expect(promptVersion(text.replace(word, `${word}x`))).not.toBe(replyPromptVersion());
  });

  it('differs from the General fingerprint', () => {
    expect(replyPromptVersion()).not.toBe(generalPromptVersion('ai'));
  });
});
