# Bloom Island (repo: Mishmash) — CLAUDE.md

**The game is called Bloom Island** (since 2026-10-23: store name, logo, page title; the repo,
save keys and code still say Mishmash, keep those). A game for RUN.world that **the community
designs**: players suggest features, everyone votes,
and the winners get built, one update at a time, so it becomes a mishmash of everyone's ideas.
Round 1 (the base genre) got no votes, so the user picked the base: **Bloom Island**, a 2.5D
survival / crafting / horror game (a small 7 Days to Die with an escape-room chain) where your
plane crashes on a big island and the other passengers turn into walking plants (the Bloom).
Around it sits the community hub: the Play tab, a Round 2 vote on what to add next, the Town
Square chat, About, and the owner's Dev area.

Share link (private, unlisted): https://w.run/rhuneark/bloom-island?tag=private&k=5ba4a9c6c90a7da7908d7c7dbb35a5f3
(since the rename to Bloom Island, v1.15.0; before that the slug was `mishmash`, same key;
the format the deploy prints since v1.8.0; older builds printed
https://w.run/u/7VPvCLP7URUp69R6K10O/private?k=…; game ID `7VPvCLP7URUp69R6K10O`; end every
update to the user with this link)

## The hub

- **Tabs** (`App.tsx`): Play (default), Vote, Chat, About, Dev (owner only). While a game runs
  the tab bar is gone (`Game` full screen).
- **Intro** (`screens/Intro.tsx`): full screen on first launch (`save.introSeen`), then the
  About tab. "A game the players build" → it starts as a survival game → suggest / vote / we
  build it → "Now voting: what to add next". Buttons (pinned under the text): Play, Vote on
  what's next, Say hi in chat.
- **Play** (`screens/Play.tsx`): a game title screen. Behind the menu your saved island turns
  slowly around the crash site (`play/TitleScene.ts`: the game's own terrain, nodes, grass and
  landmarks, 30 fps, gives the WebGL context back on unmount; no save: an autumn showcase
  island). Buttons: Continue (island name · Day N) or Start surviving, New island, Play with
  friends (host my island), Join a friend (room code), ⚙️ Settings (the game's settings panel
  without the key list), ❓ How to play, 🎃 Vote for us in October Jam, and Vote on what gets
  added next. **New island** (`screens/NewIsland.tsx`): map preview, name and code, 🎲
  Surprise me / Same kind, new island, climate, terrain, layout (quarter turns + mirror), an
  island code box, then the world rules (`hud/RulesPanel.tsx`); starting asks before it
  replaces a save. The win screen's New island lands here too (`App` `wantNew`).
- **October Jam button** (`app/links.ts`): RUN runs the game in a sandbox without
  `allow-popups` and the SDK has no call to open an outside page (preflight fails on
  `window.open` as critical), so the button copies `JAM_URL`
  (`https://run.world/jams/octoberjam?game=7VPvCLP7URUp69R6K10O`) and shows it to copy by
  hand.
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
  **Don't build a ballot option before it wins** (weather, boats, farming, pets, ranged
  weapons, new monsters, bigger bases, puzzles & secrets): the vote decides those.
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

Portrait 2.5D over a flat-shaded low-poly island. Everything is procedural (no art files).

