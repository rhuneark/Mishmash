// The Bloom Island trailer: scripted moments from the real game, seen through the game's own
// camera (isometric, as players see it, without the HUD), captured frame by frame on a
// virtual clock (so every frame is exactly 1/30 s apart however slow the renderer is), with
// captions drawn in the journal's look, then cut to the score (music.py) with ffmpeg.
//
//   npm run dev                                  (the local preview, with its dev hooks)
//   node scripts/trailer/trailer.mjs <outdir>    (frames, the score and trailer.mp4)
//
// Portrait 1080×1920, 30 s (RUN's video ads take 15–30 s). Shots are captured in whatever
// order is easiest to set up and written to their place on the timeline.

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = process.argv[2] ?? 'trailer-out';
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const URL = process.env.TRAILER_URL ?? 'http://localhost:5173/';
const FPS = 30;
const LEN = 30;
const W = 540;
const H = 960;
const DPR = 2;
const HERE = dirname(fileURLToPath(import.meta.url));
const FRAMES = join(OUT, 'frames');
mkdirSync(FRAMES, { recursive: true });

// The page's clock: timers, animation frames, performance.now and Date.now all run on it.
// Until the capture takes over it follows real time; then each step moves it on exactly.
const CLOCK = `(() => {
  const realRaf = window.requestAnimationFrame.bind(window);
  const realNow = performance.now.bind(performance);
  const dateBase = Date.now();
  let now = 0, manual = false, lastReal = realNow(), seq = 0, rafSeq = 0;
  const timers = new Map();
  let rafs = new Map();
  performance.now = () => now;
  Date.now = () => dateBase + now;
  window.setTimeout = (fn, ms = 0, ...args) => { const id = ++seq; timers.set(id, { at: now + Math.max(0, +ms || 0), fn, args, every: 0 }); return id; };
  window.setInterval = (fn, ms = 0, ...args) => { const id = ++seq; const every = Math.max(1, +ms || 0); timers.set(id, { at: now + every, fn, args, every }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
  window.requestAnimationFrame = (fn) => { const id = ++rafSeq; rafs.set(id, fn); return id; };
  window.cancelAnimationFrame = (id) => { rafs.delete(id); };
  const runTimers = (until) => {
    for (let guard = 0; guard < 20000; guard++) {
      let best = null, bestId = 0;
      for (const [id, t] of timers) if (t.at <= until && (!best || t.at < best.at)) { best = t; bestId = id; }
      if (!best) break;
      now = Math.max(now, best.at);
      if (best.every) best.at += best.every; else timers.delete(bestId);
      try { typeof best.fn === 'function' ? best.fn(...best.args) : 0; } catch (e) { console.error(e); }
    }
    now = Math.max(now, until);
  };
  const frame = () => {
    const list = rafs; rafs = new Map();
    for (const fn of list.values()) { try { fn(now); } catch (e) { console.error(e); } }
  };
  const pump = () => {
    if (!manual) { const r = realNow(); const dt = Math.min(100, r - lastReal); lastReal = r; runTimers(now + dt); frame(); }
    realRaf(pump);
  };
  realRaf(pump);
  window.__clock = {
    manual(on) { manual = on; lastReal = realNow(); },
    step(ms) { runTimers(now + ms); frame(); },
    now: () => now,
  };
})();`;

// Captions and the title card, in the journal's look (the page's own fonts).
const OVERLAY_CSS = `
#tcap { position: fixed; left: 50%; top: 11%; z-index: 9999; max-width: 460px; padding: 10px 22px 13px;
  transform: translateX(-50%) rotate(-1deg); background: #f6eedb; border: 2px solid #2a2017;
  border-radius: 255px 14px 225px 14px / 14px 225px 14px 255px; box-shadow: 0 10px 26px rgba(0,0,0,.45);
  font: 700 38px/1.02 Caveat, cursive; color: #2a2017; text-align: center; pointer-events: none; opacity: 0; }
#tcap::before { content: ''; position: absolute; top: -12px; left: 50%; width: 84px; height: 24px;
  transform: translateX(-50%) rotate(-4deg); background: rgba(236,222,160,.9); }
#tcap.small { font-size: 32px; }
#ttitle { position: fixed; inset: 0; z-index: 9998; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 18px; pointer-events: none; opacity: 0;
  background: radial-gradient(circle at 50% 46%, rgba(20,14,8,.15), rgba(20,14,8,.65)); }
#ttitle .logo { font: 700 124px/.82 Caveat, cursive; text-align: center; color: #f6eedb;
  text-shadow: 4px 6px 0 #2a2017, 0 10px 30px rgba(0,0,0,.5); }
#ttitle .logo span { display: block; color: #e0508c; transform: rotate(-3deg); }
#ttitle .tag { max-width: 440px; padding: 10px 20px 12px; background: #f6eedb; border: 2px solid #2a2017;
  border-radius: 255px 14px 225px 14px / 14px 225px 14px 255px; font: 700 31px/1.1 Caveat, cursive;
  color: #2a2017; text-align: center; box-shadow: 0 10px 26px rgba(0,0,0,.45); }
#ttitle .cta { font: 700 22px 'Courier Prime', monospace; color: #fff4e0; letter-spacing: .06em;
  text-shadow: 0 2px 6px rgba(0,0,0,.9); }
body.clean .hud, body.clean .fps { visibility: hidden !important; }
body.clean .game-labels .tag-hp, body.clean .game-labels .tut-edge { display: none !important; }
body:not(.gains) .game-labels .tag-gain { display: none !important; }
`;

