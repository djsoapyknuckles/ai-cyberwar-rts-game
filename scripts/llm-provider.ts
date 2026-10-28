// Picks the LLM client for the headless scripts (llm-turn, llm-match). D-020: `--provider openai` uses an
// OpenAI-compatible API; the key comes only from OPENAI_API_KEY (a local .env or the shell), never from args.
// `--provider openrouter` (D-025) uses OpenRouter: OPENROUTER_API_KEY, its default model unless --model is given.
// `--provider voxta` (D-022) uses a local Voxta server: VOXTA_API_KEY, optional VOXTA_URL (default http://localhost:5384/v1).
import { createOllamaClient, type LlmClient } from '../src/ai/llm/client.ts';
import { createOpenAiClient } from '../src/ai/llm/openai.ts';
import { CLOUD_PROVIDERS } from '../src/ai/llm/providers.ts';
import { createVoxtaClient } from '../src/ai/llm/voxta.ts';

/** Ollama's default model; a cloud provider uses its own default unless --model is given. */
export const LOCAL_MODEL = 'qwen3:8b';

export function clientFromArgs(v: { provider?: string; model?: string; url: string; 'no-think'?: boolean }): LlmClient {
  // D-022: a local Voxta server; its key (inference scope) comes only from VOXTA_API_KEY.
  if (v.provider === 'voxta') {
    const baseUrl = process.env.VOXTA_URL;
    return createVoxtaClient({ apiKey: process.env.VOXTA_API_KEY ?? '', ...(baseUrl ? { baseUrl } : {}) });
  }
  if (v.provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('--provider openai needs OPENAI_API_KEY in the environment (for example in a local .env, which git ignores).');
      process.exit(2);
    }
    const baseUrl = process.env.OPENAI_BASE_URL;
    return createOpenAiClient({ model: v.model ?? LOCAL_MODEL, apiKey, ...(baseUrl ? { baseUrl } : {}) });
  }
  if (v.provider === 'openrouter') {
    const p = CLOUD_PROVIDERS.openrouter;
    const apiKey = process.env[p.envKey];
    if (!apiKey) {
      console.error(`--provider openrouter needs ${p.envKey} in the environment (for example in a local .env, which git ignores).`);
      process.exit(2);
    }
    return createOpenAiClient({ model: v.model ?? p.defaultModel, apiKey, baseUrl: p.baseUrl, headers: p.headers, provider: p.id });
  }
  return createOllamaClient({ model: v.model ?? LOCAL_MODEL, url: v.url, ...(v['no-think'] ? { think: false } : {}) });
}
