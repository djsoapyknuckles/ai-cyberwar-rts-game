import { describe, expect, it } from 'vitest';
import { CLOUD_PROVIDERS } from '../src/ai/llm/providers.ts';
import { pointsToModule } from '../src/render/keyprompt.ts';

// The Voxta module (D-026) gives the voice General a chat key through Play; the key prompt says so only there.
describe('key prompt points to the Voxta module', () => {
  it('for the voice General (chat scope)', () => {
    expect(pointsToModule({ kind: 'voxta', port: 5384, scope: 'chat' })).toBe(true);
  });

  it('not for Voxta as a text model (inference scope) or a cloud provider', () => {
    expect(pointsToModule({ kind: 'voxta', port: 5384 })).toBe(false);
    expect(pointsToModule({ kind: 'voxta', port: 5384, scope: 'inference' })).toBe(false);
    expect(pointsToModule({ kind: 'cloud', provider: CLOUD_PROVIDERS.openai! })).toBe(false);
  });
});