// The timeline: [start s, end s, caption].
const CAPTIONS = [
  [0.35, 2.45, 'Flight MX207 went down.'],
  [2.6, 4.95, 'The other passengers didn’t stay dead.'],
  [5.0, 6.2, 'Gather.'],
  [6.25, 7.45, 'Craft.'],
  [7.5, 8.45, 'Build.'],
  [8.55, 11.45, 'Every island is different.'],
  [11.55, 14.45, 'Storms roll in. Nights get long.'],
  [14.6, 20.45, 'Every seventh night, the Bloom wakes.'],
  [20.55, 23.45, 'Survive it together.'],
  [23.55, 26.45, 'Dig up what the island hides.'],
];

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'],
});
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: DPR,
  hasTouch: true,
  isMobile: true,
});
await context.addInitScript(CLOCK);
const page = await context.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
const g = (fn, arg) => page.evaluate(fn, arg);
const NE = [Math.SQRT1_2, -Math.SQRT1_2];
const SW = [-Math.SQRT1_2, Math.SQRT1_2];

/** Puts one frame on the timeline: caption, a step of the clock, the screenshot. */
async function frame(index, perFrame) {
  const t = index / FPS;
  const cap = CAPTIONS.find(([a, b]) => t >= a && t <= b);
  const op = cap ? Math.min(1, (t - cap[0]) / 0.25, (cap[1] - t) / 0.2) : 0;
  await g(
    ([text, op, t]) => {
      const el = document.getElementById('tcap');
      if (el) {
        el.style.top = t >= 6.25 && t < 7.5 ? '47%' : '';
        el.textContent = text;
        el.style.opacity = String(Math.max(0, op));
        el.className = text.length > 26 ? 'small' : '';
      }
      window.__t = t;
    },
    [cap?.[2] ?? '', op, t],
  );
  if (perFrame) await g(perFrame, { t, index });
  await g(() => window.__clock.step(1000 / 30));
  await page.screenshot({
    path: join(FRAMES, `f${String(index).padStart(4, '0')}.jpg`),
    type: 'jpeg',
    quality: 93,
  });
}

/** A shot: [from, to) seconds on the timeline; perFrame runs in the page before each frame. */
async function shot(name, from, to, setup, perFrame) {
  if (ONLY && !ONLY.includes(name)) return;
  console.log('shot', name, from, to);
  await g(() => {
    window.__clock.manual(false);
    document.body.classList.remove('gains');
    window.__halos = false;
    window.__game.input.joy = { x: 0, z: 0 };
  });
  if (setup) await setup();
  // The island around a new spot loads, then the camera settles on the survivor.
  await wait(1500);
  await g(() => {
    // A campfire lit before a jump in time reads as burnt out to the phone (its fuel counts
    // from when it heard of it), so the lit ones are sent again once the clock has caught up.
    const s = window.__h?.s();
    if (s) for (const b of s.buildings.values()) if (b.kind === 'campfire' && b.v > 0) s.broadcast({ type: 'build', b: s.net(b) });
    window.__h?.snap();
    // No "+N" popups left over from the setup.
    window.__game.view.popups.length = 0;
    window.__clock.manual(true);
    for (let i = 0; i < 8; i++) window.__clock.step(1000 / 30);
  });
  const a = Math.round(from * FPS);
  const b = Math.round(to * FPS);
  for (let i = a; i < b; i++) await frame(i, perFrame);
  await g(() => { window.__game.input.joy = { x: 0, z: 0 }; });
}

const wait = (ms) => page.waitForTimeout(ms);

async function overlay() {
  await page.addStyleTag({ content: OVERLAY_CSS });
  await g(() => {
    if (document.getElementById('tcap')) return;
    const cap = document.createElement('div');
    cap.id = 'tcap';
    document.body.append(cap);
    const t = document.createElement('div');
    t.id = 'ttitle';
    t.innerHTML =
      '<div class="logo">Bloom<span>Island</span></div><div class="tag">Survive the nights. Build a home. Find a way off.</div><div class="cta">PLAY FREE ON RUN.WORLD</div>';
    document.body.append(t);
  });
}

