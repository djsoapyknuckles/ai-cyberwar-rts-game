# The Model: a Voxta character General

"The Model" is the game's own [Voxta](https://voxta.ai) character. Once it's imported, it can command the AI side and speak its taunts out loud (M2.7, D-023). This is fun mode: it plays about as well as the scripted AI. For the strongest General, use the local model (qwen3:8b) instead.

| File | What it is |
|---|---|
| `The Model.character.1.0.0.voxpak` | The character: persona, voice ("E-girl", fishaudio through Voxta Cloud), thumbnail. |
| `ai-cyberwar-preset.json` | Chat Replies preset for Voxta Cloud: Reasoning Effort None, one line, up to 200 tokens (room for five orders). |

## Setup (once)

You need Voxta Server running on the same machine as the game, and a Voxta Cloud account for the voice and the default model.

1. **Import the character.** In Voxta, import `The Model.character.1.0.0.voxpak`.
2. **Import the preset.** Under the Voxta Cloud service, open the Chat Replies presets and import `ai-cyberwar-preset.json`.
3. **Make a configuration** that uses that preset for Chat Replies and has **Summarization off**. Summarization is a configuration switch, not part of the preset.
4. **Point the character at it.** In The Model's settings, under Services, set **Force Configuration** to that configuration. Voxta doesn't carry this setting in a character export, so every player sets it once.
5. **Make an API key** with the `chat` scope (add `inference` if you also use Voxta as a plain provider, D-022).
6. **Allow the game's address.** Add it (for example `http://localhost:5173`) to Voxta's `Cors:AllowedOrigins`, then restart Voxta.

Steps 2–4 are what keep turns fast. Without them, the character still works but uses your default services: on Voxta Cloud's "Automatic" preset the model thinks before every turn, and turns take 5–15 s instead of about 3 s.

## Try it headless

```sh
# key in a local .env as VOXTA_API_KEY (never commit it)
npm run llm-match -- --provider voxta-chat --character "The Model" --human control --matches 1 --chat
```

## License

The character and preset are original work of the project owner, offered under CC-BY-4.0 like the rest of the game's original assets.
