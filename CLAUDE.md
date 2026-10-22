# Mishmash — CLAUDE.md

A game for RUN.world that **the community designs**: players suggest features, everyone votes,
and the winners get built, one update at a time, so it becomes a mishmash of everyone's ideas.
Round 1 (the base genre) got no votes, so the user picked the base: **Bloom Island**, a 2.5D
survival / crafting / horror game (a small 7 Days to Die with an escape-room chain) where your
plane crashes on a big island and the other passengers turn into walking plants (the Bloom).
Around it sits the community hub: the Play tab, a Round 2 vote on what to add next, the Town
Square chat, About, and the owner's Dev area.

Share link (private, unlisted): https://w.run/rhuneark/mishmash?tag=private&k=5ba4a9c6c90a7da7908d7c7dbb35a5f3
(the format the deploy prints since v1.8.0; older builds printed
https://w.run/u/7VPvCLP7URUp69R6K10O/private?k=…; game ID `7VPvCLP7URUp69R6K10O`; end every
update to the user with this link)

## The hub

- **Tabs** (`App.tsx`): Play (default), Vote, Chat, About, Dev (owner only). While a game runs
  the tab bar is gone (`Game` full screen).
- **Intro** (`screens/Intro.tsx`): full screen on first launch (`save.introSeen`), then the
  About tab. "A game the players build" → it starts as a survival game → suggest / vote / we
  build it → "Now voting: what to add next". Buttons (pinned under the text): Play, Vote on
  what's next, Say hi in chat.
- **Play** (`screens/Play.tsx`): Continue · Day N (or Start surviving), New island (confirm:
  replaces the save), Play with friends (host my island), Join a friend (room code).
