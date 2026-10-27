// Asks the player for their own API key (and the model) before a match against an LLM General they bring
// themselves: the OpenAI API (D-020) or their local Voxta server (D-022). The key is typed into a password
// field and handed to the caller; it is never put in the URL or shown again. The browser only talks to
// api.openai.com or to Voxta on localhost: a base URL from a link could send a saved key elsewhere.
export interface KeyAnswer { key: string; model: string; remember: boolean }

/** Voxta's `scope`: `inference` for its text endpoint (D-022), `chat` for a character General (D-023). */
export type KeyProvider = { kind: 'openai' } | { kind: 'voxta'; port: number; scope?: 'inference' | 'chat' };

export function promptForKey(model: string, needKey: boolean, provider: KeyProvider = { kind: 'openai' }): Promise<KeyAnswer | null> {
  return new Promise((resolve) => {
    const voxta = provider.kind === 'voxta';
    const el = document.createElement('div');
    el.id = 'key-prompt';
    const form = document.createElement('form');
    form.innerHTML = voxta
      ? `
      <h2>Play your Voxta General</h2>
      <p>Your Voxta server on this computer (localhost:<span data-port></span>) commands the AI. It asks for a login,
      so the game needs a Voxta <b>API key with the <span data-scope></span> scope</b> (Voxta → API keys). The key
      stays in this browser and is sent only to your Voxta. It is never added to the game, the URL or any file.</p>
      <input type="hidden" name="model">
      <label>API key <input type="password" name="key" autocomplete="off" spellcheck="false" required></label>
      <label class="remember"><input type="checkbox" name="remember"> Remember the key on this device</label>
      <div class="actions"><button type="submit">Start</button> <button type="button" name="skip">Play the scripted AI instead</button></div>`
      : `
      <h2>Play the cloud General</h2>
      <p>This match uses the OpenAI API with <b>your own API key</b>. The key stays in this browser and is sent only
      to api.openai.com. It is never added to the game, the URL or any file. Each turn costs a little on your account.</p>
      <label>Model <input name="model" autocomplete="off" spellcheck="false" required placeholder="a model your key can use"></label>
      <label ${needKey ? '' : 'hidden'}>API key <input type="password" name="key" autocomplete="off" spellcheck="false" ${needKey ? 'required' : ''} placeholder="sk-..."></label>
      <label class="remember" ${needKey ? '' : 'hidden'}><input type="checkbox" name="remember"> Remember the key on this device</label>
      <div class="actions"><button type="submit">Start</button> <button type="button" name="skip">Play the scripted AI instead</button></div>`;
    const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
    field('model').value = model;
    if (provider.kind === 'voxta') {
      form.querySelector('[data-port]')!.textContent = String(provider.port);
      form.querySelector('[data-scope]')!.textContent = provider.scope ?? 'inference';
    }
    el.append(form);
    document.body.append(el);
    const done = (answer: KeyAnswer | null) => { el.remove(); resolve(answer); };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const m = field('model').value.trim().replace(/[^\w.:/-]/g, '');
      if (m) done({ key: field('key').value.trim(), model: m, remember: field('remember').checked });
    });
    form.querySelector('button[name="skip"]')!.addEventListener('click', () => done(null));
    (voxta || (model && needKey) ? field('key') : field('model')).focus();
  });
}