- **Camera** (`view.ts`, `settings.ts` `cameraRig`): **isometric** by default, like Project
  Zomboid: it stands south-west of the survivor, 40° down, with a narrow 30° lens, so up on
  screen is north-east. Settings › Screen › Camera angle switches to **top-down** (north up,
  ~62° down, 48° lens). It looks a little ahead (`ahead`) so the survivor sits below the HUD's
  top rows. The stick and keys are screen directions turned onto the island
  (`screenToWorld`, `view.toWorld` in Game's frame loop); trees on the camera's side turn
  see-through (`nodes.update` `toCam`); fog is measured from the camera's distance; the
  minimap turns to match (`rot`, an N on its rim; the full map stays north up). Directions in
  toasts and objectives are compass directions.
- **Islands from parts** (`game/islands.ts`): an island is a seed plus `IslandParts`: layout
  `turn` (0–3 quarter turns) and `mirror`, `climate` (tropic, autumn, misty pines, volcanic,
  overgrown) and `terrain` (classic/Rolling, rugged coast, islets, highlands, wetlands): 200
  kinds × every seed. `CLASSIC` parts give exactly the island the seed always gave (the
  fingerprint test in `world.test.ts` guards it), so old saves keep theirs. A turned island is
  generated in layout space (`unplace` each grid point: quarter turns and mirrors map the 2 m
  grid onto itself), landmarks are laid out with `layoutPois` (box angles turn too), the spawn,
  tower vines and the Mother's spot go through `place`. Climates change biome thresholds, plant
  odds and Snapjaws (`climateGen`) and repaint the island (`play/render/climate.ts`
  `climateLook`: ground, plant colours via `nodeGeometries(plants)`, grass, sky, sea, fog, map);
  terrain styles change the coast and add islets, hills or bogs (`terrainGen`). Direction words
  in notes and objectives turn with the layout (`turnDirections`), and the lore's "every seventh
  night" follows the rules (`noteText(…, world)`, `bloomOrdinal`). `specCode` ("AU-I1M-4242":
  climate, terrain, turn, M, seed) shares an island; `islandName` names it. Landmark models
  are built in the classic layout and turned/mirrored by their group (`buildPois`). Islands are
  generated on the client from the snapshot's `island` parts (`session.islandFor`, the last one
  cached) and on the room server from the save.
- **World rules** (`game/rules.ts`, 7 Days to Die style), picked on the New island screen and
  kept in the save (`IslandSave.rules`; the snapshot sends them, so guests play by the host's
  rules): difficulty (Bloom damage to you), hunger, what you drop when you fall (everything /
  toolbelt = hotbar / backpack = the rest / nothing / delete), infinite stacks (`stackLimit`,
  passed as a parameter, never global: one room server runs many rooms), monster speed by day
  and by night, Bloom night every N (0 = never; `dayInfo(t, every)`), how many roam
  (`monsterScale`), their damage to buildings, your damage to nodes, yield, world events, map
  markers (all / landmarks / only you, `MapView`), connected storage (`sharedChests`: every box
  shows `sim.chest`, `CHEST_SLOTS` 48, saved as `IslandSave.chest`) and craft from storage
  (`craftFromChests`: `removeFrom` takes from the bag first, client `craftCount`). Presets:
  Relaxed, Survivor (the defaults), Nightmare. The pause menu's 🏝️ This island page shows the
  name, code and rules.
- **World** (`game/world.ts`): `generateIsland(seed, parts)` builds the same island on every device
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
  spots), `notes.ts` (lore notes, research pages, the cargo code).
- **Lore** (`content/notes.ts`, header comment has the whole story): under the marsh lives
  one root colony, "Specimen M"; Verdance Biotech's Kessler Station studied it (Project
  Perennial: its sap heals, and it makes the dead walk). It took the staff (Husks), their guard
  dogs (Thornbacks); Snapjaws grow where the dead lay down, Puffers are its seed pods. Verdance
  ordered the island kept dark, so the relay on the peak jams every signal: that is what
  brought Flight MX207 down. Every seventh night the colony blooms and fears nothing. Told by
  notes at the landmarks (spot notes in `pois.ts`) and by **Dr. Kessler's 8 research pages**
  (`PAGES`): a Husk killed by a player drops the next unfound page 30% of the time
  (`PAGE_CHANCE`, `IslandSim.findPage`); found pages are shared progress in `notes` (ids
  `page_1`…) and listed in the journal. Spot notes must not change world generation: adding a
  spot to an existing POI is safe (generation only reads `x/z/flat/boxes`).
