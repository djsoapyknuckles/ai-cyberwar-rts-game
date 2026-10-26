# Proposal 0004: A Voxta character as the General

Status: **approved (D-023), being built.** First version: spoken taunts only (no player voice), a shipped "The Model" character, fun mode outside the Gate 2 benchmark, before Phase 3. Step 1 (Voxta as a plain LLM provider, D-022) is separate and already works.

## Spike result (2026-10-26)

A throwaway headless client connected to a local Voxta, started a chat with a character, declared two game tools, sent one game turn and logged everything back:

| Time | Event |
|---|---|
| 0.3 s | chat started; the character's greeting arrived and needed a "speech playback complete" before the chat moved on |
| 0.3 s | game turn sent (the state digest) |
| 0.3–13.5 s | the model reasoned (this chat had reasoning on) |
| 15.1 s | two client tool calls: `attack_sector {"sector":"C"}`, `set_army_mix {"tank":2,"fast":1,"ranged":3}` — valid and sensible |
| 16.9 s | spoken line: "Contesting center sector now—reinforcements en route." (silent: that character had no voice set up) |

Must-haves for the real client:
- Report speech playback complete after **every** reply, greeting included, or the chat stalls.
- Count tool calls from the tool-call *request* only: each call is also announced twice as a reply event (called, then completed).
- Reasoning off in the shipped character's chat preset: 15 s is over the 10 s turn timeout.
- A character with a voice configured, or the "speech" is silence.

## Shipping "The Model"

Two ways; start with the first:
1. **A Voxta package in this repo** that players import once in Voxta. Authored in Voxta (persona, voice, chat preset with reasoning off) and exported; licensed with the game's original assets (CC-BY-4.0).
2. **The game creates the character through Voxta's API** if it's missing. Smoother, but needs a key allowed to write resources, which is more than a game should ask for. Later, if the import step proves a hurdle.

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

## Owner decisions (D-023)

1. **First version:** voice taunts only. The General talks, the player listens.
2. **Character:** the game ships "The Model"; players don't pick their own characters.
3. **Benchmark:** fun mode, outside the Gate 2 bar.
4. **Roadmap:** before Phase 3.

## Build plan

1. ✅ **Spike** (above).
2. ✅ **D-023 decision entry.**
3. **Voxta chat client** (`src/ai/llm/voxta-chat.ts`): connect, authenticate, start a chat with a character, send a turn, declare tools, answer tool calls, report speech playback; tests with a faked socket.
4. **Voxta character brain** behind the existing `Brain` interface: one chat per match; each turn sends the digest, collects the tool calls into an ordinary turn for the validator and planner, and returns the spoken line for the chat panel.
5. **"The Model" package** for Voxta, plus a short import guide.
6. **Setup screen option and speech playback:** "AI General (Voxta voice)", play the character's audio and report playback complete; respect the game's mute.
7. Later, separate decision: two-way voice, under the player-voice rule above.