- **Vote** (`screens/Vote.tsx`, `game/poll.ts`): shows `CURRENT_POLL` = `NEXT_POLL` (id
  `next1`, Round 2: what gets added next: boats, farming, pets, weather, ranged weapons, new
  monsters, bigger bases, puzzles & secrets) under a "Round 1 is closed" card. `BASE_POLL`
  (Round 1) is closed (`open: false`) and kept so its votes keep counting the same way.
  **One vote per person** (the user's rule): each vote is a UGC entry of content type
  `vote-<poll>-<option>` (`voteType`), and `loadPoll` reads every vote entry of the poll (all
  options in one browse, 100 a page, up to `VOTE_PAGES` 30 pages, so exact up to 3,000
  entries; revisit past that) and `countVotes` counts only each author's newest one, so a
  second entry (a failed delete, a tampered client) never counts. Refreshed every 60 s while
  the tab is open. Moving a vote creates the new entry, then deletes the old one; the
  player's own extra entries are deleted when found. The buttons stay disabled until the
  player's current vote is known, so the client never makes a second vote blind.
  **Never rename a live poll or option id**: its votes stay under the old content type. To
  close a poll set `open: false`; a new round is a new `Poll` with a new id (point
  `CURRENT_POLL` at it). When a round's winner is built, say so on the Vote tab and in About.
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

## Bloom Island (the game)

Portrait 2.5D: a tilted perspective camera (`view.ts`, ~60°, looks a little north of the
survivor) over a flat-shaded low-poly island. Everything is procedural (no art files).

- **World** (`game/world.ts`): `generateIsland(seed)` builds the same island on every device
  and on the room server: a 1024 m square, heightmap every 2 m (`CELL`), island radius ~400 m
  with noisy coasts, a mountain in the north-east (`PEAK`, radio tower), a marsh in the east
  (`BOG`, Kessler Station), biomes (beach, meadow, jungle, pine forest, highlands, marsh),
  freshwater pools, landmark colliders and ~12k harvestable nodes. **Only integer hashes and
  + - * floor in generation** (`rng.ts`, `noise.ts`): no `Math.sin`/`cos`/`exp`, which can
  differ between JS engines. Node ids are indices sorted by 32 m chunk (`chunkStart`), so
  "node 1234" means the same tree everywhere. `scripts/islandmap.ts` draws a seed to a PNG.
- **Authority** (`game/sim/sim.ts` `IslandSim`, `mobs.ts`): owns everything shared (node
  damage/regrowth, buildings, drops, monsters, flags, notes, rescue) and every player's stats
  and inventory. Players only report their position (`pos`, speed-clamped to `MAX_SPEED`);
  every other action is a message the authority checks (reach, tools, materials, cooldowns).
  The same class runs in-process for solo (`play/link.ts` `LocalLink`, 10 Hz, autosave 30 s
  and on pause) and in the co-op room (`server/IslandRoom.ts`). Messages: `sim/protocol.ts`
  (`C2S`/`S2C`; never a field named `type` inside data). Monsters within 70 m of a player are
  sent in each tick (`VIEW`).
- **Survival**: health, food, water (`FOOD_DECAY`, `WATER_DECAY`); starving/thirst/poison hurt;
  you heal slowly when fed and faster by a lit campfire. A day is 10 minutes (`sim/time.ts`:
  6 day, 4 night); every 7th night is a **Bloom night** (`BLOOM_EVERY`): bigger, enraged
  hordes that ignore fire. Dying drops your bag where you fell (2 days); you wake at your
  bedroll or the crash site.
- **Content tables** (`game/content/`): `items.ts` (materials, food, medicine, tools, weapons,
  torch, fire bomb, placeables, quest parts), `recipes.ts` (by hand / at a lit campfire / at a
  workbench), `nodes.ts` (trees, bushes, rocks, branches, wreckage, suitcases, Bloom vines),
  `buildings.ts` (campfire with fuel, workbench, walls, door, stone wall, spikes, torch post,
  storage box, bedroll, rain collector), `monsters.ts` (Husk = a taken passenger, Snapjaw =
  rooted biting flower, Puffer = spore sac that bursts into poison, Thornback = fast heavy
  crawler, the Mother Bloom = boss, crabs), `pois.ts` (landmarks, colliders, interactive
  spots), `notes.ts` (lore notes, the cargo code).
- **Monsters** (`sim/mobs.ts`): the director (every 1 s) spawns roamers near players by
  biome, day/night and Bloom night, wakes rooted Snapjaws within 45 m, grows the Mother
  Bloom at Kessler Station within 75 m (her HP is kept when she despawns), crabs on beaches.
  Fire-fearing ones stop at the edge of firelight unless enraged; they break walls in their
  way; spikes hurt them; fire bombs and torches set them burning. At dawn the night's roamers
  burrow.
- **The way off** (`game/objectives.ts` turns flags + notes + what you carry into the
  checklist the HUD and journal show): boarding pass at the crash site → captain's log at the
  cockpit (north-west) reveals three parts: **battery** in the tail's cargo hold (west), code
  from 4 luggage tags around the crash site (`cargoCode(seed)`, keypad); **antenna** on the
  radio tower (cut 5 Bloom vines with a machete, then climb); **transmitter** in the Mother
  Bloom's remains. Build the radio at a workbench, use the beacon by the tower: 3 minutes of
  enraged waves (`RESCUE_SECONDS`), then the helicopter waits 2 minutes (`HELI_WAIT`) on the
  helipad. Board it to win; if it leaves, call again.
- **Client** (`play/client.ts` `GameClient`): mirrors the authority, moves the local survivor
  (collision with trees/rocks, landmark boxes, blocking buildings, deep water; stamina and
  sprint), picks what the action button does (`findTarget`: hostile monster in reach first,
  then the best of nodes / buildings / spots / bags / water, facing and usefulness weighted),
  the build preview (`ghost`, `placementProblem` shared with the authority) and the HUD state
  (`useSyncExternalStore` over `version`, bumped at most once a frame).
- **Rendering** (`play/view.ts`, `play/render/`): chunked terrain (`terrain.ts`), one
  InstancedMesh per node type (`nodes.ts`; trees between the camera and the survivor turn
  see-through), procedural rigs for survivors and the Bloom (`actors.ts`), buildings and
  landmarks (`structures.ts`), particles/rings/damage numbers (`fx.ts`), day/night lighting
  with fog, 4 pooled point lights for fires and torches. `three` is the host's embedded copy
  (exact `0.183.2`, no addons). Sound is made on the fly with WebAudio (`play/audio.ts`).
- **HUD** (`play/hud/`): stat bars, clock, objective, minimap (fog of war, `map.ts` `Fog`,
  saved per island under `mishmash_fog`), journal (objectives, notes, cargo code so far,
  tips), map, bag + crafting, storage box, keypad, menu (room code, sound, how to play,
  leave), death and win screens. Floating joystick on the left half; keyboard on desktop
  (WASD/arrows, Shift, Space/E, 1–6, I/C/J/M/R, Esc).
- **Saves**: your island is one JSON in appStorage (`mishmash_island`, `IslandSave` v1,
  `parseIslandSave` repairs untrusted data; keep it accepting old saves). The player key is the
  RUN profile id (the same id the room uses), so your survivor is the same solo and hosting.
- **Co-op** (`play/roomLink.ts`, `server/IslandRoom.ts`, `rundot/realtime.config.json`, room
  type `island`, 4 players, reconnect 60 s). The host creates a room and uploads their island
  save (`init` parts); the room runs `IslandSim` at 10 Hz and sends the save back to the host
  every 60 s and when they leave (`bye`), so the host keeps the progress; friends join with
  the room code and their survivor lives in the host's save. Realtime needs a RUN sign-in (the
  SDK prompts). `npm run dev` runs a local room server (port 9001).