- **Monster parts and the Mashbench**: Husks drop tendrils, Snapjaws teeth, Puffers spore sacs
  (only if killed before they burst), Thornbacks thorn plates, the Mother Bloom her heart (in
  her remains bag). The Mashbench (built at a workbench; crafting station `'mash'`) makes:
  Jawblade (fast weapon that also cuts vines), Thornmaul (heavy weapon), spore bombs (wide
  rot cloud, fx `spore`), petal mask (held: roaming monsters only notice you within
  `STEALTH_RANGE`, never on Bloom nights; wears out while held, `wears`), Bloom tonic (heal),
  thorn wall (tough, cuts), snap trap (`trap`: bites, holds a monster `heldUntil`, re-arms;
  `b.v` = seconds until armed) and the heart lantern (`repels`: nothing of the Bloom enters
  its light, not even enraged hordes; `IslandSim.repelAt`). Tendrils also twist into rope.
- **World events** (`sim/events.ts`, `runEvents` once a second): every 3.5–6.5 minutes
  (`EVENT_GAP`; first one 150 s into a new island, `IslandSave.nextEvent`) something happens near
  a random survivor, announced to everyone with distance and direction (`compass`): **wreckage
  washes up** on a beach (a `crate` drop, `WRECK_LOOT`, 1.5 days), a **Verdance supply pod**
  falls (fx `podfall`, lands `POD_FALL` 4 s later with fx `land`, hurts anyone under it, a `pod`
  drop with `POD_LOOT`, 2 days; the crash wakes 2–5 monsters that guard it; lore: Verdance's
  drones still resupply the station), or by day from day 2 a **pack of Husks** (+ a Thornback
  from day 5) heads for where you stood (`Mob.goal`). Drops carry `kind` (`bag`/`crate`/`pod`, missing = bag); crates
  and pods show on the minimap (on its rim when further) and map. `pickEvent` picks by time of
  day; nothing happens during the rescue. Events never change world generation.
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
- **Auto tool / auto weapon** (`client.ts` `autoChoice`/`autoEquip`/`autoRestore`, ranking in
  `inventory.ts` `bestSlot`/`jobScore`/`weaponScore`): before a swing at a node that needs a
  tool, or at a hostile monster, the client takes out the best tool (power) or weapon (dps ×
  reach, a clear 15% step up) from the hotbar (`select`) or the bag (swapped into your hand with
  `move`, mirrored at once), and `AUTO_BACK` 1.8 s after the last swing switches back (the bag
  swap is undone). A manual select or move cancels it. Target picking counts bag tools as in
  hand; the action label shows the tool's picture (`actionLabel().item`). Settings toggles:
  Auto tool, Auto weapon, Switch back (`client.auto`, set by Game).
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
  (exact `0.183.2`, no addons). `view.configure` applies the settings (camera distance, shake,
  damage numbers, quality: `settings.ts` `graphicsFor`).
- **Making it feel alive** (all client-side, nothing synced): trees, bushes and vines sway
  (`render/wind.ts` `windy()`: vertex-shader sway, one shared time uniform); grass chunks around
  you that sway and part as you walk (`render/ambient.ts`, deterministic per 32 m chunk, not on
  landmarks; density by quality); birds pecking in meadows and on beaches that scatter when you
  or a monster come close or something loud happens (`ambient.scare`), flocks passing over,
  butterflies by day, fireflies at night, pink spores on Bloom nights; felled trees topple away
  from you and crash (`view.felled`, client `node` fx with `fell`), rocks and wreckage
  crumble; dust or splashes at your feet; "+3 Wood" popups with the item picture over your
  head (client diffs your bag: `gain` fx; the authority no longer toasts what you gathered);
  the camera leads where you walk, pulls back a little when sprinting or in a fight, shakes on
  hits and blasts, with a 60 ms hit-stop when your blow lands; crates, smoking supply pods.
  Vibration through `run.haptic` (`prefs.buzz`, Settings › Screen › Vibration).
- **Sound** (`play/audio.ts`, made on the fly with WebAudio): effects, ambience (wind, night
  drone) and music each have a bus under a master gain (`setVolumes`, sliders curved by
  `settings.gain`). **Music** (`play/music.ts`): generated chords and a plucked melody with
  reverb and echo; day = major and busy, night = minor and sparse, Bloom nights = a dissonant
  drone, and drums rise with `view.danger` (hostile monsters close and active, the Mother
  near) and during the rescue call.
