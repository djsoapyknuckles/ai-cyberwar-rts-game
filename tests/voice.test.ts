import { describe, expect, it } from 'vitest';
import { createVoice, type ClipLike } from '../src/render/voice.ts';

// M2.7 (#60): the Voxta General's speech plays clip by clip, and never holds the chat when muted or broken.
function fakeClips(behavior: 'end' | 'error' | 'refuse' | 'hang' = 'end') {
  const played: string[] = [];
  const clip = (url: string): ClipLike => {
    const on: Record<string, () => void> = {};
    return {
      play: () => {
        played.push(url);
        if (behavior === 'refuse') return Promise.reject(new Error('autoplay'));
        if (behavior !== 'hang') setTimeout(() => on[behavior === 'end' ? 'ended' : 'error']?.(), 5);
        return Promise.resolve();
      },
      pause: () => {},
      addEventListener: (type, l) => { on[type] = l; },
    };
  };
  return { played, clip };
}

describe('Voxta voice playback', () => {
  it('plays each clip in order from the Voxta address, then resolves', async () => {
    const f = fakeClips();
    await createVoice({ base: 'http://localhost:5384', muted: () => false, clip: f.clip })({ audioUrls: ['/api/tts/a', '/api/tts/b'] });
    expect(f.played).toEqual(['http://localhost:5384/api/tts/a', 'http://localhost:5384/api/tts/b']);
  });

  it('muted: plays nothing and resolves at once', async () => {
    const f = fakeClips();
    await createVoice({ base: 'http://localhost:5384', muted: () => true, clip: f.clip })({ audioUrls: ['/a'] });
    expect(f.played).toEqual([]);
  });

  it.each(['error', 'refuse', 'hang'] as const)('a clip that fails (%s) does not hold the chat', async (behavior) => {
    const f = fakeClips(behavior);
    await createVoice({ base: 'http://localhost:5384', muted: () => false, clip: f.clip, clipLimitMs: 30 })({ audioUrls: ['/a', '/b'] });
    expect(f.played).toHaveLength(2);
  });
});
