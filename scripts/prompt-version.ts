// Prompt fingerprint (#50): a short hash of the General's fixed prompt text plus its tool schema. Small wording
// changes move Gate 2 results a lot (one tool description moved it 60 points, #37), so `llm-match --out` stamps
// this next to the game + data version, and two result files are only comparable when it matches.
// Node only (node:crypto); the browser never needs it.
import { createHash } from 'node:crypto';
import { systemPrompt } from '../src/ai/llm/prompt.ts';
import { turnSchema } from '../src/ai/llm/tools.ts';
import { voxtaTools } from '../src/ai/llm/voxta-brain.ts';
import type { Faction } from '../src/sim/index.ts';

/**
 * Everything fixed that the General is sent: the system prompt plus the tools it may call.
 * `json`: the turn schema (Ollama, OpenAI-compatible). `tools`: Voxta's native tools; the character card is not included.
 */
export function promptText(faction: Faction, mode: 'json' | 'tools' = 'json'): string {
  const tools = mode === 'json' ? turnSchema(faction) : voxtaTools(faction);
  return `${systemPrompt(faction, mode)}\n${JSON.stringify(tools)}`;
}

/** The first 8 hex characters of the SHA-256 of `text`. */
export function promptVersion(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 8);
}

export function generalPromptVersion(faction: Faction, mode: 'json' | 'tools' = 'json'): string {
  return promptVersion(promptText(faction, mode));
}