- **HUD** (`play/hud/`): stat bars, clock, objective, minimap (fog of war, `map.ts` `Fog`,
  saved per island under `mishmash_fog`), journal (objectives, notes, cargo code so far,
  Kessler pages, tips), map, bag + crafting sheet, storage box, keypad, pause menu, death and
  win screens. Floating joystick on the left half (touch only: a mouse clicks the island
  through it).
- **Pause menu** (`hud/Menu.tsx`, ☰ or Esc; `client.menuPage`: main / settings / friends /
  howto / island): Resume, Settings, Journal, Map, Play with friends (room code), This island,
  How to play, Save and quit. Solo play pauses while it's open (`link.pause`, also when the app is in the background).
  **Settings** (`SettingsPanel`, tabs): Gameplay (auto tool, auto weapon, switch back), Audio
  (master, effects, ambience, music), Screen (phones: portrait/landscape + turn the other way,
  left-handed; button size, camera distance, shake, damage numbers, vibration), Graphics
  (quality auto/low/medium/high, grass and wildlife, FPS), Controls (key list). Settings live
  in `play/settings.ts` (pure: `parseSettings` repairs saved data) and `play/prefs.ts` (store,
  `usePrefs`, saved in appStorage under `mishmash_settings` 0.4 s after a change, loaded at
  start-up in `main.tsx`).
- **Landscape on phones** (`play/screen.ts`, Game.tsx): RUN locks the game upright, so
  Settings › Screen › Landscape turns the whole `.game` a quarter turn (`rotationFor`,
  clockwise; "turn the other way" anticlockwise) when the screen is upright and the device is
  touch; the player turns the phone. Pointer points go through `toLocal` (joystick, drag ghost;
  `elementFromPoint` keeps screen points), safe areas turn with it (`turnInsets`, all four
  `--safe-*` set on `.game`). `.game.landscape` (any wide game, turned or not) has its own HUD
  layout (stats and minimap in a row, smaller hotbar); `.lefty` swaps stick and buttons; `.hud-small/large` scale the button
  groups. `.game` is a size container (`cqw`/`cqh` for the full map).
- **Item pictures** (`hud/itemIcons.ts`): every item is a small SVG (48×48, flat colours,
  dark outline) shown as a data-URL `<img>` (`Slots.tsx` `ItemIcon`). Not emoji: newer emoji
  (wood, rock, rope…) are empty boxes on older phones and Windows. `itemIcons.test.ts`
  fails when an item has no picture. The `icon` emoji in `items.ts` is unused by the HUD.
- **Bag and craft window** (`hud/QuickPanel.tsx`, the 🎒 button, Tab, I/B or C on PC): pops
  up above and to the right of the survivor's head and stays open while you move, fight and
  gather (`client.quickOpen`, not a modal `panel`): the bag (slots 6–23; the hotbar is right
  below) and a craft list sorted craftable-first, with the station each recipe needs. Using a
  workbench/Mashbench opens it on Craft; ⤢ opens the full sheets. `QuickWindow` places it from
  `client.anchor` (the head's spot on screen when standing still, `view.updateAnchor`; it only
  moves when the camera or the screen changes): 312 px wide, kept on screen, below the minimap
  when upright, clear of the action buttons when sideways, with a tail pointing at the
  survivor. Big banners show as toasts while it's open. Craft lists refresh when a station
  comes into reach (`stationKey` in `client.update`).
- **Drag and drop** (`hud/drag.ts`, `Slots.tsx` `SlotButton`/`dropItem`/`DragLayer`):
  pointer events, so mouse and touch both work. Slots carry `data-slot="inv:N"` / `"box:N"`;
  drop on another slot (move/merge/swap; into or out of a storage box at that slot: `store`
  / `take` with `to`, `transfer` in `inventory.ts`) or on the island (canvas) to drop it as a
  bag (not quest items). A tap stays a tap; right-click (PC) eats, holds or sends to the hotbar.
