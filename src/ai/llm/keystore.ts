// Where a player's own API key lives in the browser (D-020). Session storage by default, so it is gone
// when the tab closes; local storage only if the player asks to remember it on this device.
/** One slot per provider, so an OpenAI key and a Voxta key never overwrite each other. */
export type KeySlot = 'openai' | 'voxta';
const keyName = (slot: KeySlot) => `cyberwar.${slot}-key`;

/** The parts of Web Storage this needs, so tests can pass a plain object. Every call may throw (private mode). */
export interface KeyStorage { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

const safe = <T>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };

export function loadKey(session: KeyStorage, local: KeyStorage, slot: KeySlot = 'openai'): string | null {
  const k = keyName(slot);
  return safe(() => session.getItem(k), null) ?? safe(() => local.getItem(k), null);
}

export function saveKey(key: string, remember: boolean, session: KeyStorage, local: KeyStorage, slot: KeySlot = 'openai'): void {
  forgetKey(session, local, slot);
  safe(() => (remember ? local : session).setItem(keyName(slot), key.trim()), undefined);
}

export function forgetKey(session: KeyStorage, local: KeyStorage, slot: KeySlot = 'openai'): void {
  safe(() => session.removeItem(keyName(slot)), undefined);
  safe(() => local.removeItem(keyName(slot)), undefined);
}
