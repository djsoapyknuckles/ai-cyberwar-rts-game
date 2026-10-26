// Voxta realtime chat client (M2.7, D-023, issue #57): lets a Voxta character play the General.
// Speaks SignalR's JSON protocol over a plain WebSocket, so it needs no dependency and runs in the browser
// and in Node. Voxta's hub carries typed JSON messages ($type) both ways: we start a chat with a character,
// declare the game's tools, send each game turn, answer the character's tool calls, and report when each
// reply's speech has finished playing (Voxta waits for that before the chat moves on, greeting included).
// The key travels only in the connection URL, as Voxta's hub requires.
import { VOXTA_DEFAULT_PORT } from './voxta.ts';

/** The WebSocket surface we use; the browser's and Node's global WebSocket both fit, and tests pass a fake. */
export interface SocketLike {
  send(data: string): void;
  close(): void;
  addEventListener(type: 'open' | 'message' | 'close' | 'error', listener: (e: { data?: unknown; code?: number; reason?: string }) => void): void;
}

/** One tool argument as Voxta declares it: flat, typed, optionally limited to choices. */
export interface VoxtaToolArgument { name: string; type: 'String' | 'Integer' | 'Double' | 'Boolean'; description: string; required: boolean; choices?: string[] }
export interface VoxtaTool { name: string; description: string; arguments: VoxtaToolArgument[] }

export interface VoxtaToolCall { name: string; args: Record<string, unknown> }
/** `text` is the line spoken after the last tool call (all of it if the reply called none). */
export interface VoxtaReply { messageId: string; text: string; audioUrls: string[] }
export interface VoxtaTurn extends VoxtaReply { calls: VoxtaToolCall[] }

export interface VoxtaChatOptions {
  apiKey: string;
  port?: number;
  /** Injected in tests; defaults to the global WebSocket. */
  socket?: (url: string) => SocketLike;
  /** Called after every reply; resolve when its speech has finished playing. Default: at once (no audio). */
  playback?: (reply: VoxtaReply) => Promise<void>;
  /** How long to wait for a greeting after the chat starts; characters without one never send it. */
  greetingWaitMs?: number;
}

export interface VoxtaChat {
  characters(): Promise<{ id: string; name: string }[]>;
  /** Connect if needed and start a chat with the character, declaring the tools and the rules context. */
  start(opts: { characterId: string; tools: VoxtaTool[]; context: string }): Promise<void>;
  /** Send one game turn and wait for the character's reply (tool calls, text, audio). */
  turn(text: string, timeoutMs?: number): Promise<VoxtaTurn>;
  /**
   * True while the character is still answering, even after `turn` gave up on it. Voxta merges a message
   * sent mid-reply into the pending one and aborts the reply, so callers must not send until this clears.
   */
  readonly busy: boolean;
  close(): void;
}

const RS = '\x1e';
type Msg = { $type: string; [k: string]: unknown };

