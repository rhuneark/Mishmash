# Mishmash — CLAUDE.md

A game for RUN.world. **The concept isn't decided yet.** The current build is a placeholder
screen (the name, "Coming soon" and a visit counter that proves appStorage saves work in the RUN
host). Replace it once the user describes the game, and rewrite this file to match.

Share link (private, unlisted): _not deployed yet — add it here after the first deploy._
(once it exists, end every update to the user with this link)

## Ask first

Anything outward-facing needs the user's OK first: making the game public (the Publish
workflow), posting anywhere, changing store listing text beyond the workflow env lines. Never put
the deploy key (`RUNDOT_API_KEY`, `rk_…`) in chat, code or logs.

## Setup status

The one-time RUN setup is the user's to run (it needs their RUN login); the steps are in
`README.md`: `rundot login` → `rundot init --name "Mishmash" … --orientation Portrait
--build-path ./dist` → first `rundot deploy` (prints the share link) → `rundot game api-keys
create` → `RUNDOT_API_KEY` repo secret → commit `game.config.prod.json`. Until then the Deploy
workflow typechecks, tests, builds and preflights, then skips the deploy with a warning.

Once `game.config.prod.json` is committed: record the share link and game ID above, delete the
stopgap `game.config.json` (it only declares portrait so preflight passes before `rundot init`;
the prod config declares it too), and update this section.

## Layout

```
src/game/     Pure rules. No SDK, no React, no DOM. Deterministic given inputs + seed.
  save.ts       save JSON parse/repair (SAVE_KEY, SAVE_VERSION)
  *.test.ts     vitest unit tests
src/sdk/run.ts  THE ONLY module that imports the RUN SDK. Waits for start-up, catches everything.
src/components/ ErrorBoundary
src/App.tsx     placeholder screen
src/main.tsx    entry: safe-area/font-scale CSS vars, lifecycle hooks, render
public/thumbnail.jpg   store thumbnail placeholder (512×512 JPEG; deploy rejects the template's)
rundot/cli_hooks.json  RUN CLI hooks (from the template)
game.config.json       stopgap portrait declaration for preflight (see Setup status)
```

