// Cloud services that can run the General in the browser (D-025, amends D-020). The list is fixed in code:
// a link may name a provider (`&provider=openrouter`) but never an address, so a saved key only ever goes to
// the address of the provider it was entered for. Each provider keeps its key in its own slot.
import type { KeySlot } from './keystore.ts';

export type CloudProviderId = 'openai' | 'openrouter';

export interface CloudProvider {
  id: CloudProviderId;
  label: string;
  baseUrl: string;
  slot: KeySlot;
  /** Pre-filled in the key prompt; empty until a default is measured (#29). */
  defaultModel: string;
  /** Where players get a key. */
  keyUrl: string;
  keyHint: string;
  /** Extra request headers. Attribution only: never player data. */
  headers: Record<string, string>;
  /** Headless runs read the key from this environment variable. */
  envKey: string;
}

export const CLOUD_PROVIDERS: Record<CloudProviderId, CloudProvider> = {
  openai: {
    id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', slot: 'openai', defaultModel: '',
    keyUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-...', headers: {}, envKey: 'OPENAI_API_KEY',
  },
  // D-025: owner asked for "a decent but inexpensive model"; #29 can replace it once measured.
  openrouter: {
    id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', slot: 'openrouter',
    defaultModel: 'anthropic/claude-haiku-5.5', keyUrl: 'https://openrouter.ai/keys', keyHint: 'sk-or-...',
    headers: { 'HTTP-Referer': 'https://github.com/djsoapyknuckles/ai-cyberwar-rts-game', 'X-Title': 'AI Cyberwar RTS' },
    envKey: 'OPENROUTER_API_KEY',
  },
};

/** The provider a link or saved setting names, or null for anything not on the list. */
export function cloudProvider(id: string | null | undefined): CloudProvider | null {
  return id && Object.hasOwn(CLOUD_PROVIDERS, id) ? CLOUD_PROVIDERS[id as CloudProviderId] : null;
}

/** The model to pre-fill: one named in the link wins, then the provider's default. */
export const promptModel = (provider: CloudProvider, linkModel: string | null): string => linkModel || provider.defaultModel;
