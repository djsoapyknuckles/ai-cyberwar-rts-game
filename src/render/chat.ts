// Chat panel (Phase 2, M2.5): the General's messages, newest last. Text only (textContent, never HTML),
// because the messages come from a model. Chat is talk: nothing here can issue a command.
// A new message shows alone for FRESH_MS, then the panel folds to a small chip so it never hides the map;
// clicking (tapping) the panel opens the history, clicking again folds it.
// Against an LLM General the open panel also has a chat box (D-027): what the player types goes only to the
// General's reply call, never to its orders.
import type { HearResult } from '../ai/llm/talk.ts';

export interface ChatPanel {
  /** A line in the history: the General's (default) or the player's own. */
  push(tick: number, text: string, from?: 'general' | 'player'): void;
  /** Shows "<speaker> is typing…" while a reply is out. */
  setTyping(typing: boolean): void;
  /** Call every frame with the wall-clock time (ms) so a fresh message folds away on time. */
  update(now: number): void;
}

const MAX_LINES = 6;
/** The chat box takes as much as the General may hear (`MAX_TAUNT_LENGTH`); longer text is clipped anyway. */
const INPUT_MAX = 140;

/** What the chat box says after a send, or null when the message went out. */
export function hearNotice(result: HearResult, speaker: string): string | null {
  switch (result) {
    case 'sent': return null;
    case 'too-soon': return 'Wait a few seconds between messages.';
    case 'busy': return `${speaker} is typing…`;
    case 'quiet': return `${speaker} has stopped answering.`;
    case 'empty': return 'Message not sent: no links or contact details.';
    case 'off': return `${speaker} isn't listening.`;
  }
}

/** True when a key press is typing into a field, so game hotkeys must ignore it. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || !!el.isContentEditable);
}
export const FRESH_MS = 8000;

export type ChatMode = 'fresh' | 'folded' | 'open';

/** What the panel shows: the history when opened, the newest line while it is fresh, else just the chip. */
export function chatMode(lastAt: number | null, now: number, open: boolean): ChatMode {
  if (open) return 'open';
  return lastAt !== null && now - lastAt < FRESH_MS ? 'fresh' : 'folded';
}

/** `send`: the chat box's handler; without it the panel only shows the General's messages. */
export function createChatPanel(root: HTMLElement, speaker: string, tickRate: number, send?: (text: string) => HearResult): ChatPanel {
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
  const typing = document.createElement('div');
  typing.className = 'chat-typing dim';
  typing.hidden = true;
  typing.textContent = `${speaker} is typing…`;
  panel.append(toggle, log, typing);
  if (send) {
    const form = document.createElement('form');
    form.className = 'chat-input';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = INPUT_MAX;
    input.placeholder = `Message ${speaker}`;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', `Message ${speaker}`);
    const notice = document.createElement('div');
    notice.className = 'chat-notice dim';
    form.append(input, notice);
    // Typing and clicking in the box must not fold the panel.
    form.addEventListener('click', (e) => e.stopPropagation());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const why = hearNotice(send(text), speaker);
      notice.textContent = why ?? '';
      if (!why) input.value = '';
    });
    panel.append(form);
    // The chip shows from the start, so the player can open it and talk first.
    panel.hidden = false;
  }
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
    push(tick, text, from = 'general') {
      const secs = Math.trunc(tick / tickRate);
      const line = document.createElement('div');
      const time = document.createElement('span');
      time.className = 'dim';
      time.textContent = `${Math.trunc(secs / 60)}:${String(secs % 60).padStart(2, '0')} `;
      const who = document.createElement('b');
      who.textContent = from === 'player' ? 'You: ' : `${speaker}: `;
      if (from === 'player') line.className = 'chat-you';
      line.append(time, who, document.createTextNode(text));
      log.append(line);
      while (log.childElementCount > MAX_LINES) log.firstElementChild!.remove();
      panel.hidden = false;
      if (from === 'general') {
        if (!open) unread++;
        pending = true;
      }
    },
    setTyping(on) {
      typing.hidden = !on;
    },
    update(now) {
      const arrived = pending;
      if (arrived) { lastAt = now; pending = false; }
      const next = chatMode(lastAt, now, open);
      if (next !== mode || arrived) show(next);
    },
  };
}