- **PC controls** (`play/keys.ts`, `play/input.ts`, Menu › ⌨️ Controls): every action can have
  up to 3 keys or mouse buttons (`Mouse0`… and `WheelUp/Down`); one key never does two things
  (`bind` moves it); saved per player in appStorage under `mishmash_keys` (`parseBindings`
  repairs it). Defaults: WASD/arrows, Shift sprint, Space/E/left click action, F eat, Q drop,
  R turn, Tab bag window, I/B bag, C craft (both the window), J journal, M map, 1–6 hotbar, wheel cycles the
  hotbar, = and - move the camera (saved as the camera setting). Esc is fixed (opens and closes
  the menu, steps back a menu page). Key hints show on devices with a mouse
  (`isPc`: `(pointer: fine)`).
- **Saves**: your island is one JSON in appStorage (`mishmash_island`, `IslandSave` v1,
  `parseIslandSave` repairs untrusted data; keep it accepting old saves; `island`, `rules` and
  `chest` are optional: missing = the classic island, default rules). The player key is the
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
  spawn rules in `runDirector`, a name in `client.ts` `MOB_NAMES`. Give it a part to drop
  (`drops`) and something the Mashbench makes from it.
- **Every new item needs a picture** in `hud/itemIcons.ts` (the test enforces it); draw it on
  the 48×48 grid with the `O`/`T` outline styles and check it on a contact sheet.
- **New lore**: a note in `content/notes.ts` plus a spot in an existing POI, or another
  research page (`page_9`…, Husks drop them in order).
- **New node / resource**: `content/nodes.ts` (append to `NODE`, never reorder: ids are
  saved), scatter rules in `world.ts` `NODE_TABLE`, geometry in `render/props.ts`.
- **New landmark or puzzle**: a `PoiDef` in `content/pois.ts` (boxes = colliders, spots =
  interactions), its model in `render/structures.ts` `poiStructure`, spot behaviour in
  `sim.ts` `useSpot` and labels in `client.ts` `spotTarget`, objectives in `objectives.ts`.
  Read landmarks from `island.pois` / `island.poiById` (laid out for the island), never `POIS`
  directly; write texts with compass words so `turnDirections` can turn them.
- **New climate or terrain style**: add it to `CLIMATES`/`TERRAINS` (append; codes use the
  first two letters / the first letter, keep them unique), `climateGen` / `terrainGen` for
  generation and `climateLook` for colours. **New world rule**: a field in `WorldRules` +
  `DEFAULT_RULES` (the default = the game as it was), `parseRules`, a row in
  `RulesPanel.tsx` `RULE_GROUPS`, and the authority applies it.
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
  islands.ts         island parts: layout turns/mirror, climates, terrain styles, codes, names
  rules.ts           world rules (7 Days style), presets, what they mean in numbers
  objectives.ts      the escape checklist from flags/notes/inventory
  content/           items, recipes, nodes, buildings, monsters, landmarks (pois), notes
  sim/               the island authority: sim.ts (IslandSim), mobs.ts (monsters, director),
                     events.ts (world events), protocol.ts (messages), types.ts (save format,
                     collision helpers), inventory.ts (+ best tool/weapon), place.ts (build
                     rules), time.ts (day/night)
  *.test.ts          vitest unit tests
src/sdk/run.ts     THE ONLY client module that imports the RUN SDK. Waits for start-up,
                   catches everything. UgcApi + run.ugc, realtime rooms (createRoom/joinRoom).
