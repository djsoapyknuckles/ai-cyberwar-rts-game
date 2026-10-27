# The Model: a Voxta character General

"The Model" is the game's own [Voxta](https://voxta.ai) character. Once it's imported, it can command the AI side and speak its taunts out loud (M2.7, D-023). This is fun mode: it plays about as well as the scripted AI. For the strongest General, use the local model (qwen3:8b) instead.

| File | What it is |
|---|---|
| `The Model.character.1.0.0.voxpak` | The character: persona, voice ("E-girl", fishaudio through Voxta Cloud), thumbnail. |
| `ai-cyberwar-preset.json` | Chat Replies preset for Voxta Cloud: Reasoning Effort None, one line, up to 200 tokens (room for five orders). |

## Setup (once)

You need Voxta Server running on the same machine as the game, and a Voxta Cloud account for the voice and the default model.

1. **Import the character.** In Voxta, import `The Model.character.1.0.0.voxpak`.
2. **Import the preset.** Under the Voxta Cloud service, open the Chat Replies presets, import `ai-cyberwar-preset.json`, and make it the default.
3. **Allow the game's address.** Add it (for example `http://localhost:5173`) to Voxta's `Cors:AllowedOrigins`, then restart Voxta. The setup screen offers "AI General (Voxta voice)" only when it can see your Voxta.
4. **Only if your Voxta asks for a login:** make an API key with the `chat` scope (Voxta → API keys); the game asks for it once. A Voxta without a login needs no key.

Step 2 is what keeps turns fast. Without it, the character still works, but on Voxta Cloud's "Automatic" preset the model thinks before every turn, and turns take 5–15 s instead of about 3 s.

**If you chat with other characters in the same Voxta**, keep your own default preset instead. Make a configuration that uses the game's preset for Chat Replies, with Summarization off. Then, in The Model's settings under Services, set **Force Configuration** to it. Voxta doesn't carry that setting in a character export, so it has to be set by hand.

## Play it

On the setup screen, pick **AI General (Voxta voice)**. The Model speaks its taunts; the 🔔 Sounds toggle mutes the voice too.

## Try it headless

```sh
# a Voxta with a login: put the key in a local .env as VOXTA_API_KEY (never commit it)
npm run llm-match -- --provider voxta-chat --character "The Model" --human control --matches 1 --chat
```

## License

The character and preset are original work of the project owner, offered under CC-BY-4.0 like the rest of the game's original assets. The thumbnail is AI-generated.
