# The Model: a Voxta character General

"The Model" is the game's own [Voxta](https://voxta.ai) character. It can command the AI side and speak its taunts out loud (M2.7, D-023). This is fun mode: it plays about as well as the scripted AI. For the strongest General, use the local model (qwen3:8b) instead.

| File | What it is |
|---|---|
| `The Model.character.1.0.0.voxpak` | The character: persona, voice ("E-girl", fishaudio through Voxta Cloud), thumbnail. |
| `ai-cyberwar-preset.json` | Chat Replies preset for Voxta Cloud: Reasoning Effort None, one line, up to 200 tokens (room for five orders). |

The AI Cyberwar Voxta module (`voxta-module/`, D-026) carries both files and does most of the setup for you.

## What you need

- **Voxta Server 1.13.0 or newer**, on the same machine as the game, with a Voxta Cloud account for the voice and the default model. Older builds can't load the module. Builds before 1.13.0 also play no voice when Voxta has a password or "prevent other apps" turned on.
- **The game, running locally.** Install [Node.js](https://nodejs.org) 22.18 or newer, then:

  ```sh
  git clone https://github.com/djsoapyknuckles/ai-cyberwar-rts-game.git
  cd ai-cyberwar-rts-game
  npm install
  npm run dev
  ```

  Leave `npm run dev` running. It serves the game at http://localhost:5173/.

## Setup (once)

1. **Add the game's module source.** In Voxta, open Module Registries (`/modules/registries`) and add `djsoapyknuckles/ai-cyberwar-rts-game`.
2. **Install the module.** Install **AI Cyberwar** from Voxta's module list. If you run the game at another address, change **Game address** in the module's settings.
3. **Import the preset.** Under the Voxta Cloud service, open the Chat Replies presets, import `ai-cyberwar-preset.json`, and make it the default. The module's setup page links to the file too.

Step 3 is what keeps turns fast. Without it, the character still works, but on Voxta Cloud's "Automatic" preset the model thinks before every turn, and turns take 5–15 s instead of about 3 s.

**If you chat with other characters in the same Voxta**, keep your own default preset instead. Make a configuration that uses the game's preset for Chat Replies, with Summarization off. Then, in The Model's settings under Services, set **Force Configuration** to it. Voxta doesn't carry that setting in a character export, so you have to set it by hand.

You don't need to import the character, edit Voxta's CORS settings, make an API key, or allow external apps. The module does that part.

## Play it

1. In Voxta's Play library, press **Play** on AI Cyberwar. Voxta installs The Model the first time (and keeps your edits to it later).
2. Your browser opens the game, already connected. Behind the scenes, Voxta makes an API key that can only chat, labelled "AI Cyberwar", and gives it to the game. The game saves it and removes it from the address bar.
3. On the setup screen, pick **AI General (Voxta voice)** and start. The Model speaks its taunts. The 🔔 Sounds toggle mutes the voice too.

The game keeps the key only until you close that tab. Next time, start from **Play** again. Each Play replaces the old "AI Cyberwar" key with a new one.

## Without the module

Use this if your Voxta can't load modules.

1. Import `The Model.character.1.0.0.voxpak` in Voxta, and the preset as in step 3 above.
2. Add the game's address (for example `http://localhost:5173`) to Voxta's `Cors:AllowedOrigins`, then restart Voxta.
3. If your Voxta asks for a login, make an API key with the `chat` scope (Voxta → API keys). The game asks for it once.

## Try it headless

```sh
# a Voxta with a login: put the key in a local .env as VOXTA_API_KEY (never commit it)
npm run llm-match -- --provider voxta-chat --character "The Model" --human control --matches 1 --chat
```

## License

The character and preset are original work of the project owner, offered under CC-BY-4.0 like the rest of the game's original assets. The thumbnail is AI-generated.