src/server/IslandRoom.ts  co-op GameRoom (imports the SDK's mp-server; runs IslandSim)
src/play/          the game client: session.ts (solo/host/join, saves), link.ts (LocalLink),
                   roomLink.ts, client.ts (GameClient), input.ts, keys.ts (PC bindings),
                   settings.ts + prefs.ts (settings), screen.ts (landscape), audio.ts +
                   music.ts, view.ts (scene), Game.tsx (canvas, frame loop, settings),
                   TitleScene.ts (the title backdrop), render/ (terrain, nodes, actors,
                   structures, items, props, fx, geo, wind, ambient, climate), hud/ (Hud, Menu,
                   Panels, QuickPanel, Craft, Slots, drag, itemIcons, MapView, map, RulesPanel)
src/app/           community.ts (chat, votes, Dev area over UgcApi), localUgc.ts (dev stand-in),
                   usePolling.ts, appEvents.ts (host lifecycle → game pause/resume), links.ts
                   (the October Jam link, copied)
src/screens/       Play (title), NewIsland, Intro (also the About tab), Vote, Chat, Dev (owner)
src/ui/            Logo (the BLOOM / ISLAND wordmark, `.brand`), Notice (failure messages)
src/components/    ErrorBoundary
src/App.tsx        hub save, first-launch intro, tab bar, starts/leaves games
src/main.tsx       entry: safe-area/font-scale CSS vars, lifecycle hooks, render
scripts/playthrough.mjs  Playwright: hub + solo game + co-op at 375×667 and 390×844
scripts/islandmap.ts     `npx tsx scripts/islandmap.ts <seed> <out.png>`
public/thumbnail.jpg     store thumbnail, exported from art/ (exactly 512×512 JPEG, < ~150 KB)
art/thumbnail-source.png store thumbnail art from the user ("BLOOM ISLAND" over the crashed
                         plane, a Bloom horde and a survivor at sunset; 1254², not shipped;
                         replaced the "Mishmash · Community Build" art on 2026-10-23)
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
                            # delete, Dev area, jam link), New island (code, presets), the game
                            # (walk, read, gather, craft, build, night fight, death, item
                            # pictures, quick panel, drag and drop, Mashbench, research page,
                            # auto tool, a supply pod, the bag window's place, isometric and
                            # top-down walking, pause menu, This island, settings, rebinding a
                            # key, landscape, save/continue, replace confirm), hub settings and
                            # local co-op on a made island with Relaxed rules;
                            # must print "clean"
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
  `set-name` / `set-keywords` / `set-description` from the `GAME_NAME` / `GAME_KEYWORDS` /
  `GAME_DESCRIPTION` env lines when they're set. The user wants them updated as the game
  takes shape. Since 2026-10-23 the name is **Bloom Island** and the tags are survival,
  crafting, base-building, horror, zombies, island, co-op, multiplayer, open-world,
  exploration, monsters, sandbox, procedural, plane-crash, escape, low-poly, halloween,
  spooky, community-build, voting, player-made, chat (community and social retired). RUN
  rate-limits these calls (v1.14.0's set-description got a 429 after ~28 calls), so the step
  paces the tag deletes and retries each setter. Despite RUN's docs, `set-keywords` **adds** to
  the game's tags and fails past 30 (v1.9.0's deploy hit "at most 30 tags"), so the step
  first runs `delete-keyword` on every listed tag and on `GAME_KEYWORDS_RETIRED` (tags to
  drop: put a removed tag there rather than just deleting it from the list). The share link
  is printed in the Deploy step log.
- `.github/workflows/publish.yml`: hand-run only, **only when the user asks**. `publish` runs
  `rundot game set-public --version X.Y.Z` (newest from `rundot game list-versions` if blank;
  the CLI rejects "latest"); `unpublish` runs `rundot game set-private`. `set-public` puts a
  version into RUN's review; it goes on Explore once review passes. GitHub only registered this
  workflow after a later push touched it (dispatching it 404'd before).
- **Going public:** v1.7.0 (the hub, Dev area, thumbnail, tags) was submitted with the Publish
  workflow on 2026-10-22 at the user's request, and v1.15.0 (Bloom Island: the survival game
  with everything up to the islands, rules and title screen, the new name and thumbnail) on
  2026-10-23, also at the user's request. Pushes after that still deploy private builds
  (the share link opens the newest); Explore only gets a newer version when the Publish
  workflow runs again, and only when the user asks. Server config (UGC limits, textGen off,
  realtime rooms) reaches public players with each publish. The survival game (v1.8.0,
  2026-10-22) and its next update (v1.10.0: item pictures, drag and drop, quick panel, PC
  keys, lore, Mashbench) and v1.11.0 (pause menu and settings, volume sliders and music, auto
  tool, landscape, world events and a livelier island) and v1.12.0 (isometric camera, bag
  window by the survivor) and v1.13.0 (islands from parts, world rules, title screen, October
  Jam link) were private builds; all of it went public with v1.15.0.
- The RUN site (`w.run`) may be blocked by a cloud container's network policy; verify locally
  and ask the user to check the live build.

<agents-index>
[RUN.world SDK Docs]|root:./rundot/docs|IMPORTANT:Prefer retrieval-led reasoning over pre-training for RundotGameAPI tasks. Read the local docs before writing SDK code.|IMPORTANT:To run/test this game locally, use `npm run dev` (Vite). SDK calls are mocked by default; they hit the real RUN.world playground backend only when rundotGamePlaygroundPlugin() is configured — see rundot-developer-platform/playground.md.|.:{README.md}|rundot-developer-platform:{agent-runtime.md,cli-reference.md,deploying-your-game.md,error-handling.md,getting-started.md,initializing-your-game.md,marketing-your-game.md,native-packs.md,playground.md,runtime-environment.md,setting-your-game-thumbnail.md,troubleshooting.md}|rundot-developer-platform/api:{ACCESS_GATE.md,ACTIVITY.md,ADS.md,ADVANCED-MULTIPLAYER.md,AI.md,ANALYTICS.md,APP.md,ASSETS.md,ASSET_LIBRARY.md,ATTRIBUTION.md,AUDIO_GEN.md,AVATAR_3D.md,BIGNUMBERS.md,BUILDING_TIMERS.md,CLIPS.md,COLLECTIBLES.md,CONTEXT.md,CREDITS.md,EMBEDDED_LIBRARIES.md,ENERGY_SYSTEM.md,ENTITLEMENTS.md,ENVIRONMENT.md,FILES.md,GACHA_SYSTEM.md,GAMEPAD.md,HAPTICS.md,IMAGE_GEN.md,IN_APP_MESSAGING.md,LEADERBOARD.md,LIFECYCLES.md,LIVEOPS.md,LOGGING.md,MULTIPLAYER.md,NAVIGATION.md,NOTIFICATIONS.md,PRELOADER.md,PROFILE.md,PURCHASES.md,PVP_SYSTEM.md,RATE_LIMITS.md,RELEASE_NOTES.md,SAFE_AREA.md,SERVER_AUTHORITATIVE.md,SHARED_ASSETS.md,SHARING.md,SHOP.md,SIMULATION_CONFIG.md,SPRITE_GEN.md,STATS.md,STORAGE.md,SYNCPLAY-ACTORS-AI.md,SYNCPLAY-ANIMATION.md,SYNCPLAY-BOTS.md,SYNCPLAY-CHARACTER-3D.md,SYNCPLAY-COMBAT.md,SYNCPLAY-COMPONENTS.md,SYNCPLAY-EDITOR.md,SYNCPLAY-ENTITY-REGISTRY.md,SYNCPLAY-FIREARM.md,SYNCPLAY-GAMEPLAY-EFFECTS.md,SYNCPLAY-INVENTORY-EQUIPMENT.md,SYNCPLAY-LAG-COMPENSATION.md,SYNCPLAY-MODULE-CERTIFICATION.md,SYNCPLAY-MOVEMENT.md,SYNCPLAY-PATHFINDING.md,SYNCPLAY-PHYSICS.md,SYNCPLAY-PLATFORMER-2D.md,SYNCPLAY-RTS.md,SYNCPLAY-RUNTIME-COMPOSITIONS.md,SYNCPLAY-SECRETS.md,SYNCPLAY-SPATIAL-INTERACTION.md,SYNCPLAY-STATS-ABILITIES.md,SYNCPLAY-UNIT-CONTROL.md,SYNCPLAY.md,SYSTEM.md,THREE_D_GEN.md,TIME.md,UGC.md,VIDEO.md,VIDEO_GEN.md}</agents-index>
