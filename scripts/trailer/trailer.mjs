// The Bloom Island trailer: scripted shots from the real game, captured frame by frame on a
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
  await g(() => window.__clock.manual(false));
  if (setup) await setup();
  await g(() => window.__clock.manual(true));
  const a = Math.round(from * FPS);
  const b = Math.round(to * FPS);
  for (let i = a; i < b; i++) await frame(i, perFrame);
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
  await page.getByText('A game the players build.').waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Play', exact: true }).first().click();
  await page.locator('.hud').waitFor({ timeout: 120000 });
  if (code) {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: /Save and quit/ }).click();
    await page.getByRole('button', { name: /New island/ }).first().click();
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
    // The camera is the trailer's when __cam is set.
    if (!view.__trailer) {
      const render = view.render.bind(view);
      view.render = () => {
        if (window.__cam) window.__cam(view.camera, view);
        for (const r of [view.ring, view.goalRing, view.tutRing]) if (r) r.visible = false;
        render();
      };
      view.__trailer = true;
    }
    window.__cam = null;
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
  H.look = (cam, px, py, pz, tx, ty, tz, fov = 58) => { cam.position.set(px, py, pz); cam.lookAt(tx, ty, tz); if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); } };
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
  H.wide = (on) => { const v = G.view; v.terrainRadius = on ? 6 : 3; v.fogMul = on ? 2.6 : 1; };
  H.clearMobs = () => { const s = H.s(); for (const id of [...s.mobs.keys()]) if (!s.mobs.get(id).tame) s.mobs.delete(id); };
  H.calm = (on) => { clearInterval(window.__calmT); if (on) window.__calmT = setInterval(H.clearMobs, 200); };
  H.time = (day, phase) => { H.s().time = 600 * (day - 1) + 600 * phase; };
  H.weather = (w) => { const s = H.s(); s.weather = { kind: w, until: s.time + 99999 }; s.broadcast({ type: 'weather', w }); };
  H.give = (items) => { const s = H.s(), p = H.p(); for (const [id, n] of items) s.give(p, id, n); s.dirty(p); };
})();`;

const helpers = () => page.evaluate(HELPERS);

// ---------------------------------------------------------------- the tropical island
const TROPIC = ['wreck', 'taken', 'chop', 'craft', 'build', 'storm', 'night', 'horde', 'fight', 'bomb', 'mother', 'together', 'bunker', 'wreckship', 'dig', 'title'];
if (!ONLY || ONLY.some((n) => TROPIC.includes(n))) {
  await startIsland(null);
  await helpers();
  // A spot for the camp: flat ground in the crash site's clearing, clear of the wreck.
  await g(() => {
    const h = window.__h;
    const s = h.s();
    const p = h.p();
    h.calm(true);
    s.rules.blockDamage = 600;
    h.give([['wood', 400], ['stone', 200], ['fiber', 80], ['rope', 40], ['cloth', 30], ['scrap', 30], ['sap', 20]]);
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

  // 1. The wreck at dusk, smoking.
  await shot(
    'wreck', 0, 2.5,
    () => g(() => {
      const h = window.__h;
      h.time(1, 0.775);
      const ws = window.__game.view.wreckSmoke;
      const crash = h.c().island.poiById.crash;
      const tx = (ws.x + crash.x) / 2, tz = (ws.z + crash.z) / 2;
      h.go(tx, tz);
      window.__shot = { ws, tx, tz };
    }),
    () => {
      const h = window.__h, { ws, tx, tz } = window.__shot;
      const k = h.ease(Math.min(1, window.__t / 2.5));
      window.__game.view.me.root.visible = false;
      const ty = h.y(tx, tz);
      window.__cam = (cam) => h.look(cam, tx - h.lerp(24, 18, k), ty + h.lerp(9, 6.5, k), tz + h.lerp(22, 16, k), tx, ty + 2.2, tz);
    },
  );

  // 2. The taken: Husks coming out of the trees at dusk.
  await shot(
    'taken', 2.5, 5.0,
    () => g(async () => {
      const h = window.__h, s = h.s();
      const { spawnMob } = await import('/src/game/sim/mobs.ts');
      h.calm(false);
      h.clearMobs();
      h.time(1, 0.805);
      const crash = h.c().island.poiById.crash;
      // Out in the open, away from the camp, facing the trees.
      const at = { x: crash.x - 26, z: crash.z + 26 };
      h.go(at.x, at.z);
      for (let i = 0; i < 5; i++)
        spawnMob(s, 'husk', at.x - 12 + (i - 2) * 2.2, at.z - 13 + (i % 2) * 1.5, { enraged: true });
      window.__shot = { at };
      await new Promise((r) => setTimeout(r, 400));
    }),
    () => {
      const h = window.__h, at = window.__shot.at;
      const k = h.ease(Math.min(1, (window.__t - 2.5) / 2.5));
      window.__game.view.me.root.visible = false;
      h.p().hp = 100;
      const fx = at.x - 4, fz = at.z - 4;
      window.__cam = (cam) => h.look(cam, fx + h.lerp(1.5, 0.5, k), h.y(fx, fz) + 1.4, fz + h.lerp(1.5, 0.6, k), at.x - 12, h.y(at.x - 12, at.z - 12) + 1.4, at.z - 12);
    },
  );

  // 3a. Gather: an axe into a palm.
  await shot(
    'chop', 5.0, 6.25,
    () => g(async () => {
      const h = window.__h, s = h.s(), c = h.c(), isl = c.island;
      h.calm(true);
      h.clearMobs();
      h.time(2, 0.36);
      h.give([['axe_stone', 1]]);
      const p = h.p();
      const axe = p.inv.findIndex((it) => it && it.id === 'axe_stone');
      if (axe >= 0 && axe !== 0) s.handle(c.you, { type: 'move', from: axe, to: 0 });
      s.handle(c.you, { type: 'equip', slot: 0 });
      const { cx, cz } = window.__camp;
      let best = -1, bd = 1e9;
      for (let id = 0; id < isl.nodeCount; id++) {
        const t = isl.nodeType[id];
        if (t !== 1 && t !== 2) continue;
        const d = Math.hypot(isl.nodeX[id] - cx, isl.nodeZ[id] - cz);
        if (d < bd && d > 25) { bd = d; best = id; }
      }
      const tx = isl.nodeX[best], tz = isl.nodeZ[best];
      const ry = Math.atan2(cx - tx, cz - tz);
      const px = tx + Math.sin(ry) * 1.3, pz = tz + Math.cos(ry) * 1.3;
      h.go(px, pz, Math.atan2(tx - px, tz - pz));
      window.__shot = { tx, tz, px, pz };
      await new Promise((r) => setTimeout(r, 2600));
      document.body.classList.add('gains');
    }),
    () => {
      const h = window.__h, c = h.c(), sh = window.__shot;
      const k = (window.__t - 5.0) / 1.25;
      window.__game.view.me.root.visible = true;
      c.ry = Math.atan2(sh.tx - sh.px, sh.tz - sh.pz);
      if (Math.round(window.__t * 30) % 9 === 0) c.use();
      const side = c.ry + Math.PI / 2;
      const cx = sh.px + Math.sin(side) * 5.2 + Math.sin(c.ry + Math.PI) * 3.4;
      const cz = sh.pz + Math.cos(side) * 5.2 + Math.cos(c.ry + Math.PI) * 3.4;
      window.__cam = (cam) => h.look(cam, cx, h.y(cx, cz) + h.lerp(2.6, 3.0, k), cz, (sh.px + sh.tx) / 2, h.y(sh.px, sh.pz) + 1.9, (sh.pz + sh.tz) / 2, 60);
    },
  );

  // 3b. Craft: the survivor's crafting page.
  await shot(
    'craft', 6.25, 7.5,
    () => g(async () => {
      const h = window.__h, c = h.c();
      document.body.classList.remove('clean');
      document.body.classList.remove('gains');
      window.__cam = null;
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

  // 3c. Build: the cabin goes up, piece by piece.
  await shot(
    'build', 7.5, 8.5,
    () => g(() => {
      const h = window.__h, { cx, cz } = window.__camp;
      h.time(2, 0.5);
      h.go(cx + 4, cz + 6);
    }),
    () => {
      const h = window.__h, s = h.s(), c = h.c(), { cx, cz, plan } = window.__camp;
      const i = Math.round((window.__t - 7.5) * 30);
      window.__game.view.me.root.visible = false;
      const n = Math.min(plan.length, Math.floor(i / 1.7) + 1);
      for (let k = window.__built ?? 0; k < n; k++) {
        const [kind, x, z, rot] = plan[k];
        s.handle(c.you, { type: 'build', kind, x, z, rot });
      }
      window.__built = n;
      if (i === 26) s.handle(c.you, { type: 'build', kind: 'campfire', x: cx, z: cz + 4.5, rot: 0 });
      if (i === 28) s.handle(c.you, { type: 'build', kind: 'torch_post', x: cx + 3.5, z: cz + 3.5, rot: 0 });
      if (i === 29) window.__camp.done = true;
      const a = 0.8 + i * 0.012;
      window.__cam = (cam) => h.look(cam, cx + Math.cos(a) * 12, h.y(cx, cz) + 8, cz + Math.sin(a) * 12, cx, h.y(cx, cz) + 1, cz);
    },
  );

  // 4. Storm over the camp: lightning on the beat.
  await shot(
    'storm', 11.5, 13.0,
    () => g(async () => {
      const h = window.__h, { cx, cz } = window.__camp;
      h.camp();
      h.time(2, 0.64);
      h.weather('storm');
      h.go(cx + 2, cz + 6);
      window.__game.view.wet = 1;
      await new Promise((r) => setTimeout(r, 3000));
    }),
    () => {
      const h = window.__h, s = h.s(), { cx, cz } = window.__camp;
      const i = Math.round((window.__t - 11.5) * 30);
      window.__game.view.me.root.visible = true;
      if (i === 5) s.fx('lightning', cx - 10, cz - 14);
      if (i === 33) s.fx('lightning', cx + 12, cz - 10);
      const k = i / 45;
      window.__cam = (cam) => h.look(cam, cx + h.lerp(11, 9, k), h.y(cx, cz) + 3.2, cz + h.lerp(14, 12, k), cx - 1, h.y(cx, cz) + 3.4, cz - 3, 60);
    },
  );

  // 5. A moonlit night by the fire.
  await shot(
    'night', 13.0, 14.5,
    () => g(async () => {
      const h = window.__h, { cx, cz } = window.__camp;
      h.weather('clear');
      window.__game.view.wet = 0.3;
      h.camp();
      h.time(2, 0.86);
      h.go(cx - 1.4, cz + 5.4, Math.atan2(1.4, -0.9));
      await new Promise((r) => setTimeout(r, 2500));
    }),
    () => {
      const h = window.__h, { cx, cz } = window.__camp;
      const k = (window.__t - 13.0) / 1.5;
      window.__game.view.me.root.visible = true;
      const a = 1.1 + k * 0.3;
      window.__cam = (cam) => h.look(cam, cx + Math.cos(a) * 9.5, h.y(cx, cz) + 3.6, cz + 4.5 + Math.sin(a) * 9.5, cx - 0.5, h.y(cx, cz) + 1.2, cz + 4);
    },
  );

  // 6. The Bloom: a horde on a Bloom night.
  const bloom = () => g(async () => {
    const h = window.__h, s = h.s();
    h.calm(false);
    h.clearMobs();
    h.time(7, 0.86);
    await new Promise((r) => setTimeout(r, 300));
  });
  await shot(
    'horde', 14.5, 16.0,
    async () => {
      await bloom();
      await g(async () => {
        const h = window.__h, s = h.s(), { cx, cz } = window.__camp;
        const { spawnMob } = await import('/src/game/sim/mobs.ts');
        h.camp();
        const px = cx, pz = cz + 7;
        h.go(px, pz, Math.PI);
        for (let i = 0; i < 10; i++) spawnMob(s, 'husk', px - 6 + (i % 5) * 3 + Math.random(), pz + 13 + Math.floor(i / 5) * 2.5, { enraged: true });
        spawnMob(s, 'thornback', px - 3, pz + 17, { enraged: true });
        spawnMob(s, 'thornback', px + 4, pz + 16, { enraged: true });
        window.__shot = { px, pz };
        await new Promise((r) => setTimeout(r, 300));
      });
    },
    () => {
      const h = window.__h, { px, pz } = window.__shot;
      const k = h.ease((window.__t - 14.5) / 1.5);
      h.p().hp = 100;
      window.__game.view.me.root.visible = true;
      window.__cam = (cam) => h.look(cam, px + 1.5, h.y(px, pz) + h.lerp(4.2, 3.4, k), pz - h.lerp(5.5, 4.5, k), px, h.y(px, pz) + 1.2, pz + 9, 60);
    },
  );
  await shot(
    'fight', 16.0, 17.5,
    () => g(async () => {
      const h = window.__h, s = h.s(), c = h.c(), { cx, cz } = window.__camp;
      const { spawnMob } = await import('/src/game/sim/mobs.ts');
      h.camp();
      h.clearMobs();
      h.give([['jawblade', 1], ['firebomb', 4]]);
      const p = h.p();
      const blade = p.inv.findIndex((it) => it && it.id === 'jawblade');
      if (blade >= 0 && blade !== 0) s.handle(c.you, { type: 'move', from: blade, to: 0 });
      s.handle(c.you, { type: 'equip', slot: 0 });
      const px = cx - 6, pz = cz + 3;
      h.go(px, pz, Math.atan2(-1, -1));
      spawnMob(s, 'husk', px - 1.4, pz - 1.4, { enraged: true });
      spawnMob(s, 'husk', px - 3.4, pz - 2.6, { enraged: true });
      window.__shot = { px, pz };
      await new Promise((r) => setTimeout(r, 200));
    }),
    () => {
      const h = window.__h, c = h.c(), sh = window.__shot;
      h.p().hp = 100;
      const i = Math.round((window.__t - 16.0) * 30);
      if (i % 8 === 0) c.use();
      const k = i / 45;
      window.__cam = (cam) => h.look(cam, sh.px + h.lerp(5.2, 4.6, k), h.y(sh.px, sh.pz) + 2.8, sh.pz + h.lerp(2.6, 3.2, k), sh.px - 1.2, h.y(sh.px, sh.pz) + 1.2, sh.pz - 1.2, 60);
    },
  );
  await shot(
    'bomb', 17.5, 19.0,
    () => g(async () => {
      const h = window.__h, s = h.s(), { cx, cz } = window.__camp;
      const { spawnMob } = await import('/src/game/sim/mobs.ts');
      h.camp();
      h.give([['firebomb', 4]]);
      h.clearMobs();
      const px = cx + 2, pz = cz + 7;
      h.go(px, pz, Math.atan2(-1, -0.6));
      for (let i = 0; i < 7; i++) spawnMob(s, 'husk', px - 8 + (i % 3) * 1.6, pz - 6 + Math.floor(i / 3) * 1.6, { enraged: true });
      window.__shot = { px, pz, tx: px - 6.4, tz: pz - 4.4 };
      await new Promise((r) => setTimeout(r, 200));
    }),
    () => {
      const h = window.__h, s = h.s(), c = h.c(), sh = window.__shot;
      h.p().hp = 100;
      const i = Math.round((window.__t - 17.5) * 30);
      if (i === 3) {
        const slot = h.p().inv.findIndex((it) => it && it.id === 'firebomb');
        s.handle(c.you, { type: 'throw', slot, x: sh.tx, z: sh.tz });
      }
      window.__cam = (cam) => h.look(cam, sh.px + 5.5, h.y(sh.px, sh.pz) + 6.5, sh.pz + 6.5, sh.tx + 1, h.y(sh.tx, sh.tz) + 0.8, sh.tz + 1, 58);
    },
  );
  await shot(
    'mother', 19.0, 20.5,
    () => g(async () => {
      const h = window.__h, s = h.s(), { cx, cz } = window.__camp;
      const { spawnMob } = await import('/src/game/sim/mobs.ts');
      h.clearMobs();
      h.camp();
      h.time(7, 0.815);
      const mx = cx - 16, mz = cz + 14;
      h.go(mx + 8, mz + 6);
      const you = h.c().you;
      for (const [dx, dz] of [[4, 3], [-3, 4], [3, -3]]) s.handle(you, { type: 'build', kind: 'torch_post', x: mx + dx, z: mz + dz, rot: 0 });
      const m = spawnMob(s, 'mother', mx, mz, { enraged: true });
      window.__shot = { mx, mz, id: m.id };
      await new Promise((r) => setTimeout(r, 600));
    }),
    () => {
      const h = window.__h, sh = window.__shot;
      h.p().hp = 100;
      window.__game.view.me.root.visible = false;
      const k = h.ease((window.__t - 19.0) / 1.5);
      const y0 = h.y(sh.mx, sh.mz);
      window.__cam = (cam) => h.look(cam, sh.mx + h.lerp(10, 8, k), y0 + h.lerp(1.6, 1.2, k), sh.mz + h.lerp(9, 7, k), sh.mx, y0 + h.lerp(2.6, 3.4, k), sh.mz, 60);
    },
  );

  // 7. Together: four survivors round the fire.
  await shot(
    'together', 20.5, 23.5,
    () => g(async () => {
      const h = window.__h, s = h.s(), { cx, cz } = window.__camp;
      h.camp();
      h.calm(true);
      h.clearMobs();
      h.time(3, 0.755);
      const fx = cx, fz = cz + 4.5;
      const friends = [['trailer-a', 'Nova', 'captain.navy'], ['trailer-b', 'Pip', 'flowers.rose'], ['trailer-c', 'Bram', 'ranger.khaki']];
      for (const [id, name, look] of friends) if (!s.players.has(id) || !s.online.has(id)) s.join(id, name, look);
      const seats = [[0.0, 2.1], [1.6, 2.2], [3.3, 2.0], [4.8, 2.2]];
      const ids = [h.c().you, ...friends.map((f) => f[0])];
      ids.forEach((id, i) => {
        const q = s.players.get(id);
        const [a, r] = seats[i];
        q.x = fx + Math.cos(a) * r;
        q.z = fz + Math.sin(a) * r;
        q.ry = Math.atan2(fx - q.x, fz - q.z);
        q.lastPos = s.time;
      });
      h.go(s.players.get(h.c().you).x, s.players.get(h.c().you).z, s.players.get(h.c().you).ry);
      window.__shot = { fx, fz, ids };
      await new Promise((r) => setTimeout(r, 1500));
    }),
    () => {
      const h = window.__h, sh = window.__shot;
      window.__game.view.me.root.visible = true;
      const k = (window.__t - 20.5) / 3;
      const a = 2.3 + k * 0.6;
      window.__cam = (cam) => h.look(cam, sh.fx + Math.cos(a) * 9.5, h.y(sh.fx, sh.fz) + 4.6, sh.fz + Math.sin(a) * 9.5, sh.fx, h.y(sh.fx, sh.fz) + 1.0, sh.fz, 60);
    },
  );
  await g(() => {
    const s = window.__h.s();
    for (const id of ['trailer-a', 'trailer-b', 'trailer-c']) {
      s.online.delete(id);
      s.players.delete(id);
    }
  });

  // 8. Secrets: the bunker door, the wreck at low tide, an X on the map.
  await shot(
    'bunker', 23.5, 24.5,
    () => g(async () => {
      const h = window.__h, s = h.s(), v = window.__game.view;
      h.time(3, 0.45);
      const site = v.pois.find((p) => p.group.getObjectByName('door'));
      site.group.updateMatrixWorld(true);
      const door = site.group.getObjectByName('door').getWorldPosition(new (v.camera.position.constructor)());
      const out = new (v.camera.position.constructor)(0, 0, 4).applyQuaternion(site.group.getObjectByName('door').getWorldQuaternion(new (v.camera.quaternion.constructor)()));
      h.go(door.x + out.x * 1.6, door.z + out.z * 1.6);
      await new Promise((r) => setTimeout(r, 2500));
      window.__shot = { door, out };
    }),
    () => {
      const h = window.__h, s = h.s(), { door, out } = window.__shot;
      const i = Math.round((window.__t - 23.5) * 30);
      if (i === 2) { s.flags.add('bunker_open'); s.broadcastProgress(); }
      window.__game.view.me.root.visible = true;
      window.__cam = (cam) => h.look(cam, door.x + out.x * 2.2 + out.z * 0.9, door.y + 2.6, door.z + out.z * 2.2 - out.x * 0.9, door.x, door.y + 0.9, door.z, 62);
    },
  );
  await shot(
    'wreckship', 24.5, 25.5,
    () => g(async () => {
      const h = window.__h, isl = h.c().island;
      const w = isl.poiById.wreck;
      h.time(3, 0.25);
      h.go(w.x, w.z);
      await new Promise((r) => setTimeout(r, 2500));
      window.__shot = { w };
    }),
    () => {
      const h = window.__h, { w } = window.__shot;
      window.__game.view.me.root.visible = false;
      const k = (window.__t - 24.5);
      const a = 0.6 + k * 0.3;
      window.__cam = (cam) => h.look(cam, w.x + Math.cos(a) * 34, 13, w.z + Math.sin(a) * 34, w.x, 2, w.z, 56);
    },
  );
  await shot(
    'dig', 25.5, 26.5,
    () => g(async () => {
      const h = window.__h, s = h.s(), c = h.c(), isl = c.island;
      h.time(3, 0.5);
      s.notes.add('treasure_1');
      s.broadcastProgress();
      h.give([['shovel', 1]]);
      const p = h.p();
      const sh = p.inv.findIndex((it) => it && it.id === 'shovel');
      if (sh >= 0 && sh !== 0) s.handle(c.you, { type: 'move', from: sh, to: 0 });
      s.handle(c.you, { type: 'equip', slot: 0 });
      const x = isl.treasures[0];
      h.go(x.x + 0.9, x.z + 0.9, Math.atan2(-0.9, -0.9));
      await new Promise((r) => setTimeout(r, 2500));
      window.__shot = { x };
    }),
    () => {
      const h = window.__h, c = h.c(), { x } = window.__shot;
      window.__game.view.me.root.visible = true;
      const i = Math.round((window.__t - 25.5) * 30);
      c.ry = Math.atan2(-0.9, -0.9);
      if (i % 8 === 0) c.use();
      window.__cam = (cam) => h.look(cam, x.x + 5.4, h.y(x.x, x.z) + 3.8, x.z + 3.2, x.x + 0.5, h.y(x.x, x.z) + 0.8, x.z + 0.5, 58);
    },
  );

  // 9. The title over the island at golden hour.
  await shot(
    'title', 26.5, 30,
    () => g(async () => {
      const h = window.__h, isl = h.c().island;
      const crash = isl.poiById.crash;
      h.time(4, 0.72);
      h.wide(true);
      h.go(crash.x, crash.z);
      await new Promise((r) => setTimeout(r, 3500));
      window.__shot = { crash };
    }),
    () => {
      const h = window.__h, { crash } = window.__shot;
      window.__game.view.me.root.visible = false;
      const k = (window.__t - 26.5) / 3.5;
      const a = -2.2 + k * 0.35;
      const el = document.getElementById('ttitle');
      if (el) el.style.opacity = String(Math.min(1, Math.max(0, (window.__t - 26.6) / 0.5)));
      window.__cam = (cam) => h.look(cam, crash.x + Math.cos(a) * 70, 48 - k * 6, crash.z + Math.sin(a) * 70, crash.x, 0, crash.z, 48);
    },
  );
  await g(() => {
    window.__h.wide(false);
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
    () => g(async (phase) => {
      const h = window.__h, isl = h.c().island;
      h.calm(true);
      h.time(2, phase);
      // A beach with the sea up the screen (north-east), nearest the crash site.
      const G = 512;
      let best = null, bd = Infinity;
      for (let gz = 8; gz < G - 8; gz += 2)
        for (let gx = 8; gx < G - 8; gx += 2) {
          if (isl.biomes[gz * G + gx] !== 1 || isl.biomes[(gz - 7) * G + gx + 7] !== 0) continue;
          const x = gx * 2 - 512, z = gz * 2 - 512;
          const d = Math.hypot(x - isl.spawn.x, z - isl.spawn.z);
          if (d < bd && d > 40) { bd = d; best = [x, z]; }
        }
      h.go(best[0], best[1]);
      await new Promise((r) => setTimeout(r, 3500));
      window.__shot = { x: best[0], z: best[1], at: window.__t };
    }, phase),
    (arg) => {
      const h = window.__h, sh = window.__shot;
      window.__game.view.me.root.visible = true;
      const k = (arg.index % 30) / 30;
      window.__cam = (cam) => h.look(cam, sh.x - 9 + k * 3, h.y(sh.x, sh.z) + 7.5, sh.z + 9 + k * 1, sh.x + 4, 0, sh.z - 4);
    },
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