Built on `series-ai/run-template-2d-react` (same base as the user's other RUN game, The Dood).

## Conventions

- **Rules stay pure** in `src/game`: no SDK calls, no React, no `Date.now()`/`Math.random()`
  inside rules (pass `now`/seeds in).
- **Every RUN SDK call goes through `src/sdk/run.ts`.** It awaits `ready()` and catches every
  failure (callers get `null`/`false`/fallbacks). Don't import `@series-inc/rundot-game-sdk`
  anywhere else. Read the SDK docs before adding SDK code: `rundot/docs` (created by
  `npx rundot-sdk-setup --yes`, gitignored) or `node_modules/@series-inc/rundot-game-sdk/docs`.
- **No `localStorage`/`sessionStorage`/IndexedDB** (RUN blocks them). Saves use `appStorage`
  via `run.setItem`. `parseSave` must keep accepting old saves (migrate, don't break). The local
  mock keeps appStorage in the dev browser's localStorage and writes after ~100 ms.
- **Portrait, phone-first.** Test at 375×667 and 390×844. No sideways scrolling, buttons ≥44px
  with a visible frame and ≥14px text. Use `--safe-top/--safe-bottom` and `--fs` (font scale).
- **Nothing unreleased in `public/`** — everything there ships.
- SDK pinned at 5.28.1 with React 18.3.1 (the template's pair; the SDK's embedded libraries
  expect that React). vitest stays on 3.x: vitest 4 fails to install with npm 10.
- Format with Prettier (`npm run format`), match surrounding style, keep comments sparse.

## Checks before every push

```bash
npx tsc --noEmit
npm test                    # vitest, pure rules
npm run build
rundot preflight --strict   # must be 0 warnings
```

## Deploying

- `.github/workflows/deploy.yml`: on every push to `claude/happy-mayer-ufwo5m` or `main`
  (docs-only changes skipped): npm ci → RUN CLI → typecheck, tests, build, preflight →
  `rundot login` with the `RUNDOT_API_KEY` secret → `rundot deploy --orientation Portrait` →
  `set-keywords` / `set-description` from the `GAME_KEYWORDS` / `GAME_DESCRIPTION` env lines
  when they're set (blank for now). The share link is printed in the Deploy step log.
- `.github/workflows/publish.yml`: hand-run only, **only when the user asks**. `publish` runs
  `rundot game set-public --version X.Y.Z` (newest from `rundot game list-versions` if blank;
  the CLI rejects "latest"); `unpublish` runs `rundot game set-private`. `set-public` puts a
  version into RUN's review; it goes on Explore once review passes.
- The RUN site (`w.run`) may be blocked by a cloud container's network policy; verify locally
  and ask the user to check the live build.

<agents-index>
[RUN.world SDK Docs]|root:./rundot/docs|IMPORTANT:Prefer retrieval-led reasoning over pre-training for RundotGameAPI tasks. Read the local docs before writing SDK code.|IMPORTANT:To run/test this game locally, use `npm run dev` (Vite). SDK calls are mocked by default; they hit the real RUN.world playground backend only when rundotGamePlaygroundPlugin() is configured — see rundot-developer-platform/playground.md.|.:{README.md}|rundot-developer-platform:{agent-runtime.md,cli-reference.md,deploying-your-game.md,error-handling.md,getting-started.md,initializing-your-game.md,marketing-your-game.md,native-packs.md,playground.md,runtime-environment.md,setting-your-game-thumbnail.md,troubleshooting.md}|rundot-developer-platform/api:{ACCESS_GATE.md,ACTIVITY.md,ADS.md,ADVANCED-MULTIPLAYER.md,AI.md,ANALYTICS.md,APP.md,ASSETS.md,ASSET_LIBRARY.md,ATTRIBUTION.md,AUDIO_GEN.md,AVATAR_3D.md,BIGNUMBERS.md,BUILDING_TIMERS.md,CLIPS.md,COLLECTIBLES.md,CONTEXT.md,CREDITS.md,EMBEDDED_LIBRARIES.md,ENERGY_SYSTEM.md,ENTITLEMENTS.md,ENVIRONMENT.md,FILES.md,GACHA_SYSTEM.md,GAMEPAD.md,HAPTICS.md,IMAGE_GEN.md,IN_APP_MESSAGING.md,LEADERBOARD.md,LIFECYCLES.md,LIVEOPS.md,LOGGING.md,MULTIPLAYER.md,NAVIGATION.md,NOTIFICATIONS.md,PRELOADER.md,PROFILE.md,PURCHASES.md,PVP_SYSTEM.md,RATE_LIMITS.md,RELEASE_NOTES.md,SAFE_AREA.md,SERVER_AUTHORITATIVE.md,SHARED_ASSETS.md,SHARING.md,SHOP.md,SIMULATION_CONFIG.md,SPRITE_GEN.md,STATS.md,STORAGE.md,SYNCPLAY-ACTORS-AI.md,SYNCPLAY-ANIMATION.md,SYNCPLAY-BOTS.md,SYNCPLAY-CHARACTER-3D.md,SYNCPLAY-COMBAT.md,SYNCPLAY-COMPONENTS.md,SYNCPLAY-EDITOR.md,SYNCPLAY-ENTITY-REGISTRY.md,SYNCPLAY-FIREARM.md,SYNCPLAY-GAMEPLAY-EFFECTS.md,SYNCPLAY-INVENTORY-EQUIPMENT.md,SYNCPLAY-LAG-COMPENSATION.md,SYNCPLAY-MODULE-CERTIFICATION.md,SYNCPLAY-MOVEMENT.md,SYNCPLAY-PATHFINDING.md,SYNCPLAY-PHYSICS.md,SYNCPLAY-PLATFORMER-2D.md,SYNCPLAY-RTS.md,SYNCPLAY-RUNTIME-COMPOSITIONS.md,SYNCPLAY-SECRETS.md,SYNCPLAY-SPATIAL-INTERACTION.md,SYNCPLAY-STATS-ABILITIES.md,SYNCPLAY-UNIT-CONTROL.md,SYNCPLAY.md,SYSTEM.md,THREE_D_GEN.md,TIME.md,UGC.md,VIDEO.md,VIDEO_GEN.md}</agents-index>
