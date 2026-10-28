import { describe, expect, it } from 'vitest';
import { loadKey, saveKey, type KeyStorage } from '../src/ai/llm/keystore.ts';
import { createOpenAiClient } from '../src/ai/llm/openai.ts';
import { CLOUD_PROVIDERS, cloudProvider, promptModel } from '../src/ai/llm/providers.ts';

// D-025: the cloud General's providers are a fixed list; a link names one, never an address.
type Call = { url: string; headers: Record<string, string> };
const fakeFetch = (): { fetch: typeof fetch; calls: Call[] } => {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string> });
    return new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetch: f, calls };
};
const mem = (): KeyStorage => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } };
};

describe('cloud provider list', () => {
  it('accepts only listed provider ids, never an address', () => {
    expect(cloudProvider('openai')?.baseUrl).toBe('https://api.openai.com/v1');
    expect(cloudProvider('openrouter')?.baseUrl).toBe('https://openrouter.ai/api/v1');
    for (const bad of ['https://evil.example/v1', 'OpenRouter', 'toString', '__proto__', 'constructor', '', null, undefined]) {
      expect(cloudProvider(bad)).toBeNull();
    }
  });

  it('gives every provider its own key slot', () => {
    const slots = Object.values(CLOUD_PROVIDERS).map((p) => p.slot);
    expect(new Set(slots).size).toBe(slots.length);
    const [s, l] = [mem(), mem()];
    saveKey('sk-openai-0123456789', false, s, l, CLOUD_PROVIDERS.openai.slot);
    expect(loadKey(s, l, CLOUD_PROVIDERS.openrouter.slot)).toBeNull();
    saveKey('sk-or-v1-0123456789', false, s, l, CLOUD_PROVIDERS.openrouter.slot);
    expect(loadKey(s, l, CLOUD_PROVIDERS.openai.slot)).toBe('sk-openai-0123456789');
  });

  it('pre-fills the provider default unless the link names a model', () => {
    expect(promptModel(CLOUD_PROVIDERS.openrouter, '')).toBe('anthropic/claude-haiku-5.5');
    expect(promptModel(CLOUD_PROVIDERS.openrouter, null)).toBe('anthropic/claude-haiku-5.5');
    expect(promptModel(CLOUD_PROVIDERS.openrouter, 'openai/gpt-6-luna')).toBe('openai/gpt-6-luna');
  });
});

describe('OpenRouter client', () => {
  it('sends its attribution headers and only its own key, to its own address', async () => {
    const p = CLOUD_PROVIDERS.openrouter;
    const { fetch, calls } = fakeFetch();
    const client = createOpenAiClient({ model: p.defaultModel, apiKey: 'sk-or-v1-abcdef123456', baseUrl: p.baseUrl, headers: p.headers, provider: p.id, fetch });
    expect(client.name).toBe('openrouter:anthropic/claude-haiku-5.5');
    await client.complete({ system: '', user: '', schema: {} });
    expect(calls[0]!.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(calls[0]!.headers).toMatchObject({ 'HTTP-Referer': expect.any(String), 'X-Title': 'AI Cyberwar RTS', authorization: 'Bearer sk-or-v1-abcdef123456' });
  });

  it('never lets extra headers replace the key or content type', async () => {
    const { fetch, calls } = fakeFetch();
    await createOpenAiClient({ model: 'm', apiKey: 'sk-mine-123456', headers: { authorization: 'Bearer other', 'content-type': 'text/plain' }, fetch })
      .complete({ system: '', user: '', schema: {} });
    expect(calls[0]!.headers.authorization).toBe('Bearer sk-mine-123456');
    expect(calls[0]!.headers['content-type']).toBe('application/json');
  });

  it('names the provider in errors, with the key masked', async () => {
    const key = 'sk-or-v1-abcdef123456';
    const echo = (async () => new Response(`bad key ${key}`, { status: 401 })) as unknown as typeof fetch;
    const err = await createOpenAiClient({ model: 'm', apiKey: key, provider: 'openrouter', fetch: echo })
      .complete({ system: '', user: '', schema: {} }).catch((e: Error) => e.message);
    expect(err).toContain('openrouter 401');
    expect(err).not.toContain(key);
  });
});

describe('structured output (OpenRouter)', () => {
  const schema = { type: 'object', properties: { orders: { type: 'array' } } };
  const bodies = (): { fetch: typeof fetch; seen: Record<string, unknown>[] } => {
    const seen: Record<string, unknown>[] = [];
    const f = (async (_url: string, init: RequestInit) => {
      seen.push(JSON.parse(init.body as string) as Record<string, unknown>);
      return new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    return { fetch: f, seen };
  };

  it('sends the turn schema strictly and asks OpenRouter to route only to providers that honor it', async () => {
    const p = CLOUD_PROVIDERS.openrouter;
    const { fetch, seen } = bodies();
    await createOpenAiClient({ model: 'm', apiKey: 'k', baseUrl: p.baseUrl, jsonSchema: p.jsonSchema, body: p.body, fetch })
      .complete({ system: '', user: '', schema });
    expect(seen[0]!.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'turn', strict: true, schema } });
    expect(seen[0]!.provider).toEqual({ require_parameters: true });
  });

  it('keeps plain JSON mode for OpenAI, and extra body fields never replace the model or messages', async () => {
    const { fetch, seen } = bodies();
    await createOpenAiClient({ model: 'mine', apiKey: 'k', jsonSchema: CLOUD_PROVIDERS.openai.jsonSchema, body: { model: 'other', messages: [] }, fetch })
      .complete({ system: 's', user: 'u', schema });
    expect(seen[0]!.response_format).toEqual({ type: 'json_object' });
    expect(seen[0]!.model).toBe('mine');
    expect(seen[0]!.messages).toHaveLength(2);
  });
});
