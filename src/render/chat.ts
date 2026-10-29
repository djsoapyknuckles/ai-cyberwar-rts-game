// Chat panel (Phase 2, M2.5): the General's messages, newest last. Text only (textContent, never HTML),
// because the messages come from a model. Chat is talk: nothing here can issue a command.
// A new message shows alone for FRESH_MS, then the panel folds to a small chip so it never hides the map;
// clicking (tapping) the panel opens the history, clicking again folds it.
export interface ChatPanel {
  push(tick: number, text: string): void;
  /** Call every frame with the wall-clock time (ms) so a fresh message folds away on time. */
  update(now: number): void;
}

const MAX_LINES = 6;
export const FRESH_MS = 8000;

export type ChatMode = 'fresh' | 'folded' | 'open';

/** What the panel shows: the history when opened, the newest line while it is fresh, else just the chip. */
export function chatMode(lastAt: number | null, now: number, open: boolean): ChatMode {
  if (open) return 'open';
  return lastAt !== null && now - lastAt < FRESH_MS ? 'fresh' : 'folded';
}

export function createChatPanel(root: HTMLElement, speaker: string, tickRate: number): ChatPanel {
  const panel = document.createElement('div');
  panel.id = 'hud-chat';
  panel.className = 'hud-panel folded';
  panel.hidden = true;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'chat-toggle';
  const log = document.createElement('div');
  log.className = 'chat-log';
  log.setAttribute('aria-live', 'polite');
  log.setAttribute('aria-label', `Messages from ${speaker}`);
  panel.append(toggle, log);
  root.appendChild(panel);

  let lastAt: number | null = null;
  let pending = false;
  let open = false;
  let unread = 0;
  let mode: ChatMode = 'folded';
  const label = (): void => {
    toggle.textContent = open ? `💬 ${speaker} ▾` : `💬 ${speaker}${unread > 0 ? ` · ${unread}` : ''} ▸`;
    toggle.title = open ? 'Hide messages' : 'Show messages';
  };
  const show = (next: ChatMode): void => {
    mode = next;
    panel.classList.toggle('fresh', mode === 'fresh');
    panel.classList.toggle('folded', mode === 'folded');
    panel.classList.toggle('open', mode === 'open');
    label();
  };
  panel.addEventListener('click', () => {
    open = !open;
    unread = 0;
    show(chatMode(lastAt, performance.now(), open));
  });

  return {
    push(tick, text) {
      const secs = Math.trunc(tick / tickRate);
      const line = document.createElement('div');
      const time = document.createElement('span');
      time.className = 'dim';
      time.textContent = `${Math.trunc(secs / 60)}:${String(secs % 60).padStart(2, '0')} `;
      const who = document.createElement('b');
      who.textContent = `${speaker}: `;
      line.append(time, who, document.createTextNode(text));
      log.append(line);
      while (log.childElementCount > MAX_LINES) log.firstElementChild!.remove();
      panel.hidden = false;
      if (!open) unread++;
      pending = true;
    },
    update(now) {
      const arrived = pending;
      if (arrived) { lastAt = now; pending = false; }
      const next = chatMode(lastAt, now, open);
      if (next !== mode || arrived) show(next);
    },
  };
}
