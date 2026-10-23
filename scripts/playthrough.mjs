// Playwright playthrough of the local preview at phone sizes. Start `npm run dev`
// first (or set PLAYTHROUGH_URL). Prints "clean" when every check passes.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.PLAYTHROUGH_URL ?? 'http://localhost:5173/';
const SHOTS = 'playthrough-shots';
const VIEWPORTS = [
  [375, 667],
  [390, 844],
];

mkdirSync(SHOTS, { recursive: true });
const failures = [];
const check = (ok, what) => {
  if (!ok) failures.push(what);
};

// WebGL in headless Chromium runs on SwiftShader (slow, but enough to play).
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

// The local preview exposes the game as window.__game (dev builds only); the
// playthrough uses it to read state and to skip the slow parts (walking across
// the island, gathering every material by hand).
const game = (page, fn, arg) => page.evaluate(fn, arg);
const teleport = (page, x, z) =>
  game(
    page,
    ([x, z]) => {
      const c = window.__game.client;
      const sim = c.link.sim;
      const p = sim.players.get(c.you);
      p.x = x;
      p.z = z;
      p.lastPos = sim.time;
      c.x = x;
      c.z = z;
    },
    [x, z],
  );
const give = (page, items) =>
  game(
    page,
    (items) => {
      const c = window.__game.client;
      const sim = c.link.sim;
      const p = sim.players.get(c.you);
      for (const [id, n] of items) sim.give(p, id, n);
      sim.dirty(p);
    },
    items,
  );
const hold = (page, id, slot) =>
  game(
    page,
    ([id, slot]) => {
      const c = window.__game.client;
      const i = c.me.inv.findIndex((s) => s && s.id === id);
      if (i !== slot) c.moveSlot(i, slot);
      setTimeout(() => c.select(slot), 250);
    },
    [id, slot],
  );
/**
 * Stands somewhere the building in hand can go right in front (facing north), so the
 * build preview is free. Islands differ per seed, so this searches.
 */
const standToBuild = async (page, kind) => {
  const spot = await game(
    page,
    async (kind) => {
      const { snapPlacement } = await import('/src/game/sim/place.ts');
      const { BUILDINGS } = await import('/src/game/content/buildings.ts');
      const sim = window.__game.client.link.sim;
      // Facing north, the preview sits this far ahead (client.ts updateGhost).
      const ahead = 2.6 + BUILDINGS[kind].d / 2;
      for (let r = 6; r < 220; r += 3) {
        for (let a = 0; a < 24; a++) {
          const x = Math.round(Math.sin((a / 24) * 6.2832) * r);
          const z = 258 + Math.round(Math.cos((a / 24) * 6.2832) * r);
          const g = snapPlacement(kind, x, z - ahead);
          // Either way round (the preview may have been turned).
          if (!sim.placeProblem(kind, g.x, g.z, 0) && !sim.placeProblem(kind, g.x, g.z, 1))
            return [x, z];
        }
      }
      return null;
    },
    kind,
  );
  if (!spot) return false;
  await teleport(page, spot[0], spot[1]);
  await game(page, () => {
    window.__game.client.ry = Math.PI;
  });
  // Frames are slow in headless WebGL: wait for the preview to follow.
  return until(
    page,
    () => {
      const c = window.__game.client;
      return (
        !!c.ghost &&
        Math.abs(c.ghost.z - c.z) < 5 &&
        Math.abs(c.ghost.x - c.x) < 2 &&
        !c.ghost.problem
      );
    },
    `standToBuild: no free preview for ${kind}`,
  );
};

/** Taps the action button where it is (it re-renders often, so no stability wait). */
const pressUse = async (page) => {
  const b = await page.locator('.use-btn').boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
};
const until = async (page, fn, what, ms = 15000, arg) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await game(page, fn, arg)) return true;
    await page.waitForTimeout(200);
  }
  check(false, what);
  return false;
};