- **Dev hook**: in dev builds `window.__game = { client, input }` (the playthrough uses it;
  solo `client.link.sim` is the authority itself).

## Adding to the game (community features)

Most features are data first, then a little code:

- **New item**: add it to `content/items.ts` (an emoji icon, stack size, and `tool` / `weapon`
  / `food` / `heal` / `place` / `throwable` as needed), a recipe in `content/recipes.ts`
  and/or a drop in `content/nodes.ts` / `monsters.ts`. Inventory, crafting UI, hotbar, eating
  and the authority's checks pick it up. A held model is optional (`render/items.ts`).
- **New building**: `content/buildings.ts` (footprint, hp, blocks, light, station, thorns), an
  item with `place`, a model in `render/structures.ts` `buildingModel`, and behaviour in
  `sim.ts` (`useBuilding`, `updateBuildings`) plus its action label in `client.ts`
  `buildingTarget`.
- **New monster**: `content/monsters.ts` (+ `MOB_KINDS` in `sim/protocol.ts`: append, never
  reorder), a rig in `render/actors.ts`, behaviour in `sim/mobs.ts` (walkers reuse `walker`),
  spawn rules in `runDirector`, a name in `client.ts` `MOB_NAMES`.
- **New node / resource**: `content/nodes.ts` (append to `NODE`, never reorder: ids are
  saved), scatter rules in `world.ts` `NODE_TABLE`, geometry in `render/props.ts`.
- **New landmark or puzzle**: a `PoiDef` in `content/pois.ts` (boxes = colliders, spots =
  interactions), its model in `render/structures.ts` `poiStructure`, spot behaviour in
  `sim.ts` `useSpot` and labels in `client.ts` `spotTarget`, objectives in `objectives.ts`.
  Moving a POI or changing generation changes every island: existing saves keep their seed
  but nodes/colliders move, so treat generation changes as a new world (bump `IslandSave.v`
  with a migration or start players on a new island).
- Keep the authority authoritative: the client may predict, but only `IslandSim` grants items.
  Add unit tests in `game/sim/sim.test.ts` and extend `scripts/playthrough.mjs`.

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
src/game/          Pure rules. No SDK, no React, no DOM. Deterministic given inputs + seed.
  save.ts            hub save (SAVE_KEY, SAVE_VERSION; visits, introSeen)
  poll.ts            polls, vote content types, tallies (BASE_POLL closed, NEXT_POLL current)
  chat.ts            message cleaning, validation of entries, merging pages, ages
  moderation.ts      reports grouped per message (Dev area)
  rng.ts, noise.ts   seeded hashes and value noise (engine-independent)
  world.ts           island generation and queries (heights, biomes, nodes, colliders, pools)
  objectives.ts      the escape checklist from flags/notes/inventory
  content/           items, recipes, nodes, buildings, monsters, landmarks (pois), notes
  sim/               the island authority: sim.ts (IslandSim), mobs.ts (monsters, director),
                     protocol.ts (messages), types.ts (save format, collision helpers),
                     inventory.ts, place.ts (build rules), time.ts (day/night)
  *.test.ts          vitest unit tests
src/sdk/run.ts     THE ONLY client module that imports the RUN SDK. Waits for start-up,
                   catches everything. UgcApi + run.ugc, realtime rooms (createRoom/joinRoom).
