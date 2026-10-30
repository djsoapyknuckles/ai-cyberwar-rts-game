# Proposal 0006: A Voxta module that sets up The Model

Status: **proposed, waiting for the owner.** Spike done (2026-10-29, below). Builds on D-022 and D-023.

## Problem

Playing against The Model (D-023) takes four setup steps in Voxta before the first match (`assets/voxta/README.md`): import the character, import the chat preset, add the game's address to `Cors:AllowedOrigins` and restart, and, for a Voxta with a login, make an API key and paste it into the game. Each step is a place to give up.

There is also a hidden fifth step. A Voxta with no login lets the game in without a key only when the account allows external apps (the spike found this). With that setting on, **every website the player visits** can use their Voxta as an administrator. The game should not depend on it.

## The idea

The game stays its own app, played in the browser, and keeps talking to Voxta through its own chat client (`src/ai/llm/voxta-chat.ts`). A small **Voxta module** is the installer around it, the way Voxta's game integrations for other games are add-ons rather than the game itself.

The module does only setup:

1. **Installs The Model.** The module carries `The Model.character.1.0.0.voxpak` and installs it for the player's account through Voxta's resource deployer. It writes nothing when the installed version is current, updates it when the module ships a new version, and keeps the player's own edits.
2. **Hands the game a key.** It serves a small "connect" page on Voxta's own address. That page makes an API key with the `chat` scope only, labelled "AI Cyberwar", deletes the previous one with that label, and sends the player to the game with the key after the `#` in the address (browsers never send that part to a server). The game saves the key and removes it from the address bar at once.
3. **Puts the game in Voxta's Play library** (Voxta 1.14 and later). Play installs The Model, then opens the connect page in the browser. The game's address is a module setting.

The game never runs inside Voxta, and Voxta never touches game state. Tool calls still go through the same validator, planner, APM cap and reaction delay as every other General.

## Setup, before and after

| Step today | With the module |
|---|---|
| Import The Model | Done by the module |
| Import the chat preset (reasoning off) | **Still by hand.** Voxta has no way for a module to install a preset that the spike found. Open question below. |
| Add the game's address to `Cors:AllowedOrigins`, restart Voxta | Not needed (see the small game change) |
| Make an API key, paste it into the game | Done by the connect page |
| Allow external apps (hidden step) | Not needed; the player can turn it off |
| New: install the module | Once, from the game's GitHub releases (Voxta's module registries page) |

## Spike result (2026-10-29)

A throwaway module (`Voxta.Modules.AiCyberwarSpike`, kept outside this repo) was built against Voxta 1.13.0 and loaded as a dev folder into the owner's Voxta 1.13.0. A stand-in game page on `http://localhost:5174` played the game's part: read the key from the address, open Voxta's hub with it, list characters. A headless browser drove both. The module was unloaded and its key deleted afterwards.

| Check | Allow external apps on | Allow external apps off |
|---|---|---|
| Connect page, opened directly | key made, The Model `Current`, game reached | same |
| Game connects to the hub with the key, from another address, no CORS setting | ✅ signed in, 7 characters, The Model found | ✅ same |
| Game connects with **no** key | (not tested: the setting lets anything in) | refused (connection closed) |
| Another website opens the connect page or calls the module | allowed | **refused (403)** |
| Another website reads the API key list | allowed | **refused (403)** |

What this shows:
- A key in the hub address gets the game in from any address. `Cors:AllowedOrigins` is not needed for the Voxta General, only for the game's Voxta detection (a `fetch`), which can be replaced.
- The connect page is safe to have: with external apps off, no other website can reach it or the module.
- With external apps on, the module adds no new risk, because that setting already gives every website everything.
- Installing The Model from the module reports `Current` for a Voxta that already has the imported package, so existing players keep their character.

