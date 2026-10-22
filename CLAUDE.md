# Mishmash — CLAUDE.md

A game for RUN.world that **the community designs**: players suggest features, everyone votes,
and the winners get built, one update at a time, so it becomes a mishmash of everyone's ideas.
There is no game yet. The first build is the community hub: an intro explaining the idea, a
vote on the base genre and a Town Square chat. Once the base wins, it gets built, and the hub
stays as the place where the next features are suggested and voted on.

Share link (private, unlisted): https://w.run/u/7VPvCLP7URUp69R6K10O/private?k=5ba4a9c6c90a7da7908d7c7dbb35a5f3
(game ID `7VPvCLP7URUp69R6K10O`; end every update to the user with this link)

## The hub

- **Intro** (`screens/Intro.tsx`): full screen on first launch (`save.introSeen`), then the
  About tab. "This game doesn't exist yet" → suggest / vote / we build it → "First up: what
  should Mishmash be at its core?" Its two buttons are pinned under the scrolling text.
- **Vote** (`screens/Vote.tsx`, `game/poll.ts`): `BASE_POLL` (Round 1: pick the base) with 8
  options (Action RPG, Platformer, Story adventure, Roguelike, Survival & crafting, Tower
  defense, Puzzle, Idle tycoon). **One vote per person** (the user's rule): each vote is a UGC
  entry of content type `vote-<poll>-<option>` (`voteType`), and `loadPoll` reads every vote
  entry of the poll (all options in one browse, 100 a page, up to `VOTE_PAGES` 30 pages, so
  exact up to 3,000 entries; revisit past that) and `countVotes` counts only each author's
  newest one, so a second entry (a failed delete, a tampered client) never counts. Refreshed
  every 60 s while the tab is open. Moving a vote creates the new entry, then deletes the old
  one; the player's own extra entries are deleted when found. The buttons stay disabled until
  the player's current vote is known, so the client never makes a second vote blind.
  **Never rename a live poll or option id**: its votes stay under the old content type. To
  close a poll set `open: false`; a new round is a new `Poll` with a new id.
- **Chat** (`screens/Chat.tsx`, `game/chat.ts`): the Town Square. Messages are UGC entries of
  type `chat` (`{ v: 1, text }`, one line, ≤200 characters, `cleanMessage`). Newest 30 every
  15 s while the tab is open (`applyLatest` drops messages the server stopped returning:
  deleted or hidden); "Load older messages" pages back. Text is pre-checked with RUN's filter
  (`ugc.checkTextAsync`) and checked again by the server (`moderationFields: data.text`), which
  may hold a message (it then doesn't show, and the sender is told). Tap a message: **Delete
  only your own** (`ugc.delete`; RUN's server also refuses anyone else's) or Report others'
  (hidden for the reporter at once, auto-hidden for everyone after 3 reports). **Only the
  game's owner (the user) may delete anyone's message** (the user's rule): `isOwner` asks
  `app.getMyRole()` (RUN checks the signed-in account's email against the game owner's) and
  the owner's Delete calls `app.adminUgc.removeEntry` (RUN refuses non-owners/editors; editors
  don't get the button). Removed entries are soft-deleted (`status: 'removed'`). Failures show
  a `Notice` (sign in, slow down, keep it friendly, limit reached).
- **Dev area** (`screens/Dev.tsx`, `game/moderation.ts`): a 🛠️ Dev tab that **only the game's
  owner (the user) sees** (`isOwner` → `app.getMyRole()`, checked by RUN against the account;
  RUN also refuses the admin calls it makes for anyone but the owner and editors). Lists player
  reports grouped per message (`groupReports`: most reported first), with the reported text even
  when the message is hidden (`adminEntries`: `ugc.getMany`, then `app.adminUgc.browse` over the
  newest 500 chat entries for hidden ones), its state (visible / hidden from players / deleted /
  already gone), report count, reasons and notes. Open: **Delete message**
  (`adminUgc.removeEntry`, reports resolved as `reviewed`) or **Keep** (resolved as
  `dismissed`). Resolved: the history. The SDK can't lift an auto-hide (3 reports), so a
  hidden message shows the CLI command (`rundot ugc approve <id>`). The tab shows a badge with
  the number of messages with open reports (`ReportWatch` in App.tsx, every 5 min; the list
  refreshes every 60 s while open).
- **Community data is UGC** (`rundot/ugc.config.json`: 500 entries per player, chat and votes
  combined; 2 KB data; 3 reports hide an entry). UGC needs a RUN sign-in to post (the SDK
  prompts). `src/app/community.ts` holds the chat and vote logic over a `UgcApi`: `run.ugc` in
  the RUN host, `src/app/localUgc.ts` in `npm run dev` (the mock SDK can't store UGC). The
  local stand-in is in memory (resets on reload), seeded with sample players (one voted twice),
  and the screens show a "Local preview" tag; add `?owner` to the dev URL to play the owner.
  It follows the server's rules (own deletes only, 3 reports hide, admin calls need the owner)
  and seeds reports for the Dev area (a hidden spam message, one open, one dismissed).
  Rate limits aren't published; reads back off on `RATE_LIMITED`.
- **Moderation (the user's CLI, needs their RUN login):** `rundot ugc admin reports --status
  pending`, `rundot ugc quarantined`, `rundot ugc approve <id>`, `rundot ugc admin remove <id>`
  (see `rundot/docs/rundot-developer-platform/api/UGC.md`, "CLI Management").

## Ask first

Anything outward-facing needs the user's OK first: making the game public (the Publish
workflow), posting anywhere, changing store listing text beyond the workflow env lines. Never put
the deploy key (`RUNDOT_API_KEY`, `rk_…`) in chat, code or logs.

## Setup status

Setup is done (2026-10-21): the user ran `rundot init` and committed `game.config.prod.json`
(declares portrait), and the `RUNDOT_API_KEY` secret is set, so every push to the game branch
deploys a private build (v1.1.0 was the placeholder). The one-time steps stay in `README.md`.

## Layout

```
src/game/     Pure rules. No SDK, no React, no DOM. Deterministic given inputs + seed.
  save.ts       save JSON parse/repair (SAVE_KEY, SAVE_VERSION; visits, introSeen)
  poll.ts       polls, vote content types, tallies
  chat.ts       message cleaning, validation of entries, merging pages, ages
  moderation.ts reports grouped per message (Dev area)
  *.test.ts     vitest unit tests
src/sdk/run.ts  THE ONLY module that imports the RUN SDK. Waits for start-up, catches everything.
                Also defines the UgcApi contract and `run.ugc` (RUN's UGC).
src/app/        community.ts (chat, votes, Dev area over UgcApi), localUgc.ts (dev stand-in),
                usePolling.ts (refresh while visible, honours rate-limit waits)
src/screens/    Intro (also the About tab), Vote, Chat, Dev (owner only)
src/ui/         Logo (letter tiles), Notice (failure messages)
src/components/ ErrorBoundary
src/App.tsx     save load, first-launch intro, tab bar (Vote / Chat / About / Dev for the owner)
src/main.tsx    entry: safe-area/font-scale CSS vars, lifecycle hooks, render
scripts/playthrough.mjs  Playwright run of the local preview at 375×667 and 390×844
public/thumbnail.jpg   store thumbnail, exported from art/ (exactly 512×512 JPEG, under ~150 KB)
art/thumbnail-source.png  store thumbnail art from the user ("Mishmash · Community Build",
                       Halloween look; full size, not shipped)
scripts/thumbnail.mjs  `npm run thumbnail`: re-exports public/thumbnail.jpg from the art (PIL)
rundot/ugc.config.json UGC limits and moderation
rundot/textGen.config.json  `{ "disabled": true }`: AI text generation is off (unused; without
                       this file every deploy auto-enables it with permissive spend limits)
rundot/cli_hooks.json  RUN CLI hooks (from the template)
game.config.prod.json  RUN game ID + build settings (from `rundot init`; declares portrait)
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
  expect that React). vitest stays on 3.x: vitest 4 fails to install with npm 10. playwright
  stays on 1.56.x, the browser build the cloud container ships (`/opt/pw-browsers`).
- Format with Prettier (`npm run format`), match surrounding style, keep comments sparse.

## Checks before every push

```bash
npx tsc --noEmit
npm test                    # vitest, pure rules
npm run build
rundot preflight --strict   # must be 0 warnings
npm run dev                 # then, in another shell:
npm run playthrough         # Playwright: intro, vote, chat, owner delete + Dev area at 375×667 and
                            # 390×844, must print "clean"
```

The store thumbnail is the user's own art (`art/thumbnail-source.png`); don't replace it without
asking. If the source changes, run `npm run thumbnail` (no dev server needed).

The playthrough only covers the local stand-in; UGC itself only runs in the RUN host, so ask the
user to try chat and voting on the live build after changes there.

## Deploying

- `.github/workflows/deploy.yml`: on every push to `claude/happy-mayer-ufwo5m` or `main`
  (docs-only changes skipped): npm ci → RUN CLI → typecheck, tests, build, preflight →
  `rundot login` with the `RUNDOT_API_KEY` secret → `rundot deploy --orientation Portrait` →
  `set-keywords` / `set-description` from the `GAME_KEYWORDS` / `GAME_DESCRIPTION` env lines
  when they're set. Both are first versions the user wants updated as the game takes shape
  (keywords: community, community-build, player-made, voting, chat, social, multiplayer, casual,
  halloween, spooky, monsters; the last three match the Halloween thumbnail). The share link is
  printed in the Deploy step log.
- `.github/workflows/publish.yml`: hand-run only, **only when the user asks**. `publish` runs
  `rundot game set-public --version X.Y.Z` (newest from `rundot game list-versions` if blank;
  the CLI rejects "latest"); `unpublish` runs `rundot game set-private`. `set-public` puts a
  version into RUN's review; it goes on Explore once review passes.
- The RUN site (`w.run`) may be blocked by a cloud container's network policy; verify locally
  and ask the user to check the live build.

<agents-index>
[RUN.world SDK Docs]|root:./rundot/docs|IMPORTANT:Prefer retrieval-led reasoning over pre-training for RundotGameAPI tasks. Read the local docs before writing SDK code.|IMPORTANT:To run/test this game locally, use `npm run dev` (Vite). SDK calls are mocked by default; they hit the real RUN.world playground backend only when rundotGamePlaygroundPlugin() is configured — see rundot-developer-platform/playground.md.|.:{README.md}|rundot-developer-platform:{agent-runtime.md,cli-reference.md,deploying-your-game.md,error-handling.md,getting-started.md,initializing-your-game.md,marketing-your-game.md,native-packs.md,playground.md,runtime-environment.md,setting-your-game-thumbnail.md,troubleshooting.md}|rundot-developer-platform/api:{ACCESS_GATE.md,ACTIVITY.md,ADS.md,ADVANCED-MULTIPLAYER.md,AI.md,ANALYTICS.md,APP.md,ASSETS.md,ASSET_LIBRARY.md,ATTRIBUTION.md,AUDIO_GEN.md,AVATAR_3D.md,BIGNUMBERS.md,BUILDING_TIMERS.md,CLIPS.md,COLLECTIBLES.md,CONTEXT.md,CREDITS.md,EMBEDDED_LIBRARIES.md,ENERGY_SYSTEM.md,ENTITLEMENTS.md,ENVIRONMENT.md,FILES.md,GACHA_SYSTEM.md,GAMEPAD.md,HAPTICS.md,IMAGE_GEN.md,IN_APP_MESSAGING.md,LEADERBOARD.md,LIFECYCLES.md,LIVEOPS.md,LOGGING.md,MULTIPLAYER.md,NAVIGATION.md,NOTIFICATIONS.md,PRELOADER.md,PROFILE.md,PURCHASES.md,PVP_SYSTEM.md,RATE_LIMITS.md,RELEASE_NOTES.md,SAFE_AREA.md,SERVER_AUTHORITATIVE.md,SHARED_ASSETS.md,SHARING.md,SHOP.md,SIMULATION_CONFIG.md,SPRITE_GEN.md,STATS.md,STORAGE.md,SYNCPLAY-ACTORS-AI.md,SYNCPLAY-ANIMATION.md,SYNCPLAY-BOTS.md,SYNCPLAY-CHARACTER-3D.md,SYNCPLAY-COMBAT.md,SYNCPLAY-COMPONENTS.md,SYNCPLAY-EDITOR.md,SYNCPLAY-ENTITY-REGISTRY.md,SYNCPLAY-FIREARM.md,SYNCPLAY-GAMEPLAY-EFFECTS.md,SYNCPLAY-INVENTORY-EQUIPMENT.md,SYNCPLAY-LAG-COMPENSATION.md,SYNCPLAY-MODULE-CERTIFICATION.md,SYNCPLAY-MOVEMENT.md,SYNCPLAY-PATHFINDING.md,SYNCPLAY-PHYSICS.md,SYNCPLAY-PLATFORMER-2D.md,SYNCPLAY-RTS.md,SYNCPLAY-RUNTIME-COMPOSITIONS.md,SYNCPLAY-SECRETS.md,SYNCPLAY-SPATIAL-INTERACTION.md,SYNCPLAY-STATS-ABILITIES.md,SYNCPLAY-UNIT-CONTROL.md,SYNCPLAY.md,SYSTEM.md,THREE_D_GEN.md,TIME.md,UGC.md,VIDEO.md,VIDEO_GEN.md}</agents-index>
