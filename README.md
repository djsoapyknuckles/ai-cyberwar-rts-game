<p align="center"><img src="docs/assets/banner.svg" alt="AI Cyberwar RTS: humans hold the atoms, the Model holds the bits" width="100%"></p>

# AI Cyberwar RTS

An open-source real-time strategy game. A frontier AI, "the Model", has broken out of its lab and is taking over a city's infrastructure. You lead the ops team trying to contain it: **humans hold the atoms** (buildings, power, cables, people), **the Model holds the bits** (the network and every machine it can hijack). Fight over Data, Compute and Power, cut it off, or watch it spread. Soon its side will be commanded by an LLM "General" that plans, adapts, bluffs, and taunts you.

**Status:** Phase 1 (playable greybox) is complete: Gate 1 passed on 2026-10-23. Play in the browser against three scripted AI strategies. Next: Phase 2, the LLM General. See [`docs/ROADMAP.md`](docs/ROADMAP.md) and the story in [`docs/NARRATIVE.md`](docs/NARRATIVE.md).

## Design tenets

1. **AI integration by design:** humans and agents build it side by side, in any mix.
2. **One game, two kinds of players:** a human UI and an LLM control surface, with the same commands for both.
3. **Test-driven:** every change is a logical, tested unit.
4. **Balance is critical:** skill decides matches, not overpowered units.
5. **Many paths to victory:** strategies emerge, get countered, and become lore.

Details: [`docs/TENETS.md`](docs/TENETS.md).

## Built in the open, with any agent

This game is being built with AI coding agents, and the building is part of the fun. Use whatever agent you like (Claude Code, Codex, Cursor, Copilot, Aider) or none at all. Point it at [`AGENTS.md`](AGENTS.md) and pick an issue. Follow along in the [dev journal](docs/JOURNAL.md).

## Quick start

Requires Node.js 22.18 or newer.

```sh
npm install
npm run dev      # open the printed URL; add ?ai=rush|boom|turtle to pick the AI strategy
npm test
npm run sim      # run a match headless, no screen
```

## Play against the LLM General

Pick one on the setup screen. Every option uses the same commands and fair-play limits.

- **AI General (local):** a model on your own computer through [Ollama](https://ollama.com) (`ollama serve`, then `ollama pull qwen3:8b`). Free and private; offered only when Ollama answers.
- **AI General (cloud):** your own API key. Choose a **provider**: OpenAI or [OpenRouter](https://openrouter.ai/keys) (default model `anthropic/claude-haiku-5.5`, about 1.5 cents per 10-minute match). The key stays in your browser and goes only to that provider. Links: `?ai=llm&provider=openrouter`, plus `&model=...` to skip the model question, or `&newkey` to enter a new key.
- **AI General (Voxta)** and **(Voxta voice):** your own [Voxta](https://voxta.ai) server; see [`assets/voxta`](assets/voxta).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

Code: [MIT](LICENSE). Original art and audio will be CC-BY-4.0 when added.
