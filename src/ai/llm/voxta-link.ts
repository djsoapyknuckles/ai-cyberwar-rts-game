// The AI Cyberwar Voxta module (D-026) opens the game with a chat-scope key after the '#', which browsers never
// send to a server. The game takes it once, saves it for the voice General and drops it from the address.
import { loadKey, type KeyStorage } from './keystore.ts';

const PARAM = 'voxta-key';

/** The key in a fragment such as `#voxta-key=…`, and the fragment without it. */
export function takeLinkKey(hash: string): { key: string | null; hash: string } {
  const parts = new URLSearchParams(hash.replace(/^#/, ''));
  if (!parts.has(PARAM)) return { key: null, hash };
  const key = parts.get(PARAM)?.trim() || null;
  parts.delete(PARAM);
  const rest = parts.toString();
  return { key, hash: rest ? `#${rest}` : '' };
}

/** The voice General's key: its own slot, else the shared Voxta slot keys were saved in before D-026. */
export function loadVoiceKey(session: KeyStorage, local: KeyStorage): string | null {
  return loadKey(session, local, 'voxta-chat') ?? loadKey(session, local, 'voxta');
}
