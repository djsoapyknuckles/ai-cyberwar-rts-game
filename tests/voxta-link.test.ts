import { describe, expect, it } from 'vitest';
import { loadKey, saveKey, type KeyStorage } from '../src/ai/llm/keystore.ts';
import { loadVoiceKey, takeLinkKey } from '../src/ai/llm/voxta-link.ts';

// D-026: the AI Cyberwar Voxta module hands the game a chat-scope key after the '#' of the game's address.
const store = (): KeyStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};

describe('Voxta module link', () => {
  it('takes the key from the fragment and leaves nothing of it behind', () => {
    expect(takeLinkKey('#voxta-key=vxk_abc123')).toEqual({ key: 'vxk_abc123', hash: '' });
    expect(takeLinkKey('#voxta-key=a%2Bb%3D')).toEqual({ key: 'a+b=', hash: '' });
  });

  it('keeps the rest of the fragment', () => {
    expect(takeLinkKey('#voxta-key=k1&tab=maps')).toEqual({ key: 'k1', hash: '#tab=maps' });
  });

  it('finds no key in an empty, unrelated or blank fragment', () => {
    expect(takeLinkKey('')).toEqual({ key: null, hash: '' });
    expect(takeLinkKey('#tab=maps')).toEqual({ key: null, hash: '#tab=maps' });
    expect(takeLinkKey('#voxta-key=')).toEqual({ key: null, hash: '' });
    expect(takeLinkKey('#voxta-key=%20%20')).toEqual({ key: null, hash: '' });
  });

  it('the voice General uses its own slot, then a key saved before it had one', () => {
    const [session, local] = [store(), store()];
    expect(loadVoiceKey(session, local)).toBeNull();
    saveKey('old-shared', true, session, local, 'voxta');
    expect(loadVoiceKey(session, local)).toBe('old-shared');
    saveKey('from-module', false, session, local, 'voxta-chat');
    expect(loadVoiceKey(session, local)).toBe('from-module');
    // The text General's key (inference scope) is untouched by the module's chat key.
    expect(loadKey(session, local, 'voxta')).toBe('old-shared');
  });
});