Limits found:
- **Voxta 1.13.0 has no Play library for modules.** The library API (`ILauncher`) is in Voxta's code after 1.13.0. On 1.13 the player opens the connect page by address or from a link in the module's settings.
- **No Voxta SDK package for 1.13** on NuGet (latest is 1.12.0). The spike built against Voxta's source at the `v1.13.0` tag.
- **Only Voxta's Full edition** loads add-on modules (not Lite or hosted).
- **Not tested:** a Voxta with a password, where the browser the connect page opens in may need to sign in first.

## Changes in the game (small)

- Read `#voxta-key=…` on load: save it in the key store under the Voxta slot, remove it from the address (`history.replaceState`), select "AI General (Voxta voice)".
- Show the Voxta option without the detection `fetch` when a key is saved, or detect Voxta by opening the hub instead (a WebSocket needs no CORS).
- Keep everything else. The headless `llm-match --provider voxta-chat` path is unchanged.

## The module

- C#, .NET 10, Voxta's module SDK. About 150 lines: the connect page, the install call, the Play library entry, one setting (the game's address).
- Lives in a folder of this repository (`voxta-module/Voxta.Modules.AiCyberwar/`), released with Voxta's reusable workflows ([voxta-module-actions](https://github.com/voxta-ai/voxta-module-actions) `release.yml@v1`). It finds the one `module.json` in the repository and builds that folder. What this repository needs for it:
  - A `global.json` at the root (the workflow sets up .NET from it); harmless to Node.
  - Locked restores: `packages.lock.json` committed, and the template's `Directory.Build.props` inside `voxta-module/` (MSBuild looks upward from the project, so it stays out of the game's root).
  - **Release on module tags only:** `Voxta.Modules.AiCyberwar/v0.1.0`. The game already tags `v0.1.x`; the template's `v*` trigger would try to release the module on every game tag and fail.
  - Not the shared `build.yml`: it runs `dotnet build` at the root, where there is no .NET project. A small job of our own packs the module on pull requests that touch `voxta-module/`.
  - The module's GitHub releases sit in the same list as the game's. Voxta skips releases without a `voxta-module.json`, so game releases don't confuse it; the module release may show as "Latest" on GitHub.
  - The character comes from `assets/voxta/` (linked in the project, not copied), so there is one copy.
- **SDK:** the workflow needs `Voxta.Sdk.Modules` 1.13.0 or later from NuGet. Only `1.13.0-alpha.14` is there today (it has the packing step); use it, or wait for 1.13.0.
- **Two ways to reach players:** with `publish: false`, players add this repository on Voxta's Module Registries page. With `publish: true`, Voxta's own module list carries it, which needs Voxta to trust the repository (their portal) and a tag ruleset protecting the module tags.
- Third-party modules show as "unverified" and Voxta asks before every install and update, until Voxta Cloud reviews a release.
- Carries the game and data version, like every other file the game ships (Definition of done 9).

## Owner decisions needed

1. **Go ahead?** The module replaces the four setup steps with "install the module" plus the preset.
2. ✅ **Where it lives:** a folder in this repository, released with voxta-module-actions (owner, 2026-10-29). GitHub source only for now (`publish: false`); asking Voxta to list it can come later.
3. **Which Voxta:** 1.13 (connect page only) now, or wait for the Voxta release with the Play library.
4. **Game address:** players run the game locally (`npm run dev`, or a built copy), or a public copy (for example GitHub Pages). A public `https` copy talking to `localhost` may get a browser permission prompt (Chrome's local network access); to check before choosing it.

## Open questions

- **The preset.** Ask Voxta for a way for modules to install a chat preset, or to start the game's chat with reasoning off. Until then it stays a manual step with today's instructions.
- **A Voxta with a password:** check the connect page signs in and comes back.
- **Old keys:** one key per player, replaced on every Play. Check the label-match delete does not touch keys the player named "AI Cyberwar" themselves (use a more specific label).

## Build plan

1. ✅ **Spike** (above).
2. Owner decisions, then a D-026 entry.
3. Game: read the key from the address, detection without `fetch`; tests.
4. Module: connect page, install The Model, setting; release workflow.
5. Play library entry, once the owner's Voxta has it.
6. Update `assets/voxta/README.md`: install the module, import the preset, play.
