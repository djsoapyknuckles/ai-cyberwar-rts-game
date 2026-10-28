# Proposal 0005: Pick your cloud provider (OpenRouter first)

Status: **proposed, needs owner approval.** Amends D-020. Nothing is built yet.

## Problem

The browser's "AI General (cloud)" works only with OpenAI. The game reads no API address from a link, so a shared link can't send a player's saved key to someone else's server (D-020). The side effect is that a player with an OpenRouter, Groq or other key can't play the cloud General in the browser, even though the client (`src/ai/llm/openai.ts`) already speaks the OpenAI-compatible API those services use. Headless runs can already reach them with `OPENAI_BASE_URL`.

The setup is also confusing for OpenAI players: the key prompt has an empty **Model** field with the hint "a model your key can use", and nothing in the game suggests a name.

## Proposal

Replace "OpenAI only" with a **fixed list of providers** built into the game. The player picks one, and each one brings its own address, key slot and default model.

| Provider | Address (fixed in code) | Key slot | Default model |
|---|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `openai` (today's slot, unchanged) | chosen by #29 |
| **OpenRouter** (new) | `https://openrouter.ai/api/v1` | `openrouter` | chosen by #29 |

- **Links can only name a provider from the list** (`?ai=llm&provider=openrouter`), never an address. Same protection as D-020: a key goes only to the address of the provider it was entered for.
- **One key slot per provider**, so an OpenAI key is never sent to OpenRouter or the other way round. `&newkey` forgets the key for the provider in use.
- **The key prompt** shows the provider's name, where to get a key, and the model field filled in with that provider's default, which the player can change.
- **The setup screen** gets a provider choice under "AI General (cloud)". The default stays OpenAI, so links and saved setups keep working.
- **Replays and `llm-match` results** record the provider, as they do now for `openai`, `ollama` and `voxta`.
- **Headless:** `--provider openrouter` reads `OPENROUTER_API_KEY`. `OPENAI_BASE_URL` stays for anything not on the list.

## OpenRouter specifics (checked 2026-10-27)

- **Browser calls work.** A preflight from `http://localhost:5173` answers `Access-Control-Allow-Origin: *` and allows `Authorization`, `Content-Type`, `HTTP-Referer` and `X-Title`. Error replies (e.g. 401) carry the CORS header too, so the game can show OpenRouter's real error message. OpenAI's error replies carry no CORS header, which is why the game shows a generic message for them today.
- **Same API.** `POST /chat/completions`, `Authorization: Bearer <key>`, `response_format: { type: 'json_object' }`. Support for `response_format` depends on the model, so the default model must be one that has it. To check during the build: whether OpenRouter's provider routing option `require_parameters` should be sent, so a request only goes to providers that honor `response_format`. The turn validator stays the safety net either way.
- **Attribution headers (optional):** `HTTP-Referer` and `X-Title: AI Cyberwar RTS` show the game on OpenRouter's app pages. They carry no player data.
- **Keys:** OpenRouter keys start `sk-or-`, which the existing `redactKeys` already masks (`sk-` prefix).
- **Later, not in this proposal:** OpenRouter supports OAuth with PKCE from a browser-only app. A "Log in with OpenRouter" button could hand the game a key without the player ever pasting one. It needs its own decision (callback URL on the hosted build, key lifetime).

## Grounding and tenets

- **Tenet 1 (AI integration):** more players can bring a General without running Ollama or Voxta.
- **Tenet 2 (one package):** same client, validator, planner, APM cap, reaction delay and scripted fallback for every provider. No provider-specific game logic.
- **Fair play:** unchanged. Benchmarked results (#29) still name the model and provider, so an OpenRouter result is comparable with an OpenAI one only when the model is the same.

## Options

1. **Fixed provider list, OpenRouter first** (recommended). Closes the gap safely; each new provider costs one table row plus a browser check.
2. **Free-form address in the key prompt only** (typed by the player, never from a link). Most flexible, but a player can be talked into typing a hostile address, and the game can't promise where the key goes.
3. **Keep OpenAI only.** Players with other keys use headless runs or route through Voxta (D-022).

## Build plan (if approved)

One PR, under ~400 lines:
1. A `PROVIDERS` table in `src/ai/llm/providers.ts` (id, label, base URL, key slot, default model, key help link, extra headers). Test: a link can't add or change an address, and each provider reads only its own key slot.
2. `createOpenAiClient` takes extra headers. Test: the OpenRouter client sends `X-Title` and never sends the OpenAI key.
3. Key prompt and setup screen read the table. Test: the model field is pre-filled with the provider's default.
4. `--provider openrouter` for `llm-turn` and `llm-match`, key from `OPENROUTER_API_KEY`; `.env.example` gains the variable name with an **empty** value.
5. DECISIONS entry amending D-020; README "how to play the General" section.

Each further provider (Groq, Mistral, …) is then a table row plus a CORS check, done the same way.

## Owner decisions

1. Approve the fixed provider list (option 1)?
2. OpenRouter's default model: decide now, or leave it to #29 and pre-fill nothing until then?
3. OK to send `HTTP-Referer` and `X-Title` to OpenRouter?