/** Into a game: a fresh island from a map code (or the ready-made one). */
async function startIsland(code) {
  await page.goto(URL);
  const intro = page.getByText('Flight MX207 went down.');
  const title = page.getByRole('button', { name: 'Solo', exact: true });
  await Promise.race([
    intro.waitFor({ timeout: 90000 }),
    title.first().waitFor({ timeout: 90000 }),
  ]).catch(() => {});
  if (await intro.isVisible().catch(() => false)) {
    // First launch: the intro's Play goes straight onto a ready-made island.
    await page.getByRole('button', { name: 'Play', exact: true }).first().click();
    await page.locator('.hud').waitFor({ timeout: 120000 });
    if (code) {
      await page.getByRole('button', { name: 'Menu' }).click();
      await page.getByRole('button', { name: /Save and quit/ }).click();
    }
  } else {
    // Empty the island slots, so a new island never has to replace one.
    await g(async () => {
      const run = await import('/src/sdk/run.ts');
      for (const k of ['mishmash_island', 'mishmash_island_2', 'mishmash_island_3']) await run.setItem(k, '');
    });
    await wait(600);
    await page.reload();
    await page.getByRole('button', { name: 'Solo', exact: true }).waitFor({ timeout: 90000 });
    if (!code) {
      await page.getByRole('button', { name: 'Solo', exact: true }).click();
      await page.getByRole('button', { name: 'Survivor', exact: true }).click();
      await page.locator('.hud').waitFor({ timeout: 120000 });
    }
  }
  if (code) {
    await page.getByRole('button', { name: 'Solo', exact: true }).click();
    await page.getByRole('button', { name: 'Custom', exact: true }).click();
    await page.locator('.new-island').waitFor();
    await page.getByLabel('Map code').fill(code);
    await page.getByRole('button', { name: 'Use', exact: true }).click();
    await wait(1500);
    await page.locator('.map-busy').waitFor({ state: 'detached', timeout: 60000 });
    const name = await page.locator('[data-testid="island-name"]').textContent();
    await page.getByRole('button', { name: `✈️ Start on ${name}` }).click();
    await page.locator('.hud').waitFor({ timeout: 120000 });
  }
  await overlay();
  await g(() => {
    const { client: c, prefs, view } = window.__game;
    const s = c.link.sim;
    prefs.set({ quality: 'high', tutorial: false, damageNumbers: false });
    s.nextEvent = Infinity;
    s.weather = { kind: 'clear', until: s.time + 99999 };
    s.broadcast({ type: 'weather', w: 'clear' });
    // The game's own camera throughout; the rings and hint halos stay out of the picture.
    if (!view.__trailer) {
      const render = view.render.bind(view);
      view.render = () => {
        for (const r of [view.ring, view.goalRing, view.tutRing]) if (r) r.visible = false;
        // Spot halos only where a shot wants them (the bunker's loot).
        if (!window.__halos) for (const p of view.pois) for (const sp of p.spots) if (sp.halo) sp.halo.visible = false;
        render();
      };
      view.__trailer = true;
    }
    document.body.classList.add('clean');
  });
  await wait(2500);
}

// Helpers the shots use in the page.
const HELPERS = `(() => {
  const G = window.__game;
  const H = (window.__h = {});
  H.c = () => G.client;
  H.s = () => G.client.link.sim;
  H.p = () => H.s().players.get(G.client.you);
  H.go = (x, z, ry) => { const c = H.c(), p = H.p(); p.x = x; p.z = z; p.lastPos = H.s().time; c.x = x; c.z = z; if (ry !== undefined) { c.ry = ry; p.ry = ry; } };
  H.ease = (k) => k * k * (3 - 2 * k);
  H.lerp = (a, b, k) => a + (b - a) * k;
  H.y = (x, z) => G.view.y(x, z);
  // Directions on the island as the game camera sees them: up the screen is north-east.
  window.NE = [Math.SQRT1_2, -Math.SQRT1_2];
  window.SW = [-Math.SQRT1_2, Math.SQRT1_2];
  window.SE = [Math.SQRT1_2, Math.SQRT1_2];
  window.NE_RY = Math.atan2(Math.SQRT1_2, -Math.SQRT1_2);
  // The camera setting a player picks (80-130), the stick (a direction on the island), facing.
  H.zoom = (v) => { G.prefs.set({ camera: v }); G.view.zoom = v / 100; };
  H.walk = (wx, wz, k = 1) => { G.input.joy = { x: Math.SQRT1_2 * (wx + wz) * k, z: Math.SQRT1_2 * (wz - wx) * k }; };
  H.face = (wx, wz) => { const ry = Math.atan2(wx, wz); G.client.ry = ry; H.p().ry = ry; };
  // The camera straight onto the survivor after a jump (it would glide there otherwise).
  H.snap = () => {
    const v = G.view, c = G.client, r = v.rig;
    const tx = Math.sin(r.yaw), tz = Math.cos(r.yaw);
    const lx = c.build ? c.x + c.buildLook.x : c.x, lz = c.build ? c.z + c.buildLook.z : c.z;
    v.lead.x = 0;
    v.lead.z = 0;
    v.focus.set(lx - tx * r.ahead, v.y(lx, lz) + 0.8, lz - tz * r.ahead);
    v.camDist = (v.camera.aspect < 1 ? 1.3 : 1.05) * v.zoom * (c.build ? 1.22 : 1);
  };
  // The camp goes up at once when a shot needs it and the build shot didn't run.
  H.camp = () => {
    const c = window.__camp, s = H.s(), you = H.c().you;
    if (!c || c.done) return;
    H.go(c.cx + 4, c.cz + 6);
    for (const [kind, x, z, rot] of c.plan) s.handle(you, { type: 'build', kind, x, z, rot });
    s.handle(you, { type: 'build', kind: 'campfire', x: c.cx, z: c.cz + 4.5, rot: 0 });
    s.handle(you, { type: 'build', kind: 'torch_post', x: c.cx + 3.5, z: c.cz + 3.5, rot: 0 });
    c.done = true;
  };
  H.clearMobs = () => { const s = H.s(); for (const id of [...s.mobs.keys()]) if (!s.mobs.get(id).tame) s.mobs.delete(id); };
  H.calm = (on) => { clearInterval(window.__calmT); if (on) window.__calmT = setInterval(H.clearMobs, 200); };
  H.time = (day, phase) => { H.s().time = 600 * (day - 1) + 600 * phase; };
  // The weather at once (the sky would take a few seconds to blend into it).
  const LOOK = { clear: [0, 0, 0], storm: [1, 1, 0.45] };
  H.weather = (w) => {
    const s = H.s(), sky = G.view.sky, [cloud, rain, fog] = LOOK[w];
    s.weather = { kind: w, until: s.time + 99999 };
    s.broadcast({ type: 'weather', w });
    Object.assign(sky, { cloud, rain, fog });
  };
  H.tidy = (x, z, r) => { const isl = H.c().island; for (let id = 0; id < isl.nodeCount; id++) { const t = isl.nodeType[id]; if ((t === 8 || t === 10) && Math.hypot(isl.nodeX[id] - x, isl.nodeZ[id] - z) < r) { isl.hidden[id] = 1; H.s().island.hidden[id] = 1; } } G.view.nodes.markDirty(); };
  // Trees between the camera (south-west) and a spot, out of the picture.
  H.clearView = (x, z, back, half) => {
    const isl = H.c().island, SWx = -Math.SQRT1_2, SWz = Math.SQRT1_2;
    for (let id = 0; id < isl.nodeCount; id++) {
      if (isl.nodeType[id] > 2) continue;
      const dx = isl.nodeX[id] - x, dz = isl.nodeZ[id] - z;
      const along = dx * SWx + dz * SWz, side = dx * -SWz + dz * SWx;
      if (along > -1.5 && along < back && Math.abs(side) < half) { isl.hidden[id] = 1; H.s().island.hidden[id] = 1; }
    }
    G.view.nodes.markDirty();
  };
  H.stoke = () => { const s = H.s(); for (const b of s.buildings.values()) if (b.kind === 'campfire') { b.v = 900; s.broadcast({ type: 'build', b: s.net(b) }); } };
  H.give = (items) => { const s = H.s(), p = H.p(); for (const [id, n] of items) s.give(p, id, n); s.dirty(p); };
})();`;