export function createVoxtaChat(opts: VoxtaChatOptions): VoxtaChat {
  const url = `ws://localhost:${opts.port ?? VOXTA_DEFAULT_PORT}/hub?access_token=${encodeURIComponent(opts.apiKey)}`;
  const playback = opts.playback ?? (async () => {});
  let socket: SocketLike | null = null;
  let ready: Promise<void> | null = null;
  let sessionId: string | null = null;
  let closed = false;
  /** When the reply in progress was asked for (ms), or null; a reply silent this long is given up on. */
  let askedAt: number | null = null;
  const STUCK_MS = 30_000;
  /** Waiters for the next message of a type; a failure (error message or disconnect) rejects them all. */
  const waiters: { type: string; resolve: (m: Msg) => void; reject: (e: Error) => void }[] = [];
  /** Reply being collected; finished on replyEnd. */
  let current: { calls: VoxtaToolCall[]; text: string[]; audio: string[] } | null = null;
  const empty = () => ({ calls: [], text: [], audio: [] });
  let onReply: ((reply: VoxtaTurn) => void) | null = null;
  let onFail: ((e: Error) => void) | null = null;

  const fail = (e: Error) => {
    askedAt = null;
    for (const w of waiters.splice(0)) w.reject(e);
    onFail?.(e);
  };
  const send = (msg: Msg) => socket?.send(JSON.stringify({ type: 1, target: 'SendMessage', arguments: [msg] }) + RS);
  const next = (type: string) => new Promise<Msg>((resolve, reject) => waiters.push({ type, resolve, reject }));

  const handle = (msg: Msg) => {
    const i = waiters.findIndex((w) => w.type === msg.$type);
    if (i >= 0) waiters.splice(i, 1)[0]!.resolve(msg);
    switch (msg.$type) {
      case 'replyStart':
        current = empty();
        break;
      case 'replyChunk':
        current ??= empty();
        if (typeof msg.text === 'string') current.text.push(msg.text);
        // Voxta sends a "silence:" placeholder when the character has no voice; there is nothing to play.
        if (typeof msg.audioUrl === 'string' && msg.audioUrl && !msg.audioUrl.startsWith('silence:')) current.audio.push(msg.audioUrl);
        break;
      case 'toolCallRequest': {
        current ??= empty();
        // Voxta asks the model again after tool results, so a line spoken before the calls is usually
        // said again after them; keep only the last one.
        current.text = [];
        // Arguments come as a JSON string (or, from backends without native tool calling, possibly odd shapes).
        let args: Record<string, unknown> = {};
        try {
          const raw = typeof msg.arguments === 'string' ? JSON.parse(msg.arguments) : msg.arguments;
          if (raw && typeof raw === 'object' && !Array.isArray(raw)) args = raw as Record<string, unknown>;
        } catch { /* left empty; the game's validator rejects the call */ }
        current.calls.push({ name: String(msg.name), args });
        // Answer exactly once, always: an unanswered call stalls the reply until Voxta's timeout.
        send({ $type: 'toolCallResult', sessionId, requestId: msg.requestId, result: 'Order received.', isError: false });
        break;
      }
      case 'replyEnd': {
        const done = current ?? empty();
        current = null;
        askedAt = null;
        const reply: VoxtaTurn = { messageId: String(msg.messageId ?? ''), text: done.text.join(' ').trim(), audioUrls: done.audio, calls: done.calls };
        // Voxta holds the chat until the client says this reply's speech has played.
        void playback(reply).catch(() => {}).finally(() => send({ $type: 'speechPlaybackComplete', sessionId, messageId: reply.messageId }));
        onReply?.(reply);
        break;
      }
      case 'replyCancelled':
        current = null;
        askedAt = null;
        break;
      case 'chatFlow':
        // An interrupted reply may end with no replyCancelled; the chat waiting for input again says it's over.
        // Only trusted after a timeout: while a turn waits, this state can still show before the reply starts.
        if (msg.state === 'WaitingForUserInput' && !onReply) { current = null; askedAt = null; }
        break;
      case 'error': case 'chatSessionError': case 'missingResourcesError':
        fail(new Error(`voxta ${msg.$type}: ${String(msg.message ?? msg.details ?? '').slice(0, 200)}`));
        break;
    }
  };

  const connect = () => {
    ready ??= new Promise<void>((resolve, reject) => {
      const s = (opts.socket ?? ((u) => new WebSocket(u) as unknown as SocketLike))(url);
      socket = s;
      s.addEventListener('open', () => s.send(JSON.stringify({ protocol: 'json', version: 1 }) + RS));
      s.addEventListener('error', () => {});
      s.addEventListener('close', (e) => {
        const err = new Error(`voxta: connection closed${e.code ? ` (${e.code})` : ''}. Check Voxta is running and the key has the chat scope.`);
        reject(err);
        if (!closed) fail(err);
      });
      s.addEventListener('message', (e) => {
        for (const frame of String(e.data).split(RS).filter(Boolean)) {
          let m: { type?: number; target?: string; arguments?: unknown[]; error?: string };
          try { m = JSON.parse(frame); } catch { continue; }
          if (m.type === undefined) {
            if (m.error) { reject(new Error(`voxta handshake: ${m.error}`)); continue; }
            send({ $type: 'authenticate', client: 'AiCyberwar', clientVersion: '0.1', scope: ['role:app'],
              capabilities: { audioInput: 'None', audioOutput: 'Url', acceptedAudioContentTypes: ['audio/mpeg', 'audio/x-wav'] } });
            continue;
          }
          if (m.type === 7) { fail(new Error(`voxta: server closed the connection${m.error ? `: ${m.error}` : ''}`)); continue; }
          if (m.type !== 1 || m.target !== 'ReceiveMessage') continue;
          const msg = m.arguments?.[0] as Msg | undefined;
          if (!msg || typeof msg.$type !== 'string') continue;
          if (msg.$type === 'welcome') resolve();
          handle(msg);
        }
      });
    });
    return ready;
  };

  return {
    async characters() {
      await connect();
      const wait = next('charactersListLoaded');
      send({ $type: 'loadCharactersList' });
      const list = (await wait).characters as { id: string; name: string }[] | undefined;
      return (list ?? []).map((c) => ({ id: String(c.id), name: String(c.name) }));
    },

    async start({ characterId, tools, context }) {
      await connect();
      const started = next('chatStarted');
      send({
        $type: 'startChat', characterId, ephemeral: true,
        tools: tools.map((t) => ({ ...t, permission: 'InChat', display: 'Hidden', timeoutSeconds: 30 })),
        contexts: [{ name: 'ai-cyberwar-rules', text: context }],
      });
      sessionId = String((await started).sessionId);
      // Let the character's greeting (if any) finish and be reported played before the first turn.
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => { onReply = null; resolve(); }, opts.greetingWaitMs ?? 3000);
        onReply = () => { clearTimeout(t); onReply = null; resolve(); };
      });
    },

    turn(text, timeoutMs = 10_000) {
      if (!sessionId) return Promise.reject(new Error('voxta: no chat started'));
      if (this.busy) return Promise.reject(new Error('voxta: still answering the last turn'));
      askedAt = Date.now();
      return new Promise<VoxtaTurn>((resolve, reject) => {
        const t = setTimeout(() => {
          onReply = null; onFail = null;
          // Stop the reply; the chat stays busy until Voxta confirms it ended.
          send({ $type: 'interrupt', sessionId });
          reject(new Error('voxta: no reply in time'));
        }, timeoutMs);
        onReply = (reply) => { clearTimeout(t); onReply = null; onFail = null; resolve(reply); };
        onFail = (e) => { clearTimeout(t); onReply = null; onFail = null; reject(e); };
        // No action inference on either side: each would be an extra model call per turn, and orders come from tools.
        send({ $type: 'send', sessionId, text, doReply: true, doUserActionInference: false, doCharacterActionInference: false });
      });
    },

    get busy() {
      return askedAt !== null && Date.now() - askedAt < STUCK_MS;
    },

    close() {
      closed = true;
      socket?.close();
    },
  };
}
