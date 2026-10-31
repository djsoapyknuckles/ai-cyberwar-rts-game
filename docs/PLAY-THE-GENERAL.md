# Play against the LLM General

The AI side can be commanded by a language model, the "General". Every 20 seconds it reads a short text report of what its side can see and gives orders: what to build, what to train, where to attack. It can also taunt you in the chat panel. Its base runs the moment-to-moment work with the scripted bot, so the AI never stands still while the model thinks.

The General follows the same rules as you: the same commands, the same fog of war, an action limit and a reaction delay. It always plays at full strength (Hard).

Start the game with `npm run dev` and open the address it prints (http://localhost:5173/). Then pick one of the options below on the setup screen, or use the link next to it.

| Option | What runs the model | Cost | Link |
|---|---|---|---|
| AI General (local) | Ollama on your computer | Free | `?ai=llm&model=qwen3:8b` |
| AI General (cloud) | OpenAI or OpenRouter, with your own key | Your account | `?ai=llm&provider=openrouter` |
| AI General (Voxta) and (Voxta voice) | Your own Voxta server | Your Voxta setup | see [`assets/voxta`](../assets/voxta/README.md) |
| Blind test | Local General or the scripted bot, at random | Free | `?ai=blind` |

Add a link to the game's address, for example http://localhost:5173/?ai=llm&model=qwen3:8b.

## Local (Ollama)

Free and private: nothing leaves your computer. You need a graphics card with about 6 GB of free memory for `qwen3:8b`, the default.

1. Install [Ollama](https://ollama.com).
2. Download the model: `ollama pull qwen3:8b`.
3. Make sure Ollama is running. The desktop app starts it for you; otherwise run `ollama serve`.
4. Open the game. The setup screen offers **AI General (local)** only when Ollama answers. Or open `?ai=llm&model=qwen3:8b`.

Other models work too. Pick one the setup screen lists, or name it in the link (`&model=qwen3:14b`). Bigger models play slower; each turn must arrive within 10 seconds.

**The first turn.** Ollama loads the model when the first turn arrives. That takes from a few seconds to about a minute, depending on your disk. A turn that misses the 10-second limit is skipped: the base plays it as the scripted bot. The game then keeps the model loaded for 30 minutes, so later turns and matches are fast. To load it before you start, run `ollama run qwen3:8b "hi"`.

**Ollama on another address.** Add `&ollama=http://<host>:11434`. Ollama accepts the game from `localhost` by default. If you open the game from another address, add that address to Ollama's `OLLAMA_ORIGINS` setting.

**Two graphics cards.** To keep the model off the card that draws the game, pin Ollama to one card. Set these environment variables, then restart Ollama:

```sh
CUDA_DEVICE_ORDER=PCI_BUS_ID
CUDA_VISIBLE_DEVICES=0          # the card's number, as nvidia-smi lists it
GGML_VK_VISIBLE_DEVICES=-1      # otherwise Ollama's Vulkan backend still uses the other card
```

On Windows, set them as user environment variables (Settings → System → About → Advanced system settings → Environment Variables), then quit Ollama from the tray and start it again.

## Cloud (your own key)

Use this when you have no suitable graphics card. You bring your own API key; each turn costs a little on your account.

- **OpenRouter** (`?ai=llm&provider=openrouter`): the default model is `anthropic/claude-haiku-5.5`, about 1.5 cents per 10-minute match. Get a key at [openrouter.ai/keys](https://openrouter.ai/keys).
- **OpenAI** (`?ai=llm&provider=openai`): type a model your key can use.

The game asks for the model and the key once. Add `&model=...` to the link to skip the model question.

**Your key.** The key stays in your browser. It is sent only to the provider you picked, never to another provider, and it is never added to the game, the link or any file. Without **Remember the key on this device**, it is forgotten when you close the tab. To enter a different key, add `&newkey` to the link.

## Voxta

[Voxta](https://voxta.ai) can run the General too: **AI General (Voxta)** uses any text model you set up in Voxta, and **AI General (Voxta voice)** is The Model, the game's own Voxta character, which speaks its taunts out loud. Setup is in [`assets/voxta/README.md`](../assets/voxta/README.md).

## Blind test

`?ai=blind` puts either the local General or the scripted Boom bot on the AI side, at random, and hides the chat panel. After the match you guess which one you played, then the game tells you. It keeps a tally of your guesses. It needs the local setup above; this is the test the owner used to pass Gate 2.

## Troubleshooting

When the General fails, its base keeps playing as the scripted bot, so the match always goes on. The game shows one message the first time this happens.

| Message | What it means | What to check |
|---|---|---|
| `General offline (TypeError: Failed to fetch): ...` | The game can't reach the model. | Is Ollama running? Is the model pulled (`ollama list`)? Opened from an address other than `localhost`? See `OLLAMA_ORIGINS` above. |
| `General offline (TimeoutError: ...)` | A turn took longer than 10 seconds. | Usually the first turn while the model loads; later turns are fine. If it keeps happening, use a smaller model. |
| `General offline (ollama 404: ...)` | Ollama doesn't have that model. | `ollama pull <model>`, or fix `&model=` in the link. |
| `General offline (openrouter: request failed (wrong API key or model, or no network) ...)` (or `openai: ...`) | The provider refused the request. | The key, the model name, your credit. Reload with `&newkey` to enter the key again. |
| `General offline (voxta ...)` or `Voxta General offline (...)` | The game can't reach Voxta or its key was refused. | See [`assets/voxta/README.md`](../assets/voxta/README.md). |
| `The Model isn't in your Voxta yet: ...` | Voxta answered, but the character isn't installed. | Install the AI Cyberwar module and press **Play** in Voxta. |

No chat at all? The General taunts about once a minute, and the panel folds to a small chip between messages. Click it to read them.

## Headless (no browser)

These run the General from the command line, for testing and benchmarks.

```sh
npm run llm-turn -- --model qwen3:8b --no-think       # one turn against local Ollama; prints the reply and the time it took
npm run llm-match -- --model qwen3:8b --no-think --human control --matches 30 --with-control   # full matches against the attack-every-turn control
npm run llm-turn -- --provider openrouter             # one turn against OpenRouter
```

Use `--no-think` with local qwen3 models, as the browser game does. Without it, the model reasons before every answer: a turn takes 10–30 s instead of under a second, most turns miss the 10-second limit, and the match is mostly the scripted bot.

Cloud and Voxta runs read their keys from a local `.env` file. Copy [`.env.example`](../.env.example) to `.env` and fill in only the keys you need. Git ignores `.env`. Never commit a key. Batch matches against a cloud model cost real money: at about 1.5 cents per match on the OpenRouter default, 30 matches cost about 45 cents.