const helpers = () => page.evaluate(HELPERS);

// ---------------------------------------------------------------- the tropical island
const TROPIC = ['wreck', 'taken', 'chop', 'craft', 'build', 'storm', 'night', 'horde', 'fight', 'bomb', 'mother', 'together', 'bunker', 'wreckship', 'dig', 'title'];
if (!ONLY || ONLY.some((n) => TROPIC.includes(n))) {
  // TR-C0-4207: tropical, and its bunker door faces the game camera (south-west).
  await startIsland('TR-C0-4207');
  await helpers();
  // A spot for the camp: flat ground in the crash site's clearing, clear of the wreck.
  await g(() => {
    const h = window.__h;
    const s = h.s();
    const p = h.p();
    h.calm(true);
    s.rules.blockDamage = 600;
    // Everything the shots use, given now so no "+1" popup turns up in a shot.
    h.give([['axe_stone', 1], ['jawblade', 1], ['firebomb', 8], ['shovel', 1],
      ['wood', 400], ['stone', 200], ['fiber', 80], ['rope', 40], ['cloth', 30], ['scrap', 30], ['sap', 20]]);
    const crash = h.c().island.poiById.crash;
    const plan = (cx, cz) => [
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => ['floor_wood', cx + x, cz + z, 0]),
      ['wall_wood', cx - 1, cz - 2, 0], ['wall_window', cx + 1, cz - 2, 0],
      ['wall_wood', cx - 2, cz - 1, 1], ['wall_wood', cx - 2, cz + 1, 1],
      ['wall_wood', cx + 2, cz - 1, 1], ['wall_window', cx + 2, cz + 1, 1],
      ['wall_wood', cx - 1, cz + 2, 0], ['door_wood', cx + 1, cz + 2, 0],
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => ['roof_wood', cx + x, cz + z, 0]),
    ];
    let best = null;
    for (let r = 13; r <= 22 && !best; r += 3)
      for (let k = 0; k < 16 && !best; k++) {
        const a = (k / 16) * Math.PI * 2;
        const cx = Math.round((crash.x + Math.cos(a) * r) / 2) * 2;
        const cz = Math.round((crash.z + Math.sin(a) * r) / 2) * 2;
        h.go(cx, cz + 5);
        if (plan(cx, cz).every(([kind, x, z, rot]) => s.canPlaceAt(p, kind, x, z, rot, 24)) && s.canPlaceAt(p, 'campfire', cx, cz + 4.5, 0, 24))
          best = [cx, cz];
      }
    window.__camp = { cx: best[0], cz: best[1], plan: plan(best[0], best[1]) };
  });

  // Every shot is the game's own camera (isometric, south-west of the survivor, up on the
  // screen is north-east), the survivor at its heart: what a player sees, without the HUD.

  // 1. The wreck at dusk, smoking: the survivor walks up to it.
  await shot(
    'wreck', 0, 2.5,
    () => g(() => {
      const h = window.__h;
      h.zoom(100);
      h.time(1, 0.775);
      const crash = h.c().island.poiById.crash;
      h.go(crash.x + SW[0] * 15, crash.z + SW[1] * 15, NE_RY);
    }),
    () => window.__h.walk(NE[0], NE[1], 0.75),
  );

  // 2. The taken: Husks come out of the trees at dusk.
  await shot(
    'taken', 2.5, 5.0,
    () => g(async () => {
      const h = window.__h, s = h.s(), isl = h.c().island;
      const { spawnMob } = await import('/src/game/sim/mobs.ts');
      h.zoom(90);
      h.calm(false);
      h.clearMobs();
      h.time(1, 0.805);
      // Open ground near the crash site with woods up the screen (north-east).
      const crash = isl.poiById.crash;
      const G = 512, bio = (x, z) => isl.biomes[Math.floor((z + 512) / 2) * G + Math.floor((x + 512) / 2)];
      let at = null;
      for (let r = 26; r <= 70 && !at; r += 4)
        for (let k = 0; k < 24 && !at; k++) {
          const a = (k / 24) * Math.PI * 2;
          const x = crash.x + Math.cos(a) * r, z = crash.z + Math.sin(a) * r;
          const here = bio(x, z), w1 = bio(x + NE[0] * 12, z + NE[1] * 12), w2 = bio(x + NE[0] * 18, z + NE[1] * 18);
          if ((here === 1 || here === 2) && (w1 === 3 || w1 === 4) && (w2 === 3 || w2 === 4)) at = { x, z };
        }
      at ??= { x: crash.x + SW[0] * 26, z: crash.z + SW[1] * 26 };
      h.go(at.x, at.z, NE_RY);
      for (let i = 0; i < 5; i++) {
        const d = 11 + (i % 2) * 2.5, side = (i - 2) * 2.2;
        spawnMob(s, 'husk', at.x + NE[0] * d + SE[0] * side, at.z + NE[1] * d + SE[1] * side, { enraged: true });
      }
    }),
    () => {
      const h = window.__h;
      h.p().hp = 100;
      h.face(NE[0], NE[1]);
    },
  );

  // 3a. Gather: an axe into a tree, two blows and it comes down.
  await shot(
    'chop', 5.0, 6.25,
    () => g(async () => {
      const h = window.__h, s = h.s(), c = h.c(), isl = c.island;
      h.zoom(80);
      h.calm(true);
      h.time(2, 0.36);
      const p = h.p();
      const axe = p.inv.findIndex((it) => it && it.id === 'axe_stone');
      if (axe >= 0 && axe !== 0) s.handle(c.you, { type: 'move', from: axe, to: 0 });
      s.handle(c.you, { type: 'equip', slot: 0 });
      const { cx, cz } = window.__camp;
      let best = -1, bd = 1e9;
      for (let id = 0; id < isl.nodeCount; id++) {
        const t = isl.nodeType[id];
        if (t !== 0 && t !== 1) continue;
        const d = Math.hypot(isl.nodeX[id] - cx, isl.nodeZ[id] - cz);
        if (d < bd && d > 25) { bd = d; best = id; }
      }
      const tx = isl.nodeX[best], tz = isl.nodeZ[best];
      // 3 m off: in reach, and beyond the 2.5 m in which the game shows a tree just past you
      // see-through.
      h.go(tx + SW[0] * 3.0, tz + SW[1] * 3.0, NE_RY);
      // Nothing else in reach (a stone at your feet would take the swing).
      for (let id = 0; id < isl.nodeCount; id++)
        if (id !== best && Math.hypot(isl.nodeX[id] - c.x, isl.nodeZ[id] - c.z) < 4.5) { isl.hidden[id] = 1; s.island.hidden[id] = 1; }
      window.__game.view.nodes.markDirty();
      s.rules.blockDamage = 100;
      s.nodes.set(best, { hp: 30, until: 0 });
      document.body.classList.add('gains');
    }),
    () => {
      const h = window.__h, c = h.c();
      const i = Math.round((window.__t - 5.0) * 30);
      h.face(NE[0], NE[1]);
      if (i === 1 || i === 18) c.use();
    },
  );
  await g(() => { window.__h.s().rules.blockDamage = 600; });

  // 3b. Craft: the survivor's crafting page.
  await shot(
    'craft', 6.25, 7.5,
    () => g(async () => {
      const h = window.__h, c = h.c();
      document.body.classList.remove('clean');
      document.body.classList.remove('gains');
      c.openPanel('craft');
      await new Promise((r) => setTimeout(r, 600));
      document.querySelector('.recipe-tile[aria-label="Stone axe"]')?.click();
    }),
    () => {
      const t = window.__t;
      if (Math.abs(t - 6.85) < 0.02) {
        const b = [...document.querySelectorAll('.recipe-detail button')].find((x) => x.textContent.trim() === 'Craft');
        b?.click();
      }
    },
  );
  await g(() => {
    window.__h.c().openPanel(null);
    document.body.classList.add('clean');
  });

  // 3c. Build: build mode, the cabin going up piece by piece on the grid.
  await shot(
    'build', 7.5, 8.5,
    () => g(() => {
      const h = window.__h, c = h.c(), { cx, cz } = window.__camp;
      h.zoom(80);
      h.time(2, 0.5);
      h.go(cx + SW[0] * 6, cz + SW[1] * 6, NE_RY);
      c.toggleBuild(true);
      // Build mode looks where you move it: a little short of the cabin, so it sits mid-screen.
      c.buildLook = { x: cx + SW[0] * 3.5 - c.x, z: cz + SW[1] * 3.5 - c.z };
    }),
    () => {
      const h = window.__h, s = h.s(), c = h.c(), { cx, cz, plan } = window.__camp;
      const i = Math.round((window.__t - 7.5) * 30);
      c.buildLook = { x: cx + SW[0] * 3.5 - c.x, z: cz + SW[1] * 3.5 - c.z };
      const n = Math.min(plan.length, Math.floor(i / 1.6) + 1);
      for (let k = window.__built ?? 0; k < n; k++) {
        const [kind, x, z, rot] = plan[k];
        s.handle(c.you, { type: 'build', kind, x, z, rot });
      }
      window.__built = n;
      // The ghost shows the next piece where it's about to go.
      const next = plan[n];
      if (next && c.build) {
        c.buildPick(next[0]);
        c.build.rot = next[3];
        c.setBuildCursor({ x: next[1], z: next[2] });
      }
      if (i === 27) s.handle(c.you, { type: 'build', kind: 'campfire', x: cx, z: cz + 4.5, rot: 0 });
      if (i === 28) s.handle(c.you, { type: 'build', kind: 'torch_post', x: cx + 3.5, z: cz + 3.5, rot: 0 });
      if (i === 29) {
        window.__camp.done = true;
        c.toggleBuild(false);
      }
    },
  );
  await g(() => window.__h.c().toggleBuild(false));

  // 4. Storm over the camp: lightning on the beat.
  await shot(
    'storm', 11.5, 13.0,
    () => g(() => {
      const h = window.__h, { cx, cz } = window.__camp;
      h.zoom(90);
      h.camp();
      h.time(2, 0.64);
      h.weather('storm');
      h.tidy(cx, cz, 16);
      h.go(cx + SW[0] * 6.5 + SE[0] * 1.5, cz + SW[1] * 6.5 + SE[1] * 1.5, NE_RY);
      window.__game.view.wet = 0.6;
    }),
    () => {
      const h = window.__h, s = h.s(), { cx, cz } = window.__camp;
      const i = Math.round((window.__t - 11.5) * 30);
      h.walk(NE[0], NE[1], 0.5);
      // Strikes in the picture, on the beat.
      const c = h.c();
      if (i === 5) s.fx('lightning', c.x + NE[0] * 9 + SE[0] * 3.5, c.z + NE[1] * 9 + SE[1] * 3.5);
      if (i === 33) s.fx('lightning', c.x + NE[0] * 7 - SE[0] * 4, c.z + NE[1] * 7 - SE[1] * 4);
    },
  );

  // 5. A moonlit night by the fire.
  await shot(
    'night', 13.0, 14.5,
    () => g(() => {
      const h = window.__h, { cx, cz } = window.__camp;
      h.zoom(80);
      h.weather('clear');
      window.__game.view.wet = 0.3;
      h.camp();
      h.stoke();
      h.time(2, 0.86);
      // Beside the fire (in front of it, the survivor would hide it), warming up.
      const fx = cx, fz = cz + 4.5;
      h.go(fx + SE[0] * 1.7 + SW[0] * 0.4, fz + SE[1] * 1.7 + SW[1] * 0.4);
      h.face(-SE[0], -SE[1]);
    }),
    () => window.__h.face(-SE[0], -SE[1]),
  );

  // 6. The Bloom: a horde on a Bloom night, coming for the camp.
  await shot(
    'horde', 14.5, 16.0,
    () => g(async () => {
      const h = window.__h, s = h.s(), { cx, cz } = window.__camp;
      const { spawnMob } = await import('/src/game/sim/mobs.ts');
      h.zoom(100);
      h.calm(false);
      h.clearMobs();
      h.weather('clear');
      window.__game.view.wet = 0;
      h.camp();
      h.stoke();
      h.time(7, 0.86);
      const px = cx + SE[0] * 6, pz = cz + SE[1] * 6;
      h.go(px, pz, NE_RY);
      for (let i = 0; i < 10; i++) {
        const d = 11 + Math.floor(i / 5) * 3 + (i % 2), side = ((i % 5) - 2) * 2.6;
        spawnMob(s, 'husk', px + NE[0] * d + SE[0] * side, pz + NE[1] * d + SE[1] * side, { enraged: true });
      }
      spawnMob(s, 'thornback', px + NE[0] * 17 - SE[0] * 2, pz + NE[1] * 17 - SE[1] * 2, { enraged: true });
      spawnMob(s, 'thornback', px + NE[0] * 18 + SE[0] * 3, pz + NE[1] * 18 + SE[1] * 3, { enraged: true });
    }),
    () => {
      const h = window.__h;
      h.p().hp = 100;
      h.face(NE[0], NE[1]);
    },
  );

  // 7. A fight by the campfire.
  await shot(
    'fight', 16.0, 17.5,
    () => g(async () => {
      const h = window.__h, s = h.s(), c = h.c(), { cx, cz } = window.__camp;
      const { spawnMob } = await import('/src/game/sim/mobs.ts');
      h.zoom(80);
      h.camp();
      h.clearMobs();
      h.stoke();
      const p = h.p();
      const blade = p.inv.findIndex((it) => it && it.id === 'jawblade');
      if (blade >= 0 && blade !== 0) s.handle(c.you, { type: 'move', from: blade, to: 0 });
      s.handle(c.you, { type: 'equip', slot: 0 });
      h.time(7, 0.86);
      h.calm(false);
      // The fire on the left of the picture, the survivor by it, the Husks coming in from the
      // right (south-east): side by side on the screen, so every blow reads. One blow each.
      const fx = cx, fz = cz + 4.5;
      const px = fx + SE[0] * 2.2, pz = fz + SE[1] * 2.2;
      h.go(px, pz);
      h.face(SE[0], SE[1]);
      h.tidy(px, pz, 14);
      for (const [a, b] of [[1.9, 0], [3.6, 1.3], [4.2, -1.2]])
        spawnMob(s, 'husk', px + SE[0] * a + NE[0] * b, pz + SE[1] * a + NE[1] * b, { enraged: true, hp: 30 });
    }),
    () => {
      const h = window.__h, c = h.c();
      h.p().hp = 100;
      const i = Math.round((window.__t - 16.0) * 30);
      if (i % 8 === 0) c.use();
    },
  );

  // 8. A fire bomb into the pack.
  await shot(
    'bomb', 17.5, 19.0,
    () => g(async () => {
      const h = window.__h, s = h.s(), { cx, cz } = window.__camp;
      const { spawnMob } = await import('/src/game/sim/mobs.ts');
      h.zoom(90);
      h.camp();
      h.clearMobs();
      const px = cx + SE[0] * 7, pz = cz + SE[1] * 7;
      h.go(px, pz, NE_RY);
      const tx = px + NE[0] * 8, tz = pz + NE[1] * 8;
      for (let i = 0; i < 7; i++) {
        const d = 7 + Math.floor(i / 3) * 1.6, side = ((i % 3) - 1) * 1.7;
        spawnMob(s, 'husk', px + NE[0] * d + SE[0] * side, pz + NE[1] * d + SE[1] * side, { enraged: true });
      }
      window.__shot = { tx, tz };
    }),
    () => {
      const h = window.__h, s = h.s(), c = h.c(), sh = window.__shot;
      h.p().hp = 100;
      h.face(NE[0], NE[1]);
      const i = Math.round((window.__t - 17.5) * 30);
      if (i === 3) {
        const slot = h.p().inv.findIndex((it) => it && it.id === 'firebomb');
        s.handle(c.you, { type: 'throw', slot, x: sh.tx, z: sh.tz });
      }
    },
  );

  // 9. The Mother Bloom, ringed by torches.
  await shot(
    'mother', 19.0, 20.5,
    () => g(async () => {
      const h = window.__h, s = h.s(), { cx, cz } = window.__camp;
      const { spawnMob } = await import('/src/game/sim/mobs.ts');
      h.zoom(100);
      h.clearMobs();
      h.camp();
      h.time(7, 0.815);
      const px = cx + SW[0] * 14, pz = cz + SW[1] * 14;
      const mx = px + NE[0] * 9, mz = pz + NE[1] * 9;
      h.go(px, pz, NE_RY);
      h.tidy(mx, mz, 14);
      const you = h.c().you;
      for (const [a, b] of [[-3.5, 1.5], [3.5, 1.5], [0, -4]])
        s.handle(you, { type: 'build', kind: 'torch_post', x: mx + SE[0] * a + NE[0] * b, z: mz + SE[1] * a + NE[1] * b, rot: 0 });
      spawnMob(s, 'mother', mx, mz, { enraged: true });
    }),
    () => {
      const h = window.__h;
      h.p().hp = 100;
      h.face(NE[0], NE[1]);
    },
  );

  // 10. Together: four survivors round the fire.
  await shot(
    'together', 20.5, 23.5,
    () => g(() => {
      const h = window.__h, s = h.s(), { cx, cz } = window.__camp;
      h.zoom(80);
      h.camp();
      h.calm(true);
      h.clearMobs();
      h.time(3, 0.755);
      h.weather('clear');
      h.stoke();
      const fx = cx, fz = cz + 4.5;
      h.tidy(fx, fz, 14);
      const friends = [['trailer-a', 'Nova', 'captain.navy'], ['trailer-b', 'Pip', 'flowers.rose'], ['trailer-c', 'Bram', 'ranger.khaki']];
      for (const [id, name, look] of friends) if (!s.players.has(id) || !s.online.has(id)) s.join(id, name, look);
      // You on the near side (south-west), the others round the far side, facing the fire.
      const ids = [h.c().you, ...friends.map((f) => f[0])];
      const spots = [[SW[0] * 1.9, SW[1] * 1.9], [SE[0] * 2.0, SE[1] * 2.0], [NE[0] * 1.9, NE[1] * 1.9], [-SE[0] * 2.0, -SE[1] * 2.0]];
      ids.forEach((id, i) => {
        const q = s.players.get(id);
        const [dx, dz] = spots[i];
        q.x = fx + dx;
        q.z = fz + dz;
        q.ry = Math.atan2(-dx, -dz);
        q.lastPos = s.time;
      });
      const me = s.players.get(h.c().you);
      h.go(me.x, me.z, me.ry);
    }),
    () => window.__h.face(NE[0], NE[1]),
  );
  await g(() => {
    const s = window.__h.s();
    for (const id of ['trailer-a', 'trailer-b', 'trailer-c']) {
      s.online.delete(id);
      s.players.delete(id);
    }
  });

  // 11. Secrets: the bunker door, the wreck at low tide, an X dug up.
  await shot(
    'bunker', 23.5, 24.5,
    () => g(() => {
      const h = window.__h, v = window.__game.view;
      h.zoom(80);
      window.__halos = true;
      h.time(3, 0.45);
      const site = v.pois.find((p) => p.group.getObjectByName('door'));
      site.group.updateMatrixWorld(true);
      const doorObj = site.group.getObjectByName('door');
      const door = doorObj.getWorldPosition(new (v.camera.position.constructor)());
      const out = new (v.camera.position.constructor)(0, 0, 1).applyQuaternion(doorObj.getWorldQuaternion(new (v.camera.quaternion.constructor)()));
      // The door's middle (it hangs from its left edge), and the survivor in front of it.
      const mid = { x: door.x + (out.z * 0.8), z: door.z - (out.x * 0.8) };
      h.go(mid.x + out.x * 2.3 + out.z * 1.3, mid.z + out.z * 2.3 - out.x * 1.3, Math.atan2(-out.x, -out.z));
      h.clearView(h.c().x, h.c().z, 24, 8);
      window.__shot = { out };
    }),
    () => {
      const h = window.__h, s = h.s(), c = h.c(), { out } = window.__shot;
      const i = Math.round((window.__t - 23.5) * 30);
      c.ry = Math.atan2(-out.x, -out.z);
      if (i === 2) { s.flags.add('bunker_open'); s.broadcastProgress(); }
    },
  );
  await shot(
    'wreckship', 24.5, 25.5,
    () => g(() => {
      const h = window.__h, isl = h.c().island;
      const w = isl.poiById.wreck;
      h.zoom(110);
      h.time(3, 0.25);
      // On dry land 12 m from her, as near south-west as the shore allows; walk to her.
      let best = null, bs = -9;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
        const x = w.x + dx * 12, z = w.z + dz * 12;
        const score = dx * SW[0] + dz * SW[1];
        if (h.y(x, z) > 0.4 && score > bs) { bs = score; best = { x, z, dx, dz }; }
      }
      best ??= { x: w.x + SW[0] * 12, z: w.z + SW[1] * 12, dx: SW[0], dz: SW[1] };
      h.go(best.x, best.z, Math.atan2(-best.dx, -best.dz));
      window.__shot = { dx: -best.dx, dz: -best.dz };
    }),
    () => window.__h.walk(window.__shot.dx, window.__shot.dz, 0.7),
  );
  await shot(
    'dig', 25.5, 26.5,
    () => g(() => {
      const h = window.__h, s = h.s(), c = h.c(), isl = c.island;
      h.zoom(80);
      h.time(3, 0.5);
      s.notes.add('treasure_1');
      s.broadcastProgress();
      const p = h.p();
      const sh = p.inv.findIndex((it) => it && it.id === 'shovel');
      if (sh >= 0 && sh !== 0) s.handle(c.you, { type: 'move', from: sh, to: 0 });
      s.handle(c.you, { type: 'equip', slot: 0 });
      const x = isl.treasures[0];
      h.go(x.x + SW[0] * 1.2, x.z + SW[1] * 1.2, NE_RY);
    }),
    () => {
      const h = window.__h, c = h.c();
      const i = Math.round((window.__t - 25.5) * 30);
      h.face(NE[0], NE[1]);
      if (i % 8 === 0) c.use();
    },
  );

  // 12. The title over the crash site at golden hour, the camera at its widest.
  await shot(
    'title', 26.5, 30,
    () => g(() => {
      const h = window.__h, isl = h.c().island;
      const crash = isl.poiById.crash;
      h.zoom(130);
      h.time(4, 0.72);
      h.go(crash.x + SW[0] * 10 + SE[0] * 4, crash.z + SW[1] * 10 + SE[1] * 4, NE_RY);
    }),
    () => {
      const h = window.__h;
      h.walk(NE[0], NE[1], 0.45);
      const el = document.getElementById('ttitle');
      if (el) el.style.opacity = String(Math.min(1, Math.max(0, (window.__t - 26.6) / 0.5)));
    },
  );
  await g(() => {
    window.__h.walk(0, 0);
    const el = document.getElementById('ttitle');
    if (el) el.style.opacity = '0';
  });
}

