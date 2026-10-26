// Voxta as an LLM provider (D-022): Voxta serves an OpenAI-compatible /v1/chat/completions that answers
// with whatever text model the player set up in Voxta (local or cloud), so a player's own Voxta setup can
// command the General. Local only: the address is always localhost, so a link can never send a Voxta key
// to another machine. Voxta ignores the model name and does not forward response_format; the turn
// validator (tools.ts) catches replies that drift from the schema.
import type { LlmClient } from './client.ts';
import { createOpenAiClient } from './openai.ts';

export const VOXTA_DEFAULT_PORT = 5384;
/** Voxta ignores the model name and uses the player's configured text service. */
export const VOXTA_MODEL = 'voxta-textgen';
/** A turn is a few hundred tokens of JSON; Voxta's own default reply length is far shorter. */
export const VOXTA_MAX_TOKENS = 1024;

/** A valid TCP port, else the default (the port comes from a URL parameter). */
export function voxtaPort(raw: string | null | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : VOXTA_DEFAULT_PORT;
}

export const voxtaBaseUrl = (port = VOXTA_DEFAULT_PORT) => `http://localhost:${port}/v1`;

/**
 * Is a Voxta answering on this machine? 'ready' (lets apps in without a key), 'needs-key' (401), or null
 * (nothing, or the browser was blocked: the game's address is not in Voxta's Cors:AllowedOrigins).
 */
export async function detectVoxta(opts: { port?: number; timeoutMs?: number; fetch?: typeof fetch } = {}): Promise<'ready' | 'needs-key' | null> {
  const doFetch = opts.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  try {
    const res = await doFetch(`${voxtaBaseUrl(opts.port)}/models`, { signal: AbortSignal.timeout(opts.timeoutMs ?? 800) });
    if (res.status === 401) return 'needs-key';
    if (!res.ok) return null;
    const body = await res.json() as { data?: { id?: unknown }[] };
    return body.data?.some((m) => m.id === VOXTA_MODEL) ? 'ready' : null;
  } catch {
    return null;
  }
}

export function createVoxtaClient(opts: { apiKey?: string; port?: number; baseUrl?: string; fetch?: typeof fetch }): LlmClient {
  const inner = createOpenAiClient({
    model: VOXTA_MODEL, apiKey: opts.apiKey ?? '', baseUrl: opts.baseUrl ?? voxtaBaseUrl(opts.port),
    // Without it Voxta uses the profile's reply length, which cut turns off mid-JSON (about 190 characters).
    maxTokens: VOXTA_MAX_TOKENS,
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  });
  return {
    name: 'voxta',
    complete: (req, signal) => inner.complete(req, signal).catch((e: unknown) => {
      const message = String(e instanceof Error ? e.message : e);
      // Voxta refuses a wrong or under-scoped key with an empty body; say what to do instead.
      if (/^openai (401|403)/.test(message)) {
        throw new Error(`voxta ${message.slice(7, 10)}: the key was refused. Use a Voxta API key with the inference scope; reload with &newkey to enter it again.`);
      }
      throw new Error(message.replace(/^openai/, 'voxta')
        .replace('Reload with &newkey to enter the key again.', 'Check Voxta is running, the key has the inference scope, and this page is in Voxta\'s Cors:AllowedOrigins.'));
    }),
  };
}
