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
/** A finger on a touch screen (raw touch events, so swipes scroll like on a phone). */
const fingerOn = async (page) => {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
    });
  const path = async (x0, y0, x1, y1, steps = 12) => {
    for (let i = 1; i <= steps; i++) {
      await send('touchMove', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
      await page.waitForTimeout(20);
    }
  };
  return {
    tap: async (x, y) => {
      await send('touchStart', x, y);
      await page.waitForTimeout(60);
      await send('touchEnd', x, y);
      await page.waitForTimeout(300);
    },
    swipe: async (x, y, dy) => {
      await send('touchStart', x, y);
      await path(x, y, x, y + dy);
      await send('touchEnd', x, y + dy);
      await page.waitForTimeout(500);
    },
    /** Press and hold, then drag to (x1, y1). */
    holdDrag: async (x0, y0, x1, y1) => {
      await send('touchStart', x0, y0);
      await page.waitForTimeout(450);
      await path(x0, y0, x1, y1);
      await send('touchEnd', x1, y1);
      await page.waitForTimeout(500);
    },
    done: () => cdp.detach(),
  };
};
/** Where a spot on the island shows on screen, and whether the island is what's there. */
const onIsland = (page, x, up, z) =>
  game(
    page,
    ([x, up, z]) => {
      const view = window.__view;
      const cam = view.camera;
      const y = view.y(x, z) + up;
      const mul = (e, v) =>
        [0, 1, 2, 3].map((r) => e[r] * v[0] + e[4 + r] * v[1] + e[8 + r] * v[2] + e[12 + r] * v[3]);
      const q = mul(
        cam.projectionMatrix.elements,
        mul(cam.matrixWorldInverse.elements, [x, y, z, 1]),
      );
      const sx = ((q[0] / q[3] + 1) / 2) * innerWidth;
      const sy = ((1 - q[1] / q[3]) / 2) * innerHeight;
      const el = document.elementFromPoint(sx, sy);
      return [sx, sy, /game-canvas|joy-zone/.test(el?.className ?? '')];
    },
    [x, up, z],
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

/** Somewhere near the crash site with nothing to bump into for a few metres. */
const openGround = async (page) => {
  const spot = await game(page, async () => {
    const { forNodesNear, hitCollider, heightAt } = await import('/src/game/world.ts');
    const { NODES } = await import('/src/game/content/nodes.ts');
    const c = window.__game.client;
    for (let r = 10; r < 200; r += 4) {
      for (let a = 0; a < 16; a++) {
        const x = Math.round(Math.sin((a / 16) * 6.2832) * r);
        const z = 262 + Math.round(Math.cos((a / 16) * 6.2832) * r);
        let blocked = !!hitCollider(c.island, x, z, 6) || heightAt(c.island, x, z) < 0.5;
        forNodesNear(c.island, x, z, 6, (id) => {
          if ((NODES[c.island.nodeType[id]]?.radius ?? 0) > 0 && !c.nodeGone(id)) blocked = true;
        });
        for (const b of c.buildings.values()) if (Math.hypot(b.x - x, b.z - z) < 7) blocked = true;
        if (!blocked) return [x, z];
      }
    }
    return null;
  });
  if (spot) await teleport(page, spot[0], spot[1]);
  await page.waitForTimeout(300);
};

/** Taps the action button where it is (it re-renders often, so no stability wait). */
const pressUse = async (page) => {
  const b = await page.locator('.use-btn').boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
};
/** Presses the action button until `fn` holds (headless frames are slow: the button's
 * cooldown runs on frame time, so a press can land a moment early). */
const pressUntil = async (page, fn, arg, tries = 8) => {
  for (let k = 0; k < tries; k++) {
    if (await game(page, fn, arg)) return true;
    await pressUse(page);
    await page.waitForTimeout(700);
  }
  return game(page, fn, arg);
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

/**
 * The New island screen: make the island with this code (the playthrough's steps
 * assume the classic layout), try the rule presets, then pick `preset` and start.
 */
async function newIsland(page, tag, code, preset, noSideScroll) {
  await page.locator('.new-island').waitFor();
  await page.getByLabel('Island code').fill('NOT A CODE');
  await page.getByRole('button', { name: 'Use', exact: true }).click();
  await page.getByText("That isn't an island code.").waitFor();
  await page.getByLabel('Island code').fill(code);
  await page.getByRole('button', { name: 'Use', exact: true }).click();
  await until(
    page,
    (c) => document.querySelector('[data-testid="island-code"]')?.textContent === c,
    `${tag} new island: the code wasn't used`,
    15000,
    code,
  );
  await page.locator('.map-busy').waitFor({ state: 'detached', timeout: 30000 });
  if (noSideScroll) await noSideScroll('new island');
  // Presets fill in every rule; the night speed shows Nightmare's sprint.
  await page.getByRole('radio', { name: 'Nightmare' }).click();
  const night = page.getByRole('radiogroup', { name: 'How fast they move at night' });
  check(
    (await night.getByRole('radio', { name: 'Sprint' }).getAttribute('aria-checked')) === 'true',
    `${tag} new island: the Nightmare preset didn't set the night speed`,
  );
  await page.getByRole('radio', { name: preset }).click();
  const name = await page.locator('[data-testid="island-name"]').textContent();
  await page.getByRole('button', { name: `✈️ Start on ${name}` }).click();
  return name;
}

/** Solo survival: move, read, gather, craft, build, fight, die, save and continue. */
async function playGame(page, tag, width, height, shot, noSideScroll) {
  await page.goto(URL);
  await page.getByRole('button', { name: /Start surviving/ }).click();
  await shot('5-new-island');
  const islandName = await newIsland(page, tag, 'TR-C0-4242', 'Survivor', noSideScroll);
  await page.locator('.hud').waitFor({ timeout: 60000 });
  check((await page.locator('.chat-btn').count()) === 0, `${tag} solo: a chat button`);
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

  // Craft tools in the bag; buildings come from build mode.
  await give(page, [
    ['wood', 30],
    ['stone', 20],
    ['fiber', 20],
    ['cloth', 4],
  ]);
  await page.waitForTimeout(400);
  // 🎒 opens the survivor menu: the survivor and bag, crafting by category, skills.
  await page.getByRole('button', { name: 'Bag and crafting' }).click();
  const menu = page.locator('.char-menu');
  await menu.waitFor();
  check(
    (await menu.getByRole('tab', { name: /Survivor/ }).getAttribute('aria-selected')) === 'true',
    `${tag} menu: didn't open on the survivor`,
  );
  check(
    (await menu.locator('.survivor-figure').count()) === 1 &&
      (await menu.locator('[data-slot="inv:23"]').count()) === 1,
    `${tag} menu: no survivor or bag`,
  );
  await noSideScroll('survivor menu');
  await menu.getByRole('tab', { name: /Crafting/ }).click();
  const recipes = menu.locator('.recipe-grid');
  check(
    (await recipes.getByRole('button', { name: /^(Campfire|Bedroll|Workbench)$/ }).count()) === 0,
    `${tag} craft: buildings are still crafted`,
  );
  await menu.getByRole('tab', { name: /Medicine/ }).click();
  check(
    (await recipes.getByRole('button', { name: 'Bandage', exact: true }).count()) === 1 &&
      (await recipes.getByRole('button', { name: 'Stone axe', exact: true }).count()) === 0,
    `${tag} craft: the Medicine category isn't just medicine`,
  );
  await menu.getByRole('tab', { name: /All/ }).click();
  for (const name of ['Stone axe', 'Bandage']) {
    await recipes.getByRole('button', { name, exact: true }).click();
    await menu.locator('.recipe-detail .item-name', { hasText: name }).waitFor();
    await menu
      .locator('.recipe-detail')
      .getByRole('button', { name: 'Craft', exact: true })
      .click();
    await page.waitForTimeout(250);
  }
  await noSideScroll('craft');
  await shot('6-craft');
  await until(
    page,
    () => window.__game.client.count('axe_stone') === 1,
    `${tag} game: stone axe not crafted`,
  );
  // Levels: what you do earns XP; a level brings a skill point for the tree.
  check(
    (await game(page, () => window.__game.client.me.xp)) > 0,
    `${tag} skills: crafting earned no XP`,
  );
  await game(page, () => {
    const c = window.__game.client;
    c.link.sim.gainXp(c.link.sim.players.get(c.you), 100);
  });
  await until(
    page,
    () => window.__game.client.progress().points >= 1,
    `${tag} skills: no skill point at level 2`,
  );
  await menu.getByRole('tab', { name: /Skills/ }).click();
  await menu.getByRole('button', { name: /^Forager, rank 0/ }).click();
  check(
    await menu
      .locator('.perk-detail')
      .getByRole('button', { name: /^Learn/ })
      .isDisabled(),
    `${tag} skills: a tier 2 skill was open with no points in the branch`,
  );
  await menu.getByRole('button', { name: /^Lumberjack, rank 0/ }).click();
  await menu
    .locator('.perk-detail')
    .getByRole('button', { name: /^Learn/ })
    .click();
  await until(
    page,
    () => window.__game.client.me.perks.lumberjack === 1,
    `${tag} skills: Lumberjack not learned`,
  );
  await menu.getByRole('button', { name: /^Lumberjack, rank 1 of 3/ }).waitFor();
  await noSideScroll('skills');
  await shot('6a-skills');
  // On a phone the menu scrolls even when the swipe starts on a tile or a slot, and a press
  // and hold lifts an item to drag it.
  const finger = await fingerOn(page);
  await menu.getByRole('tab', { name: /Crafting/ }).click();
  const tileBox = await menu.locator('.recipe-tile').nth(6).boundingBox();
  await finger.swipe(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2, -200);
  const scrolled = await game(page, () => document.querySelector('.char-body')?.scrollTop ?? 0);
  check(scrolled > 20, `${tag} menu: a swipe on the crafting grid didn't scroll (${scrolled})`);
  await menu.getByRole('tab', { name: /Survivor/ }).click();
  // Enough kinds of things that some sit in the bag, past the hotbar.
  await give(page, [
    ['coconut', 1],
    ['feather', 1],
    ['hide', 1],
    ['scrap', 1],
    ['sap', 1],
    ['berries', 1],
  ]);
  await page.waitForTimeout(400);
  const lift = await game(page, () => {
    const inv = window.__game.client.me.inv;
    const from = inv.findIndex((s, i) => s && i >= 6);
    return [from, inv[from]?.id];
  });
  // Back to the top of the list, so both slots are where the finger goes.
  await game(page, () => {
    const body = document.querySelector('.char-body');
    if (body) body.scrollTop = 0;
  });
  await page.waitForTimeout(300);
  const fromBox = await menu.locator(`[data-slot="inv:${lift[0]}"]`).boundingBox();
  const toBox = await menu.locator('[data-slot="inv:5"]').boundingBox();
  check(
    await game(
      page,
      ([x, y, key]) =>
        document.elementFromPoint(x, y)?.closest('[data-slot]')?.dataset.slot === key,
      [fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2, `inv:${lift[0]}`],
    ),
    `${tag} menu: the bag slot to drag isn't under the finger`,
  );
  await finger.holdDrag(
    fromBox.x + fromBox.width / 2,
    fromBox.y + fromBox.height / 2,
    toBox.x + toBox.width / 2,
    toBox.y + toBox.height / 2,
  );
  check(
    (await game(page, () => window.__game.client.me.inv[5]?.id)) === lift[1],
    `${tag} menu: a press and hold didn't drag ${lift[1]} to the hotbar`,
  );
  await finger.done();
  await menu.getByRole('button', { name: 'Close' }).click();
  await menu.waitFor({ state: 'detached' });
  check((await page.locator('.level-badge').count()) === 1, `${tag} hud: no level badge`);

  // Nothing roams while we build (build mode stands you still, and a bite takes you out of it).
  await game(page, () => {
    const sim = window.__game.client.link.sim;
    window.__calmBuild = setInterval(() => sim.mobs.clear(), 100);
  });

  // Build a campfire: pick it in build mode, and it's paid for straight from the bag.
  await teleport(page, 12, 272);
  await page.getByRole('button', { name: 'Build mode' }).click();
  await page.locator('.build-panel').waitFor();
  await page.locator('.build-panel .build-title').hover();
  await page.locator('.build-bar').getByRole('tab', { name: 'Camp' }).click();
  await page.locator('.build-bar').getByRole('button', { name: 'Campfire' }).click();
  check(
    (await page.locator('.build-cost').textContent()).includes('/5'),
    `${tag} build: the campfire's cost isn't shown`,
  );
  const wood0 = await game(page, () => window.__game.client.count('wood'));
  // Islands differ per seed: step around until the piece has a free spot.
  for (const [x, z] of [
    [12, 272],
    [20, 280],
    [-14, 282],
    [26, 266],
    [4, 292],
    [-24, 270],
  ]) {
    await teleport(page, x, z);
    await game(page, () => {
      const c = window.__game.client;
      c.setBuildCursor({ x: c.x, z: c.z - 3 });
    });
    await page.waitForTimeout(400);
    if (await game(page, () => !!window.__game.client.ghost && !window.__game.client.ghost.problem))
      break;
  }
  await pressUse(page);
  await until(
    page,
    () => [...window.__game.client.buildings.values()].some((b) => b.kind === 'campfire'),
    `${tag} game: campfire not built`,
  );
  await until(
    page,
    (w0) => w0 - window.__game.client.count('wood') === 5,
    `${tag} build: the campfire didn't take 5 wood`,
    15000,
    wood0,
  );
  await page.getByRole('button', { name: 'Leave build mode' }).first().click();
  await page.locator('.build-panel').waitFor({ state: 'detached' });
  // Quests under the minimap: the way off, and the first night with the campfire ticked.
  await page.locator('.quest', { hasText: 'Survivors of MX207' }).waitFor();
  await page
    .locator('.quest', { hasText: 'The first night' })
    .locator('li.done', { hasText: 'campfire' })
    .waitFor();

  // Build mode: walls snap to the grid and meet at a corner, a post on the joint; the
  // take-down tool removes one again.
  await give(page, [
    ['wall_wood', 3],
    ['post_wood', 2],
  ]);
  await openGround(page);
  await page.getByRole('button', { name: 'Build mode' }).click();
  await page.locator('.build-panel').waitFor();
  // The mouse would aim the piece: park it on the build panel.
  await page.locator('.build-panel .build-title').hover();
  await page.locator('.build-bar').getByRole('tab', { name: 'Walls' }).click();
  await page.locator('.build-bar').getByRole('button', { name: 'Wooden wall' }).click();
  const before = await game(page, () => window.__game.client.buildings.size);
  const placePiece = async (piece, dx, dz, rot) => {
    await page.locator('.build-bar').getByRole('button', { name: piece }).click();
    await game(
      page,
      ([dx, dz, rot]) => {
        const c = window.__game.client;
        c.build.rot = rot;
        c.setBuildCursor({ x: c.x + dx, z: c.z + dz });
      },
      [dx, dz, rot],
    );
    await until(
      page,
      () => !!window.__game.client.ghost && !window.__game.client.ghost.problem,
      `${tag} build: no free spot for ${piece}`,
    );
    const n = await game(page, () => window.__game.client.buildings.size);
    // Headless frames are slow and the action has a short cooldown: press until it's down.
    for (let k = 0; k < 8; k++) {
      await pressUse(page);
      await page.waitForTimeout(700);
      if ((await game(page, () => window.__game.client.buildings.size)) > n) break;
    }
    check(
      (await game(page, () => window.__game.client.buildings.size)) > n,
      `${tag} build: ${piece} wasn't placed`,
    );
  };
  await placePiece('Wooden wall', -1, -3, 0);
  await placePiece('Wooden wall', 1, -3, 0);
  await placePiece('Wooden wall', -2, -2, 1);
  await placePiece('Wooden post', -2, -3, 0);
  const built = await game(page, () =>
    [...window.__game.client.buildings.values()].filter((b) => b.kind !== 'campfire'),
  );
  check(built.length - (before - 1) === 4, `${tag} build: expected 4 pieces (${built.length})`);
  // On the 2 m grid: walls along grid lines (even), their middles on odd metres.
  const walls = built.filter((b) => b.kind === 'wall_wood');
  check(
    walls.every((b) =>
      b.rot & 1
        ? b.x % 2 === 0 && Math.abs(b.z % 2) === 1
        : b.z % 2 === 0 && Math.abs(b.x % 2) === 1,
    ),
    `${tag} build: walls not on the grid (${JSON.stringify(walls.map((b) => [b.x, b.z, b.rot]))})`,
  );
  // The turn buttons and the snap switch.
  const rot0 = await game(page, () => window.__game.client.build.rot);
  await page.getByRole('button', { name: 'Turn right' }).click();
  check(
    (await game(page, () => window.__game.client.build.rot)) === (rot0 + 1) % 4,
    `${tag} build: Turn right didn't turn the piece`,
  );
  const snap = page.getByRole('switch', { name: /Snap/ });
  await snap.click();
  check(
    (await snap.getAttribute('aria-checked')) === 'false',
    `${tag} build: snap didn't turn off`,
  );
  await snap.click();
  await noSideScroll('build mode');
  await shot('6b-build');
  // Take one wall down again.
  await page.locator('.build-bar').getByRole('tab', { name: 'Take down' }).click();
  const wall = walls[0];
  await game(page, ([x, z]) => window.__game.client.setBuildCursor({ x, z }), [wall.x, wall.z]);
  await until(
    page,
    () => window.__game.client.build.remove !== null,
    `${tag} build: the take-down tool found nothing`,
  );
  const count = await game(page, () => window.__game.client.buildings.size);
  await pressUse(page);
  await until(
    page,
    (n) => window.__game.client.buildings.size === n - 1,
    `${tag} build: the wall didn't come down`,
    15000,
    count,
  );
  // Anywhere in the grid: a post 10 m or more away, without walking there.
  await give(page, [['wood', 40]]);
  const far = await game(page, () => {
    const c = window.__game.client;
    const sim = c.link.sim;
    for (let r = 10; r <= 18; r += 2)
      for (const [ux, uz] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]) {
        const x = 2 * Math.round((c.x + ux * r) / 2);
        const z = 2 * Math.round((c.z + uz * r) / 2);
        const d = Math.hypot(x - c.x, z - c.z);
        if (d >= 10 && d <= 20 && !sim.placeProblem('post_wood', x, z, 0)) return [x, z];
      }
    return null;
  });
  check(!!far, `${tag} build: no open spot 10–18 m away`);
  if (far) {
    await page.locator('.build-bar').getByRole('tab', { name: 'Walls' }).click();
    await page.locator('.build-bar').getByRole('button', { name: 'Wooden post' }).click();
    await game(page, ([x, z]) => window.__game.client.setBuildCursor({ x, z }), far);
    await until(
      page,
      ([x, z]) => {
        const g = window.__game.client.ghost;
        return !!g && !g.problem && Math.hypot(g.x - x, g.z - z) < 0.01;
      },
      `${tag} build: the piece didn't follow the cursor ${far}`,
      15000,
      far,
    );
    const hasFar = ([x, z]) =>
      [...window.__game.client.buildings.values()].some(
        (b) => b.kind === 'post_wood' && Math.hypot(b.x - x, b.z - z) < 0.01,
      );
    await pressUntil(page, hasFar, far);
    check(await game(page, hasFar, far), `${tag} build: nothing placed ${far} away`);
  }
  // Roofs come down again: with 🏠 On the take-down tool picks the roof over a floor first.
  const cell = await game(page, () => {
    const c = window.__game.client;
    const sim = c.link.sim;
    for (let r = 3; r <= 9; r += 2)
      for (const [ux, uz] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ]) {
        const x = 2 * Math.floor((c.x + ux * r) / 2) + 1;
        const z = 2 * Math.floor((c.z + uz * r) / 2) + 1;
        const clear = [...sim.buildings.values()].every((b) => Math.hypot(b.x - x, b.z - z) > 2);
        if (clear && !sim.placeProblem('floor_wood', x, z, 0)) {
          sim.handle(c.you, { type: 'build', kind: 'floor_wood', x, z, rot: 0 });
          sim.handle(c.you, { type: 'build', kind: 'roof_thatch', x, z, rot: 0 });
          return [x, z];
        }
      }
    return null;
  });
  check(!!cell, `${tag} build: no spot for a floor and a roof`);
  if (cell) {
    // What stands on the cell, sorted (runs in the page).
    const stacked = ([x, z]) =>
      [...window.__game.client.buildings.values()]
        .filter((b) => Math.hypot(b.x - x, b.z - z) < 0.01)
        .map((b) => b.kind)
        .sort()
        .join();
    await until(
      page,
      ([x, z]) =>
        [...window.__game.client.buildings.values()].filter(
          (b) => Math.hypot(b.x - x, b.z - z) < 0.01,
        ).length === 2,
      `${tag} build: the floor and roof weren't built`,
      15000,
      cell,
    );
    await page.locator('.build-bar').getByRole('tab', { name: 'Take down' }).click();
    await game(page, ([x, z]) => window.__game.client.setBuildCursor({ x, z }), cell);
    // Auto: roofs fade under the cursor and don't come down; 🏠 On: they do.
    check(
      (await game(page, () => window.__game.client.removeStack().length)) === 1,
      `${tag} build: roofs auto still offers the roof`,
    );
    await page.getByRole('button', { name: 'Roofs: auto' }).click();
    await page.getByRole('button', { name: 'Roofs: on' }).waitFor();
    await until(
      page,
      () => {
        const c = window.__game.client;
        const id = c.removeTarget();
        return id !== null && c.buildings.get(id)?.kind === 'roof_thatch';
      },
      `${tag} build: the take-down tool didn't pick the roof`,
    );
    const said = await page
      .locator('.build-panel')
      .getByText(/1 of 2 here/)
      .waitFor({ timeout: 10000 })
      .then(
        () => true,
        () => false,
      );
    check(
      said,
      `${tag} build: the panel doesn't say what's stacked here (${await page.locator('.build-panel').innerText()})`,
    );
    await pressUntil(
      page,
      ([x, z]) =>
        ![...window.__game.client.buildings.values()].some(
          (b) => b.kind === 'roof_thatch' && Math.hypot(b.x - x, b.z - z) < 0.01,
        ),
      cell,
    );
    const left = await game(page, stacked, cell);
    check(left === 'floor_wood', `${tag} build: the roof didn't come down (${left})`);

    // Build mode on a touch screen: no stick, the survivor stands still; a drag on the
    // island looks around, a tap picks the piece under the finger (the roof with 🏠 On,
    // what's under it with 🏠 Off).
    check(
      (await page.locator('.joy-zone').count()) === 0,
      `${tag} build: the stick is still there`,
    );
    await give(page, [
      ['fiber', 20],
      ['wood', 20],
    ]);
    await game(
      page,
      ([x, z]) => {
        const c = window.__game.client;
        c.link.sim.handle(c.you, { type: 'build', kind: 'roof_thatch', x, z, rot: 0 });
        c.panBuild(x - c.x - c.buildLook.x, z - c.z - c.buildLook.z);
      },
      cell,
    );
    await page.waitForTimeout(1800);
    const cdp = await page.context().newCDPSession(page);
    const finger = (type, x, y) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
      });
    // Where a spot on the island is on screen, and whether the island is what's there.
    const onScreen = (p) =>
      game(
        page,
        ([x, up, z]) => {
          const view = window.__view;
          const cam = view.camera;
          const y = view.y(x, z) + up;
          const mul = (e, v) =>
            [0, 1, 2, 3].map(
              (r) => e[r] * v[0] + e[4 + r] * v[1] + e[8 + r] * v[2] + e[12 + r] * v[3],
            );
          const q = mul(
            cam.projectionMatrix.elements,
            mul(cam.matrixWorldInverse.elements, [x, y, z, 1]),
          );
          const sx = ((q[0] / q[3] + 1) / 2) * innerWidth;
          const sy = ((1 - q[1] / q[3]) / 2) * innerHeight;
          return [sx, sy, document.elementFromPoint(sx, sy)?.tagName === 'CANVAS'];
        },
        p,
      );
    const tapAt = async ([x, y]) => {
      await finger('touchStart', x, y);
      await page.waitForTimeout(60);
      await finger('touchEnd', x, y);
      await page.waitForTimeout(500);
    };
    const picked = () => {
      const c = window.__game.client;
      const id = c.build?.remove;
      return id !== null && id !== undefined ? c.buildings.get(id)?.kind : null;
    };
    const roofSpot = await onScreen([cell[0], 2.9, cell[1]]);
    check(roofSpot[2], `${tag} build: the roof is under the HUD (${roofSpot})`);
    await tapAt(roofSpot);
    const gotRoof = await game(page, picked);
    check(gotRoof === 'roof_thatch', `${tag} build: a tap with roofs on picked ${gotRoof}`);
    await page.getByRole('button', { name: 'Roofs: on' }).click();
    await page.getByRole('button', { name: 'Roofs: off' }).waitFor();
    const floorSpot = await onScreen([cell[0], 0.05, cell[1]]);
    await tapAt(floorSpot);
    const gotFloor = await game(page, picked);
    check(gotFloor === 'floor_wood', `${tag} build: a tap with roofs off picked ${gotFloor}`);
    await shot('6c-roofs-off');
    await page.getByRole('button', { name: 'Roofs: off' }).click();
    await page.getByRole('button', { name: 'Roofs: auto' }).waitFor();
    // A drag looks around; the survivor stays put.
    const stood = await game(page, () => [window.__game.client.x, window.__game.client.z]);
    const look0 = await game(page, () => ({ ...window.__game.client.buildLook }));
    const [fx, fy] = floorSpot;
    await finger('touchStart', fx, fy);
    for (let k = 1; k <= 10; k++) {
      await finger('touchMove', fx - k * 8, fy + k * 6);
      await page.waitForTimeout(40);
    }
    await finger('touchEnd', fx - 80, fy + 60);
    await page.waitForTimeout(400);
    const look1 = await game(page, () => ({ ...window.__game.client.buildLook }));
    const stood1 = await game(page, () => [window.__game.client.x, window.__game.client.z]);
    check(
      Math.hypot(look1.x - look0.x, look1.z - look0.z) > 1,
      `${tag} build: a drag didn't look around`,
    );
    check(
      Math.hypot(stood1[0] - stood[0], stood1[1] - stood[1]) < 0.01,
      `${tag} build: the survivor moved in build mode`,
    );
    await cdp.detach();
  }
  await page.getByRole('button', { name: 'Leave build mode' }).first().click();
  await page.locator('.build-panel').waitFor({ state: 'detached' });

  // On a phone a tap on the ground walks there, and a tap on a tree walks over and chops it
  // down.
  {
    const finger = await fingerOn(page);
    // Away from the crash site's notes and luggage tags (a tap near one reads it).
    const clear = await game(page, () => {
      const c = window.__game.client;
      const view = window.__view;
      for (let r = 30; r <= 160; r += 10)
        for (let a = 0; a < 16; a++) {
          const x = c.x + Math.sin((a / 16) * 6.283) * r;
          const z = c.z + Math.cos((a / 16) * 6.283) * r;
          if (view.y(x, z) < 0.6) continue;
          const spots = c.island.pois.some((p) =>
            p.spots.some((s) => Math.hypot(p.x + s.dx - x, p.z + s.dz - z) < 18),
          );
          const built = [...c.buildings.values()].some((b) => Math.hypot(b.x - x, b.z - z) < 12);
          if (!spots && !built) return [x, z];
        }
      return null;
    });
    check(!!clear, `${tag} tap: no clearing away from the crash site`);
    if (clear) await teleport(page, clear[0], clear[1]);
    await page.waitForTimeout(1500);
    const from = await game(page, () => [window.__game.client.x, window.__game.client.z]);
    // A spot a few metres away that shows on the island (not under a button or a card).
    let spot = null;
    for (const [dx, dz] of [
      [3.5, -3.5],
      [-3.5, -3.5],
      [4.5, 0],
      [-4.5, 0],
      [0, -4.5],
      [3, 3],
      [-3, 3],
    ]) {
      const at = await onIsland(page, from[0] + dx, 0, from[1] + dz);
      // Plain ground: not a note, a bag or a tree that a tap there would walk to and use.
      const what = at[2] && (await game(page, ([x, y]) => window.__view.pickAt(x, y)?.kind, at));
      if (what === 'ground') {
        spot = at;
        break;
      }
    }
    check(!!spot, `${tag} tap: no plain ground to walk to on screen`);
    if (spot) {
      await finger.tap(spot[0], spot[1]);
      await until(
        page,
        ([x, z]) => Math.hypot(window.__game.client.x - x, window.__game.client.z - z) > 2,
        `${tag} tap: a tap on the ground didn't walk there`,
        15000,
        from,
      );
    }
    const tree = await game(page, () => {
      const c = window.__game.client;
      const isl = c.island;
      let best = -1;
      let bd = 60;
      for (let id = 0; id < isl.nodeCount; id++) {
        if (isl.nodeType[id] > 2 || c.nodeGone(id)) continue;
        const d = Math.hypot(isl.nodeX[id] - c.x, isl.nodeZ[id] - c.z);
        if (d < bd) {
          bd = d;
          best = id;
        }
      }
      return best < 0 ? null : [best, isl.nodeX[best], isl.nodeZ[best]];
    });
    check(!!tree, `${tag} tap: no tree near`);
    if (tree) {
      // Stand a few metres from it with an axe in the bag, where the tree shows on the island.
      await give(page, [['axe_stone', 1]]);
      let at = null;
      for (const [dx, dz] of [
        [-4.2, 4.2],
        [0, 5.5],
        [-5.5, 0],
        [4.2, 4.2],
        [-4.2, -4.2],
      ]) {
        await teleport(page, tree[1] + dx, tree[2] + dz);
        await page.waitForTimeout(1500);
        const here = await onIsland(page, tree[1], 1.2, tree[2]);
        const what =
          here[2] &&
          (await game(
            page,
            ([x, y, id]) => {
              const p = window.__view.pickAt(x, y);
              return p?.kind === 'node' && p.id === id;
            },
            [here[0], here[1], tree[0]],
          ));
        if (what) {
          at = here;
          break;
        }
      }
      check(!!at, `${tag} tap: the tree can't be tapped from any side`);
      if (at) {
        // What the survivor is told meanwhile (for the report if it fails).
        await game(page, () => {
          const c = window.__game.client;
          window.__said = [];
          const toast = c.toast.bind(c);
          c.toast = (text) => {
            window.__said.push(text);
            toast(text);
          };
        });
        await finger.tap(at[0], at[1]);
        // Chopped: the island counts the damage (the wood comes when it falls).
        const chopped = await until(
          page,
          (id) => window.__game.client.link.sim.nodes.has(id),
          `${tag} tap: a tap on a tree didn't chop it`,
          30000,
          tree[0],
        );
        if (!chopped)
          console.log(
            `${tag} tap on a tree:`,
            await game(page, () => {
              const c = window.__game.client;
              return {
                goal: c.goal,
                target: c.target?.verb,
                held: c.heldItem()?.id,
                axes: c.count('axe_stone'),
                said: window.__said,
              };
            }),
          );
        await shot('6d-tap-tree');
        // Stop chopping: the next steps teleport.
        await game(page, () => {
          window.__game.client.goal = null;
        });
      }
    }
    await finger.done();
  }

  await game(page, () => clearInterval(window.__calmBuild));

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
  // Settings › Gameplay › Small bag window: 🎒 opens the window by the survivor instead.
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByRole('tab', { name: /Gameplay/ }).click();
  await page.getByRole('switch', { name: 'Small bag window' }).click();
  await page.keyboard.press('Escape');
  await page.getByText('Paused').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.menu-screen').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Bag and crafting' }).click();
  await page.locator('.quick-panel').waitFor();
  await page.locator('.quick-panel').getByRole('button', { name: 'Bag', exact: true }).click();
  // The window pops up above the survivor's head, a little to the right, on screen.
  const qw = await page.locator('.quick-window').boundingBox();
  const head = await game(page, () => window.__game.client.anchor);
  check(
    qw &&
      qw.y + qw.height <= head.y &&
      qw.x + qw.width > head.x + 40 &&
      qw.x >= 0 &&
      qw.x + qw.width <= width &&
      qw.y >= 0,
    `${tag} game: the bag window isn't up and right of the survivor`,
  );
  // Isometric: W walks away from the camera (north-east), even with the window open.
  await openGround(page);
  const q0 = await game(page, () => [window.__game.client.x, window.__game.client.z]);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyW');
  const q1 = await game(page, () => [window.__game.client.x, window.__game.client.z]);
  check(
    q0[1] - q1[1] > 0.3 && q1[0] - q0[0] > 0.3,
    `${tag} game: W didn't walk north-east with the bag window open`,
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
    // The island where the window doesn't cover it (the stick's area counts as the island).
    page.locator('.joy-zone'),
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
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByRole('tab', { name: /Gameplay/ }).click();
  await page.getByRole('switch', { name: 'Small bag window' }).click();
  await page.keyboard.press('Escape');
  await page.getByText('Paused').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.menu-screen').waitFor({ state: 'detached' });

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

  // A bow shoots the Husk it's aimed at, and counts its arrows.
  await game(page, () => clearInterval(window.__calm));
  await openGround(page);
  await give(page, [
    ['bow', 1],
    ['arrow', 6],
  ]);
  await page.waitForTimeout(400);
  await hold(page, 'bow', 0);
  const husk = await game(page, async () => {
    const { spawnMob } = await import('/src/game/sim/mobs.ts');
    const c = window.__game.client;
    const m = spawnMob(c.link.sim, 'husk', c.x, c.z - 6, {});
    m.target = c.you;
    return m.id;
  });
  await until(
    page,
    () => window.__game.client.actionLabel().text.startsWith('Shoot'),
    `${tag} bow: no Shoot on the action button`,
  );
  check(
    (await page.locator('.hotbar .slot-ammo').first().textContent()) === '6',
    `${tag} bow: the arrows left aren't on the slot`,
  );
  check(
    await pressUntil(page, () => window.__game.client.count('arrow') < 6),
    `${tag} bow: no arrow used`,
  );
  await until(
    page,
    (id) => {
      const m = window.__game.client.link.sim.mobs.get(id);
      return !m || m.hp < 60;
    },
    `${tag} bow: the arrow didn't hit`,
    10000,
    husk,
  );
  await shot('9f-bow');
  await game(page, () => {
    const sim = window.__game.client.link.sim;
    window.__calm = setInterval(() => sim.mobs.clear(), 100);
  });

  // Farming: a garden plot, a seed planted (whichever the bag has first), watered from the can.
  // A dry spell, so the can has something to do (rain waters plots by itself).
  // Bags dropped by earlier steps would be nearer than the plot: clear them away.
  await game(page, () => {
    const sim = window.__game.client.link.sim;
    sim.weather = { kind: 'clear', until: sim.time + 3000 };
    sim.broadcast({ type: 'weather', w: 'clear' });
    for (const id of [...sim.drops.keys()]) {
      sim.drops.delete(id);
      sim.broadcast({ type: 'undrop', id });
    }
  });
  await openGround(page);
  await give(page, [
    ['seed_corn', 2],
    ['watering_can', 1],
  ]);
  const plot = await game(page, () => {
    const c = window.__game.client;
    const sim = c.link.sim;
    sim.handle(c.you, { type: 'build', kind: 'garden_plot', x: c.x, z: c.z - 2, rot: 0 });
    const b = [...sim.buildings.values()].find((b) => b.kind === 'garden_plot');
    return b && [b.x, b.z];
  });
  check(!!plot, `${tag} farm: the garden plot wasn't built`);
  // Right next to it, facing it, so nothing else is nearer.
  if (plot) await teleport(page, plot[0], plot[1] + 1.3);
  await game(page, () => {
    window.__game.client.ry = Math.PI;
  });
  const offers = await until(
    page,
    () => window.__game.client.actionLabel().text.startsWith('Plant '),
    `${tag} farm: the plot doesn't offer to plant`,
    // New models compile slowly on the software renderer: frames stall for a while.
    40000,
  );
  if (!offers)
    console.log(
      `${tag} farm: the action says`,
      await game(page, () => {
        const c = window.__game.client;
        return [c.actionLabel().text, c.x, c.z, c.ry, c.target, c.me.inv.map((s) => s?.id)];
      }),
    );
  const planted = () =>
    [...window.__game.client.buildings.values()].some((b) => b.kind === 'garden_plot' && b.crop);
  check(await pressUntil(page, planted), `${tag} farm: nothing planted`);
  await hold(page, 'watering_can', 1);
  await until(
    page,
    () => window.__game.client.actionLabel().text.startsWith('Water '),
    `${tag} farm: the can doesn't offer to water`,
    40000,
  );
  const wet = () =>
    [...window.__game.client.buildings.values()].some(
      (b) => b.kind === 'garden_plot' && b.crop && b.crop[2],
    );
  check(await pressUntil(page, wet), `${tag} farm: the plot isn't wet`);
  await shot('9g-farm');

  // Island animals: hold a goat's favourite food and it eats from your hand.
  await game(page, () => clearInterval(window.__calm));
  await openGround(page);
  await give(page, [['berries', 6]]);
  await page.waitForTimeout(400);
  await hold(page, 'berries', 2);
  const goat = await game(page, async () => {
    const { spawnMob } = await import('/src/game/sim/mobs.ts');
    const c = window.__game.client;
    const m = spawnMob(c.link.sim, 'goat', c.x, c.z - 1.6, { roamer: false });
    c.ry = Math.PI;
    return m.id;
  });
  // It grazes about: keep it right in front of you for the check.
  const pin = (id) => {
    const c = window.__game.client;
    const m = c.link.sim.mobs.get(id);
    if (m) {
      m.x = c.x;
      m.z = c.z - 1.6;
    }
    return c.actionLabel().text === 'Feed berries to the goat';
  };
  await until(page, pin, `${tag} animals: can't feed the goat`, 15000, goat);
  const fed = (id) => {
    const c = window.__game.client;
    const m = c.link.sim.mobs.get(id);
    if (m) {
      m.x = c.x;
      m.z = c.z - 1.6;
    }
    return !!m?.fed;
  };
  check(await pressUntil(page, fed, goat), `${tag} animals: the goat didn't eat`);
  check(
    (await game(page, () => window.__game.client.toasts.map((t) => t.text).join(' '))).includes(
      'eats from your hand',
    ),
    `${tag} animals: no word that the goat ate`,
  );
  await game(page, () => {
    const sim = window.__game.client.link.sim;
    window.__calm = setInterval(() => sim.mobs.clear(), 100);
  });

  // Secrets: the Verdance bunker's sign puts the survey markers on the map.
  await game(page, () => {
    const c = window.__game.client;
    const b = c.island.poiById['bunker'];
    const s = b.spots.find((s) => s.id === 'bunker_sign');
    const sim = c.link.sim;
    const p = sim.players.get(c.you);
    p.x = b.x + s.dx * 1.6;
    p.z = b.z + s.dz * 1.6;
    p.lastPos = sim.time;
    c.x = p.x;
    c.z = p.z;
  });
  await until(
    page,
    () => window.__game.client.target?.id === 'bunker_sign',
    `${tag} secrets: the bunker sign isn't in reach`,
  );
  await pressUntil(page, () => window.__game.client.panel === 'note');
  await page.getByText('Verdance shelter sign').waitFor();
  await page.keyboard.press('Escape');
  await until(
    page,
    () => window.__game.client.flags.has('seen:marker_a'),
    `${tag} secrets: the markers aren't on the map`,
  );
  await shot('9h-bunker');

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
  // This island: its name, code and rules.
  await page.getByRole('button', { name: /This island/ }).click();
  await page.locator('.island-name', { hasText: islandName }).waitFor();
  await page.getByText('TR-C0-4242').waitFor();
  await page.locator('.rules-preset', { hasText: 'Survivor' }).waitFor();
  await noSideScroll('island page');
  // The island's owner can change its rules: a frantic spawn rate, then back.
  const setSpawn = async (label) => {
    await page.getByRole('button', { name: /Change the rules/ }).click();
    await page
      .getByRole('radiogroup', { name: 'Spawn rate' })
      .getByRole('radio', { name: label })
      .click();
    await page.getByRole('button', { name: 'Use these rules' }).click();
  };
  await setSpawn('Frantic');
  await until(
    page,
    () => window.__game.client.rules.spawnRate === 'frantic',
    `${tag} rules: the spawn rate didn't change`,
  );
  await setSpawn('Normal');
  await until(
    page,
    () => window.__game.client.rules.spawnRate === 'normal',
    `${tag} rules: the spawn rate didn't change back`,
  );
  await page.getByRole('button', { name: '‹ Back' }).click();
  await page.getByText('Paused').waitFor();
  // Settings: PC keys can be changed (journal on K instead of J) and volumes set.
  await page.getByRole('button', { name: /Settings/ }).click();
  // HUD: the minimap can go, the player box can move, then it all comes back.
  await page.getByRole('tab', { name: /HUD/ }).click();
  await page.getByRole('switch', { name: 'Minimap', exact: true }).click();
  await page
    .getByRole('radiogroup', { name: 'Where they sit' })
    .getByRole('radio', { name: 'Top left' })
    .click();
  check((await page.locator('.minimap').count()) === 0, `${tag} hud: the minimap didn't hide`);
  check(
    (await page.locator('.game.stats-top').count()) === 1,
    `${tag} hud: the player box didn't move to the top`,
  );
  await page.getByRole('button', { name: 'Reset this page' }).click();
  check(
    (await page.locator('.minimap').count()) === 1,
    `${tag} hud: reset didn't bring the minimap back`,
  );
  await noSideScroll('hud settings');
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

  // The top-down camera keeps north up: W walks straight north.
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByRole('tab', { name: /Screen/ }).click();
  await page.getByRole('radio', { name: /Top-down/ }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.locator('.menu-screen').waitFor({ state: 'detached' });
  await openGround(page);
  const t0p = await game(page, () => [window.__game.client.x, window.__game.client.z]);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyW');
  const t1p = await game(page, () => [window.__game.client.x, window.__game.client.z]);
  check(
    t0p[1] - t1p[1] > 0.3 && Math.abs(t1p[0] - t0p[0]) < 0.15,
    `${tag} top-down: W didn't walk straight north`,
  );
  await shot('9g-top-down');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByRole('tab', { name: /Screen/ }).click();
  await page.getByRole('radio', { name: /Isometric/ }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.locator('.menu-screen').waitFor({ state: 'detached' });

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
  await page
    .getByRole('button', { name: `Continue · Day ${await dayNow(page)} on ${islandName}` })
    .waitFor();
  // A new island asks before it replaces this one.
  await page.getByRole('button', { name: /New island/ }).click();
  await page.locator('[data-testid="island-name"]').waitFor();
  await page.getByRole('button', { name: /Start on/ }).click();
  await page.getByText(`This replaces ${islandName}`).waitFor();
  await page.getByRole('button', { name: 'Keep mine' }).click();
  await page.getByRole('button', { name: '‹ Back' }).click();
  await page.getByRole('button', { name: /Continue · Day/ }).waitFor();
}

/** The day shown on the title's Continue button. */
async function dayNow(page) {
  const label = await page.locator('.title-continue').getAttribute('aria-label');
  return Number(label?.match(/Day (\d+)/)?.[1]);
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
  // The host's island is a made one (turned, mirrored, wetlands) with Relaxed rules:
  // the room has to build the same island and play by the same rules.
  await host.page.getByRole('button', { name: /Start surviving/ }).click();
  const spec = 'OV-W3M-31337';
  await newIsland(host.page, 'co-op', spec, 'Relaxed');
  await host.page.locator('.hud').waitFor({ timeout: 60000 });
  await host.page.getByRole('button', { name: 'Menu' }).click();
  await host.page.getByRole('button', { name: /Save and quit/ }).click();
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
  // Island chat: the friend's line shows for the host (the log, a bubble, a badge).
  await friend.page.getByRole('button', { name: 'Chat', exact: true }).click();
  await friend.page.getByLabel('Chat message').fill('  hi from   the friend ');
  await friend.page.getByRole('button', { name: 'Send' }).click();
  await host.page.locator('.chat-log', { hasText: 'hi from the friend' }).waitFor();
  await host.page.locator('.tag-say', { hasText: 'hi from the friend' }).waitFor();
  await host.page.getByRole('button', { name: 'Chat, 1 new' }).waitFor();
  await host.page.screenshot({ path: `${SHOTS}/coop-chat.png` });
  // The host mutes the friend; the friend opens the chat with Enter: their next line
  // shows for them, not for the host.
  await host.page.getByRole('button', { name: 'Chat, 1 new' }).click();
  await host.page.getByRole('button', { name: /👥/ }).click();
  await host.page.getByRole('button', { name: /Mute/ }).click();
  await host.page.getByRole('button', { name: 'Close chat' }).click();
  await friend.page.waitForTimeout(1500);
  await friend.page.keyboard.press('Enter');
  await friend.page.getByLabel('Chat message').fill('a muted line');
  await friend.page.keyboard.press('Enter');
  await friend.page.locator('.chat-log', { hasText: 'a muted line' }).waitFor();
  await host.page.waitForTimeout(1500);
  check(
    (await host.page.getByText('a muted line').count()) === 0,
    "co-op: a muted player's line showed",
  );
  for (const who of [host, friend]) {
    const [code, rules] = await game(who.page, () => {
      const c = window.__game.client;
      const s = c.island.spec;
      return [
        `${s.climate.slice(0, 2)}-${s.terrain[0]}${s.turn}${s.mirror ? 'M' : ''}-${s.seed}`,
        c.rules,
      ];
    });
    check(code.toUpperCase() === spec, `co-op: wrong island in the room (${code})`);
    check(
      rules.deathDrop === 'nothing' && rules.bloomEvery === 14,
      `co-op: the room didn't keep the island's rules`,
    );
  }
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
  // Intro on first launch.
  await page.goto(URL);
  await page.getByText('A game the players build.').waitFor();
  await noSideScroll('intro');
  await shot('1-intro');
  const suggestNext = page.getByRole('button', { name: 'Suggest an idea' });
  const box = await suggestNext.boundingBox();
  check(box && box.y + box.height <= height, `${tag} intro: buttons below the fold`);
  check((await page.locator('.tabbar').count()) === 0, `${tag} hub: a tab bar`);
  await suggestNext.click();

  // The suggestions box: what got built, a topic, a line of text, your own list.
  await page.getByText('You asked, we built it').waitFor();
  check(
    (await page.getByText('Bows and ranged weapons').count()) === 1,
    `${tag} suggest: the built list misses the bows`,
  );
  check((await page.getByText(/votes? so far/).count()) === 0, `${tag} suggest: a vote count`);
  await page.getByRole('radio', { name: /Creatures/ }).click();
  const send = page.getByRole('button', { name: '💡 Send it' });
  check(await send.isDisabled(), `${tag} suggest: Send works with nothing written`);
  await page.getByLabel('Your suggestion').fill('Sharks around the reef that knock you off rafts');
  await send.click();
  await page.getByText('Your idea is in the box').waitFor();
  await page.locator('.my-suggestions li', { hasText: 'Sharks around the reef' }).waitFor();
  await noSideScroll('suggest');
  await shot('2-suggest');
  await page
    .getByRole('button', { name: 'Take back: Sharks around the reef that knock you off rafts' })
    .click();
  await page
    .locator('.my-suggestions li', { hasText: 'Sharks around the reef' })
    .waitFor({ state: 'detached' });

  // Back on the title: no tab bar, no Town Square, and a player has no Dev area.
  await page.getByRole('button', { name: '‹ Back' }).click();
  await page.getByRole('button', { name: /Start surviving/ }).waitFor();
  check(
    (await page.getByRole('button', { name: /Dev/ }).count()) === 0,
    `${tag} a player sees Dev`,
  );
  check(
    (await page.getByRole('button', { name: /chat/i }).count()) === 0,
    `${tag} hub: the global chat is still there`,
  );
  check(
    (await page.getByRole('button', { name: /Vote for updates/ }).count()) === 0,
    `${tag} hub: the vote is still there`,
  );
  // Suggest an update opens the box again; a reload skips the intro.
  await page.getByRole('button', { name: /Suggest an update/ }).click();
  await page.getByText('You asked, we built it').waitFor();
  await page.getByRole('button', { name: '‹ Back' }).click();
  await page.waitForTimeout(400); // the mock writes appStorage after ~100 ms
  await page.reload();
  await page.getByRole('button', { name: /Start surviving/ }).waitFor();
  check(
    (await page.getByText('A game the players build.').count()) === 0,
    `${tag} intro shown again`,
  );

  // Settings from the title too.
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

  // The October Jam button copies the jam page's link (RUN's sandbox blocks new
  // windows) and shows it.
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new globalThis.URL(URL).origin,
  });
  await page.getByRole('button', { name: /Vote for us in October Jam/ }).click();
  await page.getByText('Link copied!').waitFor();
  const jam = 'https://run.world/jams/octoberjam?game=7VPvCLP7URUp69R6K10O';
  check(
    (await page.evaluate(() => navigator.clipboard.readText())) === jam,
    `${tag} jam: the link wasn't copied`,
  );
  check(
    (await page.getByLabel('October Jam link').inputValue()) === jam,
    `${tag} jam: no link to copy by hand`,
  );
  await noSideScroll('title');
  await shot('3b-title');

  // Dev area (owner only; ?owner plays the owner in the local preview), from a title
  // button that counts new suggestions (3 seeded) and open reports (2).
  await page.goto(`${URL}?owner`);
  await page.getByRole('button', { name: '🛠️ Dev · 5 to check' }).click();
  // Suggestions first: star one, mark one done, delete one.
  const nova = page.locator('.idea', { hasText: 'Boats so we can sail' });
  const pip = page.locator('.idea', { hasText: 'A cave under the mountain' });
  const bramIdea = page.locator('.idea', { hasText: 'second floor on our base' });
  await nova.waitFor();
  check((await nova.getByText('New').count()) === 1, `${tag} dev: a new suggestion isn't marked`);
  await nova.getByRole('button', { name: '☆ Star' }).click();
  await pip.getByRole('button', { name: '✓ Done' }).click();
  await pip.waitFor({ state: 'detached' });
  await bramIdea.getByRole('button', { name: 'Delete' }).click();
  await bramIdea.waitFor({ state: 'detached' });
  await page.getByRole('tab', { name: '⭐ Starred' }).click();
  await nova.waitFor();
  await page.getByRole('tab', { name: '✓ Done' }).click();
  await pip.waitFor();
  await noSideScroll('dev');
  await shot('4-dev');
  // Reports: the seeded spam was hidden by 3 reports, Bram's message has one open
  // report. Delete the spam, keep Bram's, then both are resolved.
  await page.getByRole('tab', { name: '🚩 Reports' }).click();
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
  await spamCard.getByRole('button', { name: 'Delete message' }).click();
  await spamCard.waitFor({ state: 'detached' });
  await bramCard.getByRole('button', { name: 'Keep' }).click();
  await page.getByText('No open reports').waitFor();
  await page.getByRole('tab', { name: 'Resolved' }).click();
  await spamCard.getByText('Resolved: deleted').waitFor();
  await bramCard.getByText('Resolved: kept').waitFor();
  await page.getByRole('button', { name: '‹ Back' }).click();
  await page.getByRole('button', { name: '🛠️ Dev', exact: true }).waitFor();

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