/** Solo survival: move, read, gather, craft, build, fight, die, save and continue. */
async function playGame(page, tag, width, height, shot, noSideScroll) {
  await page.goto(URL);
  await page.getByRole('button', { name: 'Play', exact: true }).first().click();
  await page.getByRole('button', { name: /Start surviving/ }).click();
  await page.locator('.hud').waitFor({ timeout: 60000 });
  // World events come on their own; the playthrough sends one when it wants it.
  await game(page, () => {
    window.__game.client.link.sim.nextEvent = Infinity;
  });
  await noSideScroll('game');
  const hotbar = await page.locator('.hotbar').boundingBox();
  const use = await page.locator('.use-btn').boundingBox();
  check(
    hotbar && hotbar.x >= 0 && hotbar.x + hotbar.width <= width,
    `${tag} game: hotbar off screen`,
  );
  check(
    use && hotbar && use.y + use.height <= hotbar.y,
    `${tag} game: action button over the hotbar`,
  );
  check(use && use.x + use.width <= width, `${tag} game: action button off screen`);

  // Walk north with the on-screen stick.
  const start = await game(page, () => window.__game.client.z);
  const zone = await page.locator('.joy-zone').boundingBox();
  const sx = zone.x + 70;
  const sy = zone.y + zone.height - 70;
  // A finger, not a mouse: on PC the mouse clicks the island instead of grabbing the stick.
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
  await touch('touchStart', sx, sy);
  for (let k = 1; k <= 4; k++) await touch('touchMove', sx, sy - k * 11);
  await page.waitForTimeout(1200);
  await touch('touchEnd', sx, sy - 45);
  const moved = start - (await game(page, () => window.__game.client.z));
  check(moved > 0.5, `${tag} game: the stick didn't move the survivor (${moved.toFixed(2)} m)`);

  // Read the boarding pass in the wreckage.
  await teleport(page, -3, 256.6);
  await until(
    page,
    () => window.__game.client.target?.kind === 'spot',
    `${tag} game: no note in reach`,
  );
  await pressUse(page);
  await page.getByText('Boarding pass, Flight MX207').waitFor();
  await shot('5-note');
  await page.keyboard.press('Escape');
  await page.getByText('Find the cockpit').waitFor();

  // Pick up a fallen branch by hand.
  const branch = await game(page, () => {
    const c = window.__game.client;
    const isl = c.island;
    let best = null;
    let bd = Infinity;
    for (let id = 0; id < isl.nodeCount; id++) {
      if (isl.nodeType[id] !== 7 || c.nodeGone(id)) continue;
      const d = Math.hypot(isl.nodeX[id] - c.x, isl.nodeZ[id] - c.z);
      if (d < bd) {
        bd = d;
        best = [isl.nodeX[id], isl.nodeZ[id]];
      }
    }
    return best;
  });
  await teleport(page, branch[0] + 1.2, branch[1]);
  await until(
    page,
    () => window.__game.client.target?.verb === 'Pick up',
    `${tag} game: branch not targeted`,
  );
  await pressUse(page);
  await until(
    page,
    () => window.__game.client.count('wood') >= 1,
    `${tag} game: picking up a branch gave no wood`,
  );

  // Craft a campfire and tools in the bag.
  await give(page, [
    ['wood', 30],
    ['stone', 20],
    ['fiber', 20],
    ['cloth', 4],
  ]);
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Bag and crafting' }).click();
  await page
    .getByRole('button', { name: /Craft$/ })
    .first()
    .click();
  for (const name of ['Campfire', 'Stone axe', 'Bedroll']) {
    await page
      .locator('.recipe', { hasText: name })
      .first()
      .getByRole('button', { name: 'Craft' })
      .click();
    await page.waitForTimeout(250);
  }
  await noSideScroll('craft');
  await shot('6-craft');
  await page.keyboard.press('Escape');
  await until(
    page,
    () => window.__game.client.count('campfire') === 1,
    `${tag} game: campfire not crafted`,
  );

  // Place it in front of you.
  await teleport(page, 12, 272);
  await hold(page, 'campfire', 2);
  await until(page, () => window.__game.client.ghost !== null, `${tag} game: no build preview`);
  // Islands differ per seed: step around until the preview shows a free spot.
  for (const [x, z] of [
    [12, 272],
    [20, 280],
    [-14, 282],
    [26, 266],
    [4, 292],
    [-24, 270],
  ]) {
    await teleport(page, x, z);
    await page.waitForTimeout(400);
    if (!(await game(page, () => window.__game.client.ghost?.problem))) break;
  }
  await pressUse(page);
  await until(
    page,
    () => [...window.__game.client.buildings.values()].some((b) => b.kind === 'campfire'),
    `${tag} game: campfire not placed`,
  );

  // Night falls; a Husk comes. Fight it with a machete.
  await give(page, [['machete', 1]]);
  await game(page, () => {
    window.__game.client.link.sim.time = 600 * 1 + 478;
  });
  await page.getByText('Night falls.').waitFor({ timeout: 15000 });
  // Away from the fire: the taken keep out of its light.
  await teleport(page, 12, 300);
  await hold(page, 'machete', 3);
  await page.waitForTimeout(400);
  await game(page, async () => {
    const c = window.__game.client;
    const mobs = await import('/src/game/sim/mobs.ts');
    const m = mobs.spawnMob(c.link.sim, 'husk', c.x + 1.6, c.z - 1.2, {});
    m.target = c.you;
  });
  await until(
    page,
    () => window.__game.client.target?.hostile === true,
    `${tag} game: husk not targeted`,
  );
  await shot('7-night');
  const useBox = await page.locator('.use-btn').boundingBox();
  await page.mouse.move(useBox.x + useBox.width / 2, useBox.y + useBox.height / 2);
  await page.mouse.down();
  await until(
    page,
    () => window.__game.client.me.kills >= 1,
    `${tag} game: couldn't kill a husk`,
    20000,
  );
  await page.mouse.up();

  // Fall, and wake up at the bedroll... or the crash site.
  await game(page, () => {
    const c = window.__game.client;
    const sim = c.link.sim;
    sim.hurtPlayer(sim.players.get(c.you), 500, c.x, c.z);
  });
  await page.getByText('The Bloom took you').waitFor();
  await shot('8-dead');
  await page.getByRole('button', { name: /Wake up/ }).click();
  await until(page, () => window.__game.client.me.alive, `${tag} game: no respawn`);
  await until(
    page,
    () => window.__game.client.drops.size > 0,
    `${tag} game: no bag where you fell`,
  );
  // Morning, and nothing hunting you, for the calmer checks below.
  await game(page, () => {
    const sim = window.__game.client.link.sim;
    sim.time = 600 * 3 + 200;
    window.__calm = setInterval(() => sim.mobs.clear(), 100);
  });

  // The quick bag stays open while you move; drag items between slots and onto the island.
  await give(page, [
    // After the respawn the bag is empty: enough kinds to spill past the hotbar.
    ['wood', 6],
    ['stone', 4],
    ['fiber', 4],
    ['sap', 2],
    ['cloth', 2],
    ['berries', 3],
    ['snap_tooth', 6],
    ['bloom_tendril', 6],
    ['scrap', 6],
    ['mashbench', 1],
  ]);
  await page.waitForTimeout(400);
  // Every item has a picture (not an emoji that some devices can't draw).
  const pictured = await page
    .waitForFunction(
      () => document.querySelectorAll('.hotbar .slot img.slot-icon').length === 6,
      null,
      { timeout: 10000 },
    )
    .then(() => true)
    .catch(() => false);
  check(pictured, `${tag} game: hotbar items without a picture`);
  await page.getByRole('button', { name: 'Bag and crafting' }).click();
  await page.locator('.quick-panel').waitFor();
  await page.locator('.quick-panel').getByRole('button', { name: 'Bag', exact: true }).click();
  const qz = await game(page, () => window.__game.client.z);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyW');
  check(
    qz - (await game(page, () => window.__game.client.z)) > 0.3,
    `${tag} game: can't move with the quick bag open`,
  );
  const drag = async (from, to) => {
    const a = await from.boundingBox();
    const b = await to.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 + 20, { steps: 4 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(400);
  };
  // A bag item (the quick panel shows the bag; the hotbar is right below it).
  const bagItem = () =>
    game(page, () => {
      const inv = window.__game.client.me.inv;
      const i = inv.findIndex((s, k) => s && k >= 6 && s.id === 'scrap');
      return [i, inv[i]?.id];
    });
  const [fromSlot, movedId] = await bagItem();
  await drag(
    page.locator(`.quick-panel [data-slot="inv:${fromSlot}"]`),
    page.locator('.hotbar [data-slot="inv:5"]'),
  );
  check(
    (await game(page, () => window.__game.client.me.inv[5]?.id)) === movedId,
    `${tag} game: dragging to the hotbar didn't move the item`,
  );
  const bags = await game(page, () => window.__game.client.drops.size);
  const dropSlot = await game(page, () =>
    window.__game.client.me.inv.findIndex((s, k) => s && k >= 6 && s.id === 'berries'),
  );
  await drag(
    page.locator(`.quick-panel [data-slot="inv:${dropSlot}"]`),
    page.locator('.game-canvas'),
  );
  await until(
    page,
    () => window.__game.client.drops.size > 0,
    `${tag} game: dragging onto the island didn't drop the item`,
  );
  check(
    (await game(page, () => window.__game.client.drops.size)) > bags,
    `${tag} game: no bag dropped`,
  );
  await shot('9a-quick-bag');

  // The Mashbench turns monster parts into special gear (quick craft, panel still open).
  await hold(page, 'mashbench', 1);
  await until(page, () => window.__game.client.ghost !== null, `${tag} game: no Mashbench preview`);
  check(await standToBuild(page, 'mashbench'), `${tag} game: nowhere to put the Mashbench`);
  await pressUse(page);
  await until(
    page,
    () => window.__game.client.stations().mash,
    `${tag} game: Mashbench not placed`,
  );
  await page.locator('.quick-panel').getByRole('button', { name: 'Craft', exact: true }).click();
  await page
    .locator('.quick-panel .recipe', { hasText: 'Jawblade' })
    .getByRole('button', { name: 'Craft' })
    .click();
  await until(page, () => window.__game.client.count('jawblade') === 1, `${tag} game: no Jawblade`);
  await shot('9b-mashbench');
  await page.keyboard.press('Escape');
  await page.locator('.quick-panel').waitFor({ state: 'detached' });

  // A Husk's research page tells the Bloom's story.
  await game(page, () => {
    const c = window.__game.client;
    c.link.sim.findPage(c.link.sim.players.get(c.you));
  });
  await page
    .getByText(/Dr. Kessler's research, page \d/)
    .first()
    .waitFor();
  await page.keyboard.press('Escape');

  // Auto tool: with a torch in hand, the axe comes out of the bag for a tree and goes back.
  await give(page, [
    ['torch', 1],
    ['axe_scrap', 1],
  ]);
  await page.waitForTimeout(400);
  await hold(page, 'torch', 0);
  await game(page, () => {
    const c = window.__game.client;
    const i = c.me.inv.findIndex((s) => s && s.id === 'axe_scrap');
    if (i !== 20) setTimeout(() => c.moveSlot(i, 20), 500);
  });
  await page.waitForTimeout(900);
  const tree = await game(page, () => {
    const c = window.__game.client;
    const isl = c.island;
    let best = null;
    let bd = Infinity;
    for (let id = 0; id < isl.nodeCount; id++) {
      if (isl.nodeType[id] > 2 || c.nodeGone(id)) continue;
      const d = Math.hypot(isl.nodeX[id] - c.x, isl.nodeZ[id] - c.z);
      if (d < bd && d > 8) {
        bd = d;
        best = [id, isl.nodeX[id], isl.nodeZ[id]];
      }
    }
    return best;
  });
  await teleport(page, tree[1], tree[2] + 1.6);
  await game(page, () => {
    window.__game.client.ry = Math.PI;
  });
  await until(
    page,
    () => window.__game.client.actionLabel().item === 'axe_scrap',
    `${tag} auto tool: the axe isn't offered for the tree`,
  );
  check(
    (await page.locator('.action-label .label-icon').count()) === 1,
    `${tag} auto tool: no axe picture on the action label`,
  );
  const felled = await game(page, () => window.__game.client.target?.id);
  const chop = await page.locator('.use-btn').boundingBox();
  await page.mouse.move(chop.x + chop.width / 2, chop.y + chop.height / 2);
  await page.mouse.down();
  await until(
    page,
    () => window.__game.client.heldSlot()?.id === 'axe_scrap',
    `${tag} auto tool: didn't take the axe out`,
  );
  await until(
    page,
    (id) => window.__game.client.nodeGone(id),
    `${tag} auto tool: the tree didn't come down`,
    25000,
    felled,
  );
  await page.mouse.up();
  await until(
    page,
    () => {
      const c = window.__game.client;
      return c.heldSlot()?.id === 'torch' && c.me.inv[20]?.id === 'axe_scrap';
    },
    `${tag} auto tool: didn't switch back to the torch`,
  );

  // A Verdance supply pod comes down nearby; its loot is picked up like a bag.
  await game(page, () => {
    const c = window.__game.client;
    const sim = c.link.sim;
    sim.falling.push({ x: c.x + 4, z: c.z - 7, at: sim.time + 4 });
    sim.fx('podfall', c.x + 4, c.z - 7);
  });
  await until(
    page,
    () => [...window.__game.client.drops.values()].some((d) => d.kind === 'pod'),
    `${tag} events: no supply pod landed`,
    20000,
  );
  await shot('9e-pod');
  const pod = await game(page, () => {
    const d = [...window.__game.client.drops.values()].find((d) => d.kind === 'pod');
    return [d.x, d.z];
  });
  await teleport(page, pod[0] + 1.2, pod[1]);
  await until(
    page,
    () => window.__game.client.target?.kind === 'drop',
    `${tag} events: the pod isn't in reach`,
  );
  await pressUse(page);
  await until(
    page,
    () => ![...window.__game.client.drops.values()].some((d) => d.kind === 'pod'),
    `${tag} events: couldn't empty the pod`,
  );

  // The pause menu: solo play waits while it's open.
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByText('Paused').waitFor();
  const t0 = await game(page, () => window.__game.client.link.sim.time);
  await page.waitForTimeout(1200);
  check(
    (await game(page, () => window.__game.client.link.sim.time)) === t0,
    `${tag} menu: the island didn't pause`,
  );
  await noSideScroll('menu');
  await shot('9c-menu');
  // Settings: PC keys can be changed (journal on K instead of J) and volumes set.
  await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByRole('tab', { name: /Controls/ }).click();
  await page.getByRole('button', { name: 'Journal, key 1' }).click();
  await page.keyboard.press('KeyK');
  await page.getByText('K → Journal').waitFor();
  await noSideScroll('controls');
  await page.getByRole('tab', { name: /Audio/ }).click();
  await page.getByRole('slider', { name: 'Music' }).fill('20');
  await page.locator('.set-value', { hasText: '20%' }).waitFor();
  await shot('9d-settings');
  await page.keyboard.press('Escape');
  await page.getByText('Paused').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.menu-screen').waitFor({ state: 'detached' });
  await page.waitForTimeout(600);
  check(
    (await game(page, () => window.__game.client.link.sim.time)) > t0,
    `${tag} menu: the island didn't carry on after the menu`,
  );
  await page.keyboard.press('KeyK');
  await page.locator('.label', { hasText: /Dr. Kessler's research \([1-8]\/8\)/ }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByRole('tab', { name: /Controls/ }).click();
  await page.getByRole('button', { name: 'Reset to defaults' }).click();

  // Landscape: the game turns sideways inside the upright phone, and still plays.
  await page.getByRole('tab', { name: /Screen/ }).click();
  await page.getByRole('radio', { name: /Landscape/ }).click();
  await page.locator('.game.turned').waitFor();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.locator('.menu-screen').waitFor({ state: 'detached' });
  await page.waitForTimeout(600);
  const hb = await page.locator('.hotbar').boundingBox();
  check(
    hb && hb.height > hb.width && hb.x >= 0 && hb.y >= 0 && hb.y + hb.height <= height,
    `${tag} landscape: the hotbar isn't turned on screen`,
  );
  await noSideScroll('landscape');
  await shot('9f-landscape');
  // The stick, turned: pushing towards the top of the turned game walks north.
  const tz = await game(page, () => window.__game.client.z);
  const jz = await page.locator('.joy-zone').boundingBox();
  const jx = jz.x + jz.width / 2;
  const jy = jz.y + jz.height / 2;
  const cdp2 = await page.context().newCDPSession(page);
  const touch2 = (type, x, y) =>
    cdp2.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
  await touch2('touchStart', jx, jy);
  for (let k = 1; k <= 4; k++) await touch2('touchMove', jx + k * 11, jy);
  await page.waitForTimeout(1200);
  await touch2('touchEnd', jx + 44, jy);
  check(
    tz - (await game(page, () => window.__game.client.z)) > 0.5,
    `${tag} landscape: the turned stick didn't walk north`,
  );
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByRole('tab', { name: /Screen/ }).click();
  await page.getByRole('radio', { name: /Portrait/ }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.locator('.menu-screen').waitFor({ state: 'detached' });
  await page.locator('.game.turned').waitFor({ state: 'detached' });
  await page.waitForTimeout(600);

  // Journal and map.
  await page.getByRole('button', { name: 'Journal' }).click();
  await page.getByText('Getting off the island').waitFor();
  await noSideScroll('journal');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open the map' }).click();
  await page.locator('.fullmap').waitFor();
  await shot('9-map');
  await page.mouse.click(10, height - 10);

  // Save, leave and continue where you were.
  const here = await game(page, () => [window.__game.client.x, window.__game.client.z]);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /Save and quit/ }).click();
  await page.getByRole('button', { name: /Continue · Day/ }).click();
  await page.locator('.hud').waitFor({ timeout: 60000 });
  await page.waitForTimeout(500);
  const back = await game(page, () => [
    window.__game.client.x,
    window.__game.client.z,
    window.__game.client.buildings.size,
  ]);
  check(
    Math.hypot(back[0] - here[0], back[1] - here[1]) < 3,
    `${tag} game: continue didn't keep your spot`,
  );
  check(back[2] >= 1, `${tag} game: continue lost the campfire`);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /Save and quit/ }).click();
  await page.getByRole('button', { name: /Continue · Day/ }).waitFor();
}

/** Co-op on the local room server: one hosts, a friend joins with the code. */
async function playCoop() {
  const open = async () => {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(URL);
    await page.getByRole('button', { name: 'Play', exact: true }).first().click();
    return { context, page, errors };
  };
  const host = await open();
  await host.page.getByRole('button', { name: /Play with friends/ }).click();
  await host.page.locator('.hud').waitFor({ timeout: 60000 });
  const code = await game(host.page, () => window.__game.client.link.code);
  check(/^[A-Z0-9]{4,}$/.test(code), `co-op: no room code (${code})`);
  const friend = await open();
  await friend.page.getByRole('button', { name: /Join a friend/ }).click();
  await friend.page.locator('#room-code').fill(code);
  await friend.page.getByRole('button', { name: 'Join', exact: true }).click();
  await friend.page.locator('.hud').waitFor({ timeout: 60000 });
  await until(
    host.page,
    () => window.__game.client.others.size === 1,
    'co-op: the host never saw the friend',
  );
  await until(
    friend.page,
    () => window.__game.client.others.size === 1,
    'co-op: the friend never saw the host',
  );
  await friend.page.screenshot({ path: `${SHOTS}/coop-friend.png` });
  await host.page.getByRole('button', { name: 'Menu' }).click();
  await host.page.getByText(code).first().waitFor();
  await host.page.getByRole('button', { name: /Close the island and quit/ }).click();
  await host.page.getByRole('button', { name: /Continue · Day/ }).waitFor({ timeout: 15000 });
  for (const who of [host, friend]) {
    check(who.errors.length === 0, `co-op console errors: ${who.errors.join(' | ')}`);
    await who.context.close();
  }
  console.log('co-op: done');
}
for (const [width, height] of VIEWPORTS) {
  const tag = `${width}x${height}`;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${tag}-${name}.png` });
  const noSideScroll = async (where) =>
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${tag} ${where}: sideways scroll`,
    );
  const totalVotes = async () =>
    Number((await page.getByText(/votes? so far/).textContent()).match(/\d+/)[0]);

  // Intro on first launch.
  await page.goto(URL);
  await page.getByText('A game the players build.').waitFor();
  await noSideScroll('intro');
  await shot('1-intro');
  const chatButton = page.getByRole('button', { name: 'Say hi in chat' });
  const box = await chatButton.boundingBox();
  check(box && box.y + box.height <= height, `${tag} intro: buttons below the fold`);
  await page.getByRole('button', { name: "Vote on what's next" }).click();

  // One vote per person: the local stand-in seeds 14 vote entries from 13 voters
  // (one voted twice), so 13 count. Voting adds one; moving it adds none.
  await page.getByText(/votes? so far/).waitFor();
  const before = await totalVotes();
  check(before === 13, `${tag} vote: a second vote by one person was counted (${before})`);
  await page.getByText('Round 1 is closed').waitFor();
  await page.getByRole('button', { name: /Tame animals/ }).click();
  await page.getByRole('button', { name: /Tame animals.*Your vote/ }).waitFor();
  check((await totalVotes()) === before + 1, `${tag} vote: total did not go up by one`);
  await page.getByRole('button', { name: /Bows & ranged/ }).click();
  await page.getByRole('button', { name: /Bows & ranged.*Your vote/ }).waitFor();
  check((await totalVotes()) === before + 1, `${tag} change vote: total changed`);
  check((await page.locator('.option.picked').count()) === 1, `${tag} vote: not exactly one pick`);
  await noSideScroll('vote');
  await shot('2-vote');
  check(
    (await page.getByRole('button', { name: 'Dev', exact: true }).count()) === 0,
    `${tag} a player sees the Dev tab`,
  );

  // Chat: post, delete, report, and the friendly-words filter.
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await page.getByText('ARPG with loot please').waitFor();
  const input = page.getByLabel('Message');
  await input.fill('  hello   from the playthrough  ');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByText('hello from the playthrough').waitFor();
  check((await input.inputValue()) === '', `${tag} chat: draft not cleared`);
  await noSideScroll('chat');
  await shot('3-chat');
  await page.getByText('hello from the playthrough').click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByText('hello from the playthrough').waitFor({ state: 'detached' });
  // Players can delete only their own messages; others' can only be reported.
  await page.getByText('ARPG with loot please').click();
  await page.getByRole('button', { name: 'Report' }).waitFor();
  check(
    (await page.getByRole('button', { name: 'Delete' }).count()) === 0,
    `${tag} chat: a player can delete someone else's message`,
  );
  await page.getByRole('button', { name: 'Report' }).click();
  await page.getByText('ARPG with loot please').waitFor({ state: 'detached' });
  await page.getByText('reported and hidden').waitFor();
  await input.fill('this is a badword');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByText("Let's keep it friendly").waitFor();
  check(
    (await page.getByText('this is a badword').count()) === 0,
    `${tag} chat: unclean message posted`,
  );

  // About repeats the intro; a reload skips it.
  await page.getByRole('button', { name: 'About', exact: true }).click();
  await page.getByText('A game the players build.').waitFor();
  await noSideScroll('about');
  await page.waitForTimeout(400); // the mock writes appStorage after ~100 ms
  await page.reload();
  await page.getByText('Bloom Island').waitFor();
  check(
    (await page.getByText('A game the players build.').count()) === 0,
    `${tag} intro shown again`,
  );

  // Settings from the Play tab too.
  await page.getByRole('button', { name: /Settings/ }).click();
  const autoTool = page.getByRole('switch', { name: 'Auto tool' });
  await autoTool.click();
  check(
    (await autoTool.getAttribute('aria-checked')) === 'false',
    `${tag} settings: Auto tool didn't turn off`,
  );
  await autoTool.click();
  await noSideScroll('settings');
  await page.getByRole('button', { name: 'Close settings' }).click();

  // The game's owner (?owner plays the owner in the local preview) can delete
  // anyone's message.
  await page.goto(`${URL}?owner`);
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await page.getByText('first! what is this game going to be?').click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByText('first! what is this game going to be?').waitFor({ state: 'detached' });

  // Dev area (owner only): the seeded spam was hidden by 3 reports, Bram's message
  // has one open report. Delete the spam, keep Bram's, then both are resolved.
  const devTab = page.getByRole('button', { name: 'Dev', exact: true });
  await page.locator('.tab-badge', { hasText: '2' }).waitFor();
  await devTab.click();
  const spamCard = page.locator('.flag', { hasText: 'FREE GOLD click my profile' });
  const bramCard = page.locator('.flag', { hasText: 'a roguelike where every run' });
  await spamCard.waitFor();
  check(
    (await spamCard.getByText('Hidden from players').count()) === 1,
    `${tag} dev: hidden message not marked hidden`,
  );
  check(
    (await spamCard.getByText('rundot ugc approve').count()) === 1,
    `${tag} dev: no restore command for a hidden message`,
  );
  await noSideScroll('dev');
  await shot('4-dev');
  await spamCard.getByRole('button', { name: 'Delete message' }).click();
  await spamCard.waitFor({ state: 'detached' });
  await bramCard.getByRole('button', { name: 'Keep' }).click();
  await page.getByText('No open reports').waitFor();
  check((await page.locator('.tab-badge').count()) === 0, `${tag} dev: badge after clearing`);
  await page.getByRole('tab', { name: 'Resolved' }).click();
  await spamCard.getByText('Resolved: deleted').waitFor();
  await bramCard.getByText('Resolved: kept').waitFor();
  // Kept messages stay in the chat; deleted ones don't.
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await page.getByText('a roguelike where every run').waitFor();
  check(
    (await page.getByText('FREE GOLD click my profile').count()) === 0,
    `${tag} dev: deleted message still in chat`,
  );

  await playGame(page, tag, width, height, shot, noSideScroll);

  check(errors.length === 0, `${tag} console errors: ${errors.join(' | ')}`);
  console.log(`${tag}: done`);
  await context.close();
}
await playCoop();
await browser.close();

if (failures.length) {
  console.log(`FAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('clean');