src/server/IslandRoom.ts  co-op GameRoom (imports the SDK's mp-server; runs IslandSim)
src/play/          the game client: session.ts (solo/host/join, saves), link.ts (LocalLink),
                   roomLink.ts, client.ts (GameClient), input.ts, audio.ts, view.ts (scene),
                   Game.tsx (canvas, frame loop), render/ (terrain, nodes, actors,
                   structures, items, props, fx, geo), hud/ (Hud, Panels, MapView, map)
src/app/           community.ts (chat, votes, Dev area over UgcApi), localUgc.ts (dev stand-in),
                   usePolling.ts, appEvents.ts (host lifecycle → game pause/resume)
src/screens/       Play, Intro (also the About tab), Vote, Chat, Dev (owner only)
src/ui/            Logo (letter tiles), Notice (failure messages)
src/components/    ErrorBoundary
src/App.tsx        hub save, first-launch intro, tab bar, starts/leaves games
src/main.tsx       entry: safe-area/font-scale CSS vars, lifecycle hooks, render
scripts/playthrough.mjs  Playwright: hub + solo game + co-op at 375×667 and 390×844
scripts/islandmap.ts     `npx tsx scripts/islandmap.ts <seed> <out.png>`
public/thumbnail.jpg     store thumbnail, exported from art/ (exactly 512×512 JPEG, < ~150 KB)
art/thumbnail-source.png store thumbnail art from the user ("Mishmash · Community Build",
                         Halloween look; full size, not shipped)
scripts/thumbnail.mjs    `npm run thumbnail`: re-exports public/thumbnail.jpg from the art (PIL)
rundot/realtime.config.json  room type `island` → src/server/IslandRoom.ts (max 4 players)
rundot/ugc.config.json   UGC limits and moderation
rundot/textGen.config.json  `{ "disabled": true }`: AI text generation is off (unused; without
                         this file every deploy auto-enables it with permissive spend limits)
rundot/cli_hooks.json    RUN CLI hooks (from the template)
game.config.prod.json    RUN game ID + build settings (from `rundot init`; declares portrait)
```

Built on `series-inc/run-template-2d-react` (same base as the user's other RUN game, The Dood).

## Conventions

- **Rules stay pure** in `src/game`: no SDK calls, no React, no `Date.now()`/`Math.random()`
  inside rules (pass `now`/seeds in).
- **The island is the same everywhere**: world generation and the authority are shared by
  phones and the room server; no engine-dependent math in generation, no `Math.random()` in
  the authority (it takes a `random` function).
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
- `three` pinned at exactly 0.183.2 (the host's embedded copy; `@types/three` ~0.183.1).
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
npm run playthrough         # Playwright at 375×667 and 390×844: hub (intro, vote, chat, owner
                            # delete, Dev area), the game (walk, read, gather, craft, build, night
                            # fight, death, save/continue) and local co-op; must print "clean"
```

The store thumbnail is the user's own art (`art/thumbnail-source.png`); don't replace it without
asking. If the source changes, run `npm run thumbnail` (no dev server needed).

The playthrough only covers the local stand-in; UGC itself only runs in the RUN host, so ask the
user to try chat and voting on the live build after changes there. Same for co-op: the local
room server is close to RUN's, but ask the user to try hosting and joining on the live build.
Headless WebGL is SwiftShader (~10 fps): fine for checks, not for judging performance.

## Deploying

- `.github/workflows/deploy.yml`: on every push to `claude/happy-mayer-ufwo5m` or `main`
  (docs-only changes skipped): npm ci → RUN CLI → typecheck, tests, build, preflight →
  `rundot login` with the `RUNDOT_API_KEY` secret → `rundot deploy --orientation Portrait` →
  `set-keywords` / `set-description` from the `GAME_KEYWORDS` / `GAME_DESCRIPTION` env lines
  when they're set. The user wants them updated as the game takes shape; since the survival
  game (2026-10-22) they describe Bloom Island (keywords: survival, crafting, base-building,
  horror, island, co-op, multiplayer, open-world, exploration, monsters, community-build,
  voting, halloween, spooky; the last two match the Halloween thumbnail). The share link is
  printed in the Deploy step log.
- `.github/workflows/publish.yml`: hand-run only, **only when the user asks**. `publish` runs
  `rundot game set-public --version X.Y.Z` (newest from `rundot game list-versions` if blank;
  the CLI rejects "latest"); `unpublish` runs `rundot game set-private`. `set-public` puts a
  version into RUN's review; it goes on Explore once review passes. GitHub only registered this
  workflow after a later push touched it (dispatching it 404'd before).
- **Going public:** v1.7.0 (the hub, Dev area, thumbnail, tags) was submitted with the Publish
  workflow on 2026-10-22 at the user's request. Pushes after that still deploy private builds
  (the share link opens the newest); Explore only gets a newer version when the Publish
  workflow runs again, and only when the user asks. Server config (UGC limits, textGen off,
  realtime rooms) reaches public players with each publish. The survival game (v1.8.0,
  2026-10-22) is private until the user asks to publish it.
- The RUN site (`w.run`) may be blocked by a cloud container's network policy; verify locally
  and ask the user to check the live build.

<agents-index>
[RUN.world SDK Docs]|root:./rundot/docs|IMPORTANT:Prefer retrieval-led reasoning over pre-training for RundotGameAPI tasks. Read the local docs before writing SDK code.|IMPORTANT:To run/test this game locally, use `npm run dev` (Vite). SDK calls are mocked by default; they hit the real RUN.world playground backend only when rundotGamePlaygroundPlugin() is configured — see rundot-developer-platform/playground.md.|.:{README.md}|rundot-developer-platform:{agent-runtime.md,cli-reference.md,deploying-your-game.md,error-handling.md,getting-started.md,initializing-your-game.md,marketing-your-game.md,native-packs.md,playground.md,runtime-environment.md,setting-your-game-thumbnail.md,troubleshooting.md}|rundot-developer-platform/api:{ACCESS_GATE.md,ACTIVITY.md,ADS.md,ADVANCED-MULTIPLAYER.md,AI.md,ANALYTICS.md,APP.md,ASSETS.md,ASSET_LIBRARY.md,ATTRIBUTION.md,AUDIO_GEN.md,AVATAR_3D.md,BIGNUMBERS.md,BUILDING_TIMERS.md,CLIPS.md,COLLECTIBLES.md,CONTEXT.md,CREDITS.md,EMBEDDED_LIBRARIES.md,ENERGY_SYSTEM.md,ENTITLEMENTS.md,ENVIRONMENT.md,FILES.md,GACHA_SYSTEM.md,GAMEPAD.md,HAPTICS.md,IMAGE_GEN.md,IN_APP_MESSAGING.md,LEADERBOARD.md,LIFECYCLES.md,LIVEOPS.md,LOGGING.md,MULTIPLAYER.md,NAVIGATION.md,NOTIFICATIONS.md,PRELOADER.md,PROFILE.md,PURCHASES.md,PVP_SYSTEM.md,RATE_LIMITS.md,RELEASE_NOTES.md,SAFE_AREA.md,SERVER_AUTHORITATIVE.md,SHARED_ASSETS.md,SHARING.md,SHOP.md,SIMULATION_CONFIG.md,SPRITE_GEN.md,STATS.md,STORAGE.md,SYNCPLAY-ACTORS-AI.md,SYNCPLAY-ANIMATION.md,SYNCPLAY-BOTS.md,SYNCPLAY-CHARACTER-3D.md,SYNCPLAY-COMBAT.md,SYNCPLAY-COMPONENTS.md,SYNCPLAY-EDITOR.md,SYNCPLAY-ENTITY-REGISTRY.md,SYNCPLAY-FIREARM.md,SYNCPLAY-GAMEPLAY-EFFECTS.md,SYNCPLAY-INVENTORY-EQUIPMENT.md,SYNCPLAY-LAG-COMPENSATION.md,SYNCPLAY-MODULE-CERTIFICATION.md,SYNCPLAY-MOVEMENT.md,SYNCPLAY-PATHFINDING.md,SYNCPLAY-PHYSICS.md,SYNCPLAY-PLATFORMER-2D.md,SYNCPLAY-RTS.md,SYNCPLAY-RUNTIME-COMPOSITIONS.md,SYNCPLAY-SECRETS.md,SYNCPLAY-SPATIAL-INTERACTION.md,SYNCPLAY-STATS-ABILITIES.md,SYNCPLAY-UNIT-CONTROL.md,SYNCPLAY.md,SYSTEM.md,THREE_D_GEN.md,TIME.md,UGC.md,VIDEO.md,VIDEO_GEN.md}</agents-index>
