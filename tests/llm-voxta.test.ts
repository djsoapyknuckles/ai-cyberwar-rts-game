import { describe, expect, it } from 'vitest';
import { loadKey, saveKey, type KeyStorage } from '../src/ai/llm/keystore.ts';
import { createVoxtaClient, detectVoxta, VOXTA_MAX_TOKENS, VOXTA_MODEL, voxtaPort } from '../src/ai/llm/voxta.ts';

// D-022: Voxta as an LLM provider through its OpenAI-compatible endpoint. No network: fetch is faked.
type Call = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
function fakeFetch(respond: () => Response): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, headers: (init.headers ?? {}) as Record<string, string>, body: init.body ? JSON.parse(init.body as string) : {} });
    return respond();
  }) as unknown as typeof fetch;
  return { fetch: f, calls };
}
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
const reply = (content: string) => json({ choices: [{ message: { role: 'assistant', content } }] });

describe('Voxta provider', () => {
  it('only accepts a valid port from the URL, else 5384', () => {
    expect(voxtaPort('5400')).toBe(5400);
    expect(voxtaPort(null)).toBe(5384);
    expect(voxtaPort('evil.example')).toBe(5384);
    expect(voxtaPort('70000')).toBe(5384);
  });

  it('detects a Voxta that lets apps in, one that needs a key, and nothing', async () => {
    expect(await detectVoxta({ fetch: fakeFetch(() => json({ data: [{ id: VOXTA_MODEL }] })).fetch })).toBe('ready');
    expect(await detectVoxta({ fetch: fakeFetch(() => new Response('', { status: 401 })).fetch })).toBe('needs-key');
    expect(await detectVoxta({ fetch: fakeFetch(() => json({ data: [{ id: 'gpt-4o' }] })).fetch })).toBeNull();
    const blocked = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    expect(await detectVoxta({ fetch: blocked })).toBeNull();
    const { fetch, calls } = fakeFetch(() => new Response('', { status: 401 }));
    await detectVoxta({ port: 5400, fetch });
    expect(calls[0]!.url).toBe('http://localhost:5400/v1/models');
  });

  it('calls the local chat/completions, with the key only when there is one', async () => {
    const withKey = fakeFetch(() => reply('{"orders":[]}'));
    expect(await createVoxtaClient({ apiKey: 'vx-key-123', fetch: withKey.fetch }).complete({ system: 's', user: 'u', schema: {} })).toBe('{"orders":[]}');
    expect(withKey.calls[0]!.url).toBe('http://localhost:5384/v1/chat/completions');
    expect(withKey.calls[0]!.headers.authorization).toBe('Bearer vx-key-123');
    expect(withKey.calls[0]!.body.model).toBe(VOXTA_MODEL);
    // Voxta's own default reply length cut turns off mid-JSON in the live test.
    expect(withKey.calls[0]!.body.max_tokens).toBe(VOXTA_MAX_TOKENS);
    const noKey = fakeFetch(() => reply('{}'));
    await createVoxtaClient({ fetch: noKey.fetch }).complete({ system: 's', user: 'u', schema: {} });
    expect(noKey.calls[0]!.headers).not.toHaveProperty('authorization');
  });

  it('says what to check when Voxta cannot be reached', async () => {
    const blocked = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    const err = await createVoxtaClient({ fetch: blocked }).complete({ system: '', user: '', schema: {} }).catch((e: Error) => e.message);
    expect(err).toMatch(/^voxta:/);
    expect(err).toContain('inference scope');
    expect(err).toContain('Cors:AllowedOrigins');
    // A wrong key: Voxta answers 401 with an empty body.
    const refused = createVoxtaClient({ apiKey: 'vx-wrong', fetch: fakeFetch(() => new Response('', { status: 401 })).fetch });
    expect(await refused.complete({ system: '', user: '', schema: {} }).catch((e: Error) => e.message))
      .toBe('voxta 401: the key was refused. Use a Voxta API key with the inference scope; reload with &newkey to enter it again.');
  });

  it('keeps the Voxta key in its own slot, apart from the OpenAI key', () => {
    const m = new Map<string, string>();
    const s: KeyStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); } };
    saveKey('sk-openai', false, s, s);
    saveKey('vx-voxta', false, s, s, 'voxta');
    expect(loadKey(s, s)).toBe('sk-openai');
    expect(loadKey(s, s, 'voxta')).toBe('vx-voxta');
  });
});