// ---------------------------------------------------------------- every island is different
const ISLANDS = [
  ['autumn', 'AU-C0-1907', 8.5, 0.7],
  ['volcanic', 'VO-R0-3321', 9.5, 0.46],
  ['overgrown', 'OV-C0-5150', 10.5, 0.4],
];
for (const [name, code, at, phase] of ISLANDS) {
  if (ONLY && !ONLY.includes(name)) continue;
  await startIsland(code);
  await helpers();
  await shot(
    name, at, at + 1,
    () => g(([phase, NE, SW]) => {
      const h = window.__h, isl = h.c().island;
      h.zoom(110);
      h.calm(true);
      h.time(2, phase);
      // Open ground (beach or meadow) with the climate's woods up the screen, nearest the
      // crash site; the survivor walks towards them.
      const G = 512;
      const bio = (x, z) => isl.biomes[Math.floor((z + 512) / 2) * G + Math.floor((x + 512) / 2)];
      let best = null, bd = Infinity;
      for (let gz = 20; gz < G - 20; gz += 2)
        for (let gx = 20; gx < G - 20; gx += 2) {
          const x = gx * 2 - 512, z = gz * 2 - 512;
          const here = bio(x, z);
          if (here !== 1 && here !== 2) continue;
          const w1 = bio(x + NE[0] * 10, z + NE[1] * 10), w2 = bio(x + NE[0] * 18, z + NE[1] * 18);
          if (!(w1 === 3 || w1 === 4) || !(w2 === 3 || w2 === 4)) continue;
          if (bio(x + SW[0] * 6, z + SW[1] * 6) === 0) continue;
          const d = Math.hypot(x - isl.spawn.x, z - isl.spawn.z);
          if (d < bd && d > 40) { bd = d; best = [x, z]; }
        }
      best ??= [isl.spawn.x, isl.spawn.z];
      h.go(best[0], best[1], Math.atan2(NE[0], NE[1]));
    }, [phase, NE, SW]),
    () => window.__h.walk(NE[0], NE[1], 0.6),
  );
}

await g(() => window.__clock.manual(false));
console.log('frames done');
await browser.close();

// ---------------------------------------------------------------- the cut
const music = join(OUT, 'music.wav');
if (!existsSync(music)) execFileSync('python3', [join(HERE, 'music.py'), music], { stdio: 'inherit' });
const missing = [];
for (let i = 0; i < LEN * FPS; i++)
  if (!existsSync(join(FRAMES, `f${String(i).padStart(4, '0')}.jpg`))) missing.push(i);
if (missing.length) {
  console.log(`${missing.length} frames missing (first ${missing[0]}): no cut yet`);
} else {
  execFileSync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(FRAMES, 'f%04d.jpg'), '-i', music,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', join(OUT, 'trailer.mp4')],
    { stdio: 'inherit' },
  );
  console.log('wrote', join(OUT, 'trailer.mp4'));
}
