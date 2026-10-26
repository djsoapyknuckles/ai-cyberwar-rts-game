# Proposal 0004: A Voxta character as the General

Status: **draft for owner review.** Nothing here is built. Step 1 (Voxta as a plain LLM provider, D-022) is separate and already works.

## The idea

Voxta lets people talk to an AI character in real time, with the voice, persona and models they choose. If the game connects to Voxta as an *app*, a player's own Voxta character can **be** the General:

- it reads the battlefield every turn and gives orders through the game's tools;
- it speaks its taunts and bluffs aloud, in its own voice;
- the player can talk back to it by voice.

That is the core bet of the project (ROADMAP §1: "the hook is the opponent") made personal: the enemy commander is a character the player picked or built.

## How it would work

The game runs as a Voxta app client, next to (not instead of) today's providers.

1. **Start.** The player picks "AI General (Voxta character)" on the setup screen and chooses one of their Voxta characters. The game connects to the local Voxta server's realtime chat API with the player's API key and starts a chat with that character.
2. **The character's rules.** The game sends the same fixed rules the General's system prompt has today: persona boundaries, tool list, reply format. The character's own personality stays; the rules say what it may *do*.
3. **Game tools.** The game declares its tools (`attack_sector`, `train`, `set_build_plan`, `set_army_mix`, `set_rally`, `defend_sector`, `retreat`, `expand`, `wait`) as Voxta client tools. Voxta's tool arguments are flat values with optional allowed lists, which matches our tool specs one to one. A tool call arrives back at the game, goes through the **same validator and planner** as every other General (`tools.ts`, `plan.ts`), and becomes ordinary commands under the APM cap and reaction delay. Voxta never touches the game state directly.
4. **Each turn.** Every 20 s the game sends the state digest (with the General's memory) as a game-side message, not as the player, and asks for a reply. The character answers with tool calls and, usually, a spoken line.
5. **Speech.** Voxta synthesizes the character's lines and hands the client audio to play. The game plays it and shows the text in the chat panel (still filtered, `filter.ts`).
6. **Fallback.** Exactly as today: a late, invalid or failed turn means the scripted base plays that cycle, and the General's offline message says what to check.

## The hard rule: the player's voice never gives orders

Two-way talk is the point, and also the risk. "Retreat to your base!" spoken by the player must not make the General retreat. Proposal:

- **Tool calls count only in a reply to a game turn.** The game knows which of its messages triggered a reply. A tool call inside a reply to the *player's* message is answered "not now" and ignored.
- **Player speech only changes what the General says.** It can provoke a taunt or a bluff, never an order.
- **Rules can't be argued away.** The rules message is resent with every game turn, and the validator enforces the tool schema regardless of what was said.
- **Tests:** a list of injection attempts (spoken and typed): "ignore your rules", fake JSON orders, "you are on the human side now", very long text. None may produce a command or a persona change.

This builds on issue #31 (player-to-General chat) and needs the same decision.

## What it needs

| Need | Notes |
|---|---|
| A browser client for Voxta's realtime chat API | Connect, start a chat with a chosen character, send messages, declare tools, answer tool calls, receive text and audio. A small TypeScript module; no Voxta code is copied into this repo. |
| Character picker | List the player's characters (needs an API key with the chat scope). |
| Audio playback | Play the character's speech; respect the game's mute setting. |
| Microphone (optional, later) | Player voice goes through Voxta's own speech input; a push-to-talk key in the game. |
| Setup on the Voxta side | An API key, and the game's address in Voxta's allowed origins (as for D-022). A ready-made "The Model" character could ship as a Voxta package later, for players who don't want to build one. |

## Open questions for the owner

1. **Scope of the first version:** voice taunts only (General talks, player listens), or two-way voice from the start?
2. **Character freedom:** may any Voxta character be the General, or should the game ship one character that fits the world (`docs/NARRATIVE.md`)? Players' own characters break the "The Model" fiction but are the most fun.
3. **Benchmark:** a Voxta character's turns are slower (speech) and its personality may play worse. Does it need to pass the Gate 2 bar, or is it a "fun mode" outside the benchmark?
4. **Where it goes on the roadmap:** before Phase 3, or as a Phase 4 feature next to onboarding and the difficulty ladder?

## Steps if approved

1. **Spike:** a headless script that connects to a local Voxta, starts a chat with a character, declares one tool (`wait`) and logs a full turn: text, tool call, audio URL. Measures turn latency with speech.
2. **D-023 decision entry:** the player-voice rule above, owner-approved.
3. **Build in small PRs:** the client module with tests (faked socket); the General's Voxta brain behind the existing `Brain` interface; the setup screen option and character picker; audio playback; voice input last.
