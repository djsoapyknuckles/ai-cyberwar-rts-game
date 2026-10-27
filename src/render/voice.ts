// Speech playback for a Voxta character General (M2.7, #60): plays a reply's audio clips one after another and
// resolves when they are done, so the chat client can tell Voxta the speech finished (Voxta holds the chat until
// then). Muted, failed or stuck clips never hold the chat: each resolves at once or after a cap.

/** The part of HTMLAudioElement this needs, so tests can pass a fake. */
export interface ClipLike {
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: 'ended' | 'error', listener: () => void): void;
}

export interface VoiceOptions {
  /** Where the audio URLs are relative to, e.g. `http://localhost:5384`. */
  base: string;
  /** Checked before each clip, so muting mid-reply stops the rest. */
  muted: () => boolean;
  /** Longest a single clip may take (ms); a sentence is a few seconds. Default 20 s. */
  clipLimitMs?: number;
  clip?: (url: string) => ClipLike;
}

/** Returns a playback function for `createVoxtaChat({ playback })`. */
export function createVoice(opts: VoiceOptions): (reply: { audioUrls: string[] }) => Promise<void> {
  const make = opts.clip ?? ((url: string) => new Audio(url));
  const limit = opts.clipLimitMs ?? 20_000;
  const playOne = (url: string) => new Promise<void>((resolve) => {
    const clip = make(new URL(url, opts.base).href);
    const t = setTimeout(() => { clip.pause(); resolve(); }, limit);
    const done = () => { clearTimeout(t); resolve(); };
    clip.addEventListener('ended', done);
    clip.addEventListener('error', done);
    // Autoplay can be refused before the player has clicked anything; then there is nothing to wait for.
    clip.play().catch(done);
  });
  return async ({ audioUrls }) => {
    for (const url of audioUrls) {
      if (opts.muted()) return;
      await playOne(url);
    }
  };
}
