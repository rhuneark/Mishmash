import { describe, expect, it } from 'vitest';
import { generateIsland, forNodesNear, type Island } from '../world';
import { NODE } from '../content/nodes';
import { POI_BY_ID, SPAWN, MOTHER_SPOT, RESCUE_SECONDS } from '../content/pois';
import { rng } from '../rng';
import { IslandSim } from './sim';
import { spawnMob } from './mobs';
import { count } from './inventory';
import { DAY, START_TIME } from './time';
import { newSave, parseIslandSave } from './types';
import type { S2C } from './protocol';

const island: Island = generateIsland(4242);

function harness(seed = 4242) {
  const inbox = new Map<string, S2C[]>();
  const all: S2C[] = [];
  const sim = new IslandSim(
    island,
    newSave(seed),
    (to, msg) => {
      all.push(msg);
      if (to) {
        const list = inbox.get(to) ?? [];
        list.push(msg);
        inbox.set(to, list);
      } else {
        for (const id of sim.online) {
          const list = inbox.get(id) ?? [];
          list.push(msg);
          inbox.set(id, list);
        }
      }
    },
    rng(7),
  );
  const toasts = (id: string) =>
    (inbox.get(id) ?? [])
      .filter((m): m is Extract<S2C, { type: 'toast' }> => m.type === 'toast')
      .map((m) => m.text);
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.1) sim.tick(0.1);
  };
  return { sim, inbox, all, toasts, run };
}

function nearestNode(type: number, x: number, z: number): number {
  let best = -1;
  let bd = Infinity;
  forNodesNear(island, x, z, 200, (id, d2) => {
    if (island.nodeType[id] === type && d2 < bd) {
      bd = d2;
      best = id;
    }
  });
  return best;
}

function walkTo(h: ReturnType<typeof harness>, id: string, x: number, z: number) {
  const p = h.sim.players.get(id);
  if (!p) throw new Error('no player');
  // Teleport in small legal steps.
  for (let k = 0; k < 400; k++) {
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) break;
    const s = Math.min(d, 0.85);
    h.sim.handle(id, { type: 'pos', x: p.x + (dx / d) * s, z: p.z + (dz / d) * s, ry: 0, mv: 1 });
    h.sim.tick(0.1);
  }
}

describe('island sim', () => {
  it('welcomes a new survivor at the crash site with a small kit', () => {
    const h = harness();
    h.sim.join('a', 'Ann');
    const msgs = h.inbox.get('a') ?? [];
    expect(msgs.some((m) => m.type === 'welcome')).toBe(true);
    const p = h.sim.players.get('a');
    expect(p).toBeDefined();
    expect(Math.hypot((p?.x ?? 0) - SPAWN.x, (p?.z ?? 0) - SPAWN.z)).toBeLessThan(5);
    expect(count(p?.inv ?? [], 'ration')).toBe(1);
    expect(h.sim.time).toBe(START_TIME);
  });

  it('gathers by hand, needs an axe for trees, then chops with one', () => {
    const h = harness();
    h.sim.join('a', 'Ann');
    const p = h.sim.players.get('a');
    if (!p) throw new Error();
    const branch = nearestNode(NODE.branch, p.x, p.z);
    walkTo(h, 'a', island.nodeX[branch] as number, (island.nodeZ[branch] as number) + 1);
    h.run(1);
    h.sim.handle('a', { type: 'use', kind: 'node', id: branch });
    expect(count(p.inv, 'wood')).toBe(1);
    expect(h.sim.nodeGone(branch)).toBe(true);

    const tree =
      nearestNode(NODE.palm, p.x, p.z) >= 0
        ? nearestNode(NODE.palm, p.x, p.z)
        : nearestNode(NODE.jungle, p.x, p.z);
    walkTo(h, 'a', island.nodeX[tree] as number, (island.nodeZ[tree] as number) + 1.2);
    h.run(1);
    h.sim.handle('a', { type: 'use', kind: 'node', id: tree });
    expect(h.toasts('a').some((t) => t.includes('need an axe'))).toBe(true);

    p.inv[0] = { id: 'axe_stone', n: 1, d: 120 };
    p.held = 0;
    for (let k = 0; k < 8 && !h.sim.nodeGone(tree); k++) {
      h.run(1);
      h.sim.handle('a', { type: 'use', kind: 'node', id: tree });
    }
    expect(h.sim.nodeGone(tree)).toBe(true);
    expect(count(p.inv, 'wood')).toBeGreaterThanOrEqual(4);
    expect(p.inv[0]?.d).toBeLessThan(120);
  });

  it('grows harvested nodes back', () => {
    const h = harness();
    h.sim.join('a', 'Ann');
    const p = h.sim.players.get('a');
    if (!p) throw new Error();
    const bush = nearestNode(NODE.bush, p.x, p.z);
    walkTo(h, 'a', island.nodeX[bush] as number, (island.nodeZ[bush] as number) + 1);
    h.run(1);
    h.sim.handle('a', { type: 'use', kind: 'node', id: bush });
    expect(h.sim.nodeGone(bush)).toBe(true);
    p.food = 100;
    p.water = 100;
    h.sim.time += DAY + 5;
    h.run(3);
    expect(h.sim.nodeGone(bush)).toBe(false);
  });

  it('crafts, places a campfire, feeds it and cooks on it', () => {
    const h = harness();
    h.sim.join('a', 'Ann');
    const p = h.sim.players.get('a');
    if (!p) throw new Error();
    p.inv[5] = { id: 'wood', n: 20 };
    p.inv[6] = { id: 'stone', n: 10 };
    p.inv[7] = { id: 'crab_raw', n: 1 };
    h.sim.handle('a', { type: 'craft', recipe: 'campfire' });
    const slot = p.inv.findIndex((s) => s?.id === 'campfire');
    expect(slot).toBeGreaterThanOrEqual(0);
    h.sim.handle('a', { type: 'craft', recipe: 'crab_cooked' });
    expect(h.toasts('a').some((t) => t.includes('campfire'))).toBe(true);
    // Find a clear spot near the player.
    let placed = false;
    for (let k = 0; k < 40 && !placed; k++) {
      const x = Math.round(p.x + 3 + (k % 6));
      const z = Math.round(p.z - 3 - Math.floor(k / 6));
      if (h.sim.placeProblem('campfire', x, z, 0)) continue;
      walkTo(h, 'a', x + 2, z);
      h.sim.handle('a', { type: 'place', slot, x, z, rot: 0 });
      placed = true;
    }
    expect(placed).toBe(true);
    const fire = [...h.sim.buildings.values()].find((b) => b.kind === 'campfire');
    expect(fire).toBeDefined();
    expect(fire?.v).toBeGreaterThan(0);
    const fuel = fire?.v ?? 0;
    h.sim.handle('a', { type: 'use', kind: 'build', id: fire?.id ?? 0 });
    expect(fire?.v).toBeGreaterThan(fuel);
    h.sim.handle('a', { type: 'craft', recipe: 'crab_cooked' });
    expect(count(p.inv, 'crab_cooked')).toBe(1);
    // Nothing can be placed on top of it.
    expect(h.sim.placeProblem('wall_wood', fire?.x ?? 0, fire?.z ?? 0, 0)).toBe(
      'Something is already there.',
    );
  });

  it('starves slowly, dies, drops a bag and respawns', () => {
    const h = harness();
    h.sim.join('a', 'Ann');
    const p = h.sim.players.get('a');
    if (!p) throw new Error();
    p.food = 0;
    p.water = 0;
    p.hp = 2;
    h.run(3);
    expect(p.alive).toBe(false);
    const bag = [...h.sim.drops.values()].find((d) => d.label.includes('Ann'));
    expect(bag?.items.some((s) => s.id === 'ration')).toBe(true);
    expect((h.inbox.get('a') ?? []).some((m) => m.type === 'event' && m.e === 'dead')).toBe(true);
    h.sim.handle('a', { type: 'respawn' });
    expect(p.alive).toBe(true);
    expect(p.hp).toBe(60);
  });

  it('spawns hostile monsters at night that hunt the player', () => {
    const h = harness();
    h.sim.join('a', 'Ann');
    const p = h.sim.players.get('a');
    if (!p) throw new Error();
    p.food = 100;
    p.water = 100;
    h.sim.time = DAY * 2 + DAY * 0.85; // night of day 3
    h.run(8);
    const hostile = [...h.sim.mobs.values()].filter(
      (m) => m.kind !== 'crab' && m.kind !== 'snapjaw',
    );
    expect(hostile.length).toBeGreaterThan(0);
    expect(hostile.some((m) => m.target === 'a' || m.st === 'emerge')).toBe(true);
  });

  it('keeps husks out of firelight but not on Bloom nights', () => {
    const h = harness();
    h.sim.join('a', 'Ann');
    const p = h.sim.players.get('a');
    if (!p) throw new Error();
    p.hp = 100000;
    h.sim.buildings.set(999, {
      id: 999,
      kind: 'torch_post',
      x: p.x + 2,
      z: p.z,
      rot: 0,
      hp: 80,
      owner: 'a',
      v: 0,
      acc: 0,
    });
    h.sim.time = DAY * 0.85;
    const husk = spawnMob(h.sim, 'husk', p.x + 14, p.z);
    h.run(12);
    expect(Math.hypot(husk.x - p.x, husk.z - p.z)).toBeGreaterThan(5);
    const angry = spawnMob(h.sim, 'husk', p.x + 14, p.z + 1, { enraged: true });
    h.run(10);
    expect(Math.hypot(angry.x - p.x, angry.z - p.z)).toBeLessThan(3);
  });

  it('lets monsters break walls in their way', () => {
    const h = harness();
    h.sim.join('a', 'Ann');
    const p = h.sim.players.get('a');
    if (!p) throw new Error();
    p.hp = 100000;
    const wall = {
      id: 998,
      kind: 'wall_wood',
      x: p.x + 2,
      z: p.z,
      rot: 1,
      hp: 60,
      owner: 'a',
      v: 0,
      acc: 0,
    };
    h.sim.buildings.set(998, wall);
    h.sim.time = DAY * 0.85;
    spawnMob(h.sim, 'thornback', p.x + 6, p.z, { enraged: true });
    h.run(15);
    expect(h.sim.buildings.has(998)).toBe(false);
  });

  it('opens the cargo hold only with the right code', () => {
    const h = harness();
    h.sim.join('a', 'Ann');
    const p = h.sim.players.get('a');
    const lock = h.sim.spots.get('cargo_lock');
    if (!p || !lock) throw new Error();
    p.x = lock.x;
    p.z = lock.z + 1;
    h.sim.handle('a', { type: 'code', code: '0000' === island.code ? '1111' : '0000' });
    expect(h.sim.flags.has('cargo_open')).toBe(false);
    h.sim.handle('a', { type: 'code', code: island.code });
    expect(h.sim.flags.has('cargo_open')).toBe(true);
    expect(count(p.inv, 'battery')).toBe(1);
  });

  it('only gives the antenna once the tower vines are cut', () => {
    const h = harness();
    h.sim.join('a', 'Ann');
    const p = h.sim.players.get('a');
    const spot = h.sim.spots.get('tower_antenna');
    if (!p || !spot) throw new Error();
    p.x = spot.x;
    p.z = spot.z + 1;
    h.sim.handle('a', { type: 'use', kind: 'spot', id: 'tower_antenna' });
    expect(count(p.inv, 'antenna')).toBe(0);
    p.inv[0] = { id: 'machete', n: 1, d: 250 };
    p.held = 0;
    for (const v of island.towerVines) {
      p.x = (island.nodeX[v] as number) + 0.5;
      p.z = (island.nodeZ[v] as number) + 0.5;
      for (let k = 0; k < 5 && !h.sim.nodeGone(v); k++) {
        h.run(1);
        h.sim.handle('a', { type: 'use', kind: 'node', id: v });
      }
    }
    expect(h.sim.towerClear()).toBe(true);
    p.x = spot.x;
    p.z = spot.z + 1;
    h.sim.handle('a', { type: 'use', kind: 'spot', id: 'tower_antenna' });
    expect(count(p.inv, 'antenna')).toBe(1);
  });

  it('drops the transmitter when the Mother Bloom dies', () => {
    const h = harness();
    h.sim.join('a', 'Ann');
    const p = h.sim.players.get('a');
    if (!p) throw new Error();
    p.x = MOTHER_SPOT.x + 10;
    p.z = MOTHER_SPOT.z + 10;
    p.hp = 100000;
    h.run(1.5);
    const mother = [...h.sim.mobs.values()].find((m) => m.kind === 'mother');
    expect(mother).toBeDefined();
    p.inv[0] = { id: 'machete', n: 1, d: 999 };
    p.held = 0;
    p.x = (mother?.x ?? 0) + 3.5;
    p.z = mother?.z ?? 0;
    for (let k = 0; k < 200 && h.sim.mobs.has(mother?.id ?? -1); k++) {
      p.hp = 100;
      h.run(0.6);
      h.sim.handle('a', { type: 'use', kind: 'mob', id: mother?.id ?? -1 });
    }
    expect(h.sim.flags.has('mother_dead')).toBe(true);
    expect([...h.sim.drops.values()].some((d) => d.items.some((s) => s.id === 'transmitter'))).toBe(
      true,
    );
  });

  it('runs the rescue: call, survive, board, win', () => {
    const h = harness();
    h.sim.join('a', 'Ann');
    const p = h.sim.players.get('a');
    const beacon = h.sim.spots.get('tower_beacon');
    const heli = h.sim.spots.get('tower_heli');
    if (!p || !beacon || !heli) throw new Error();
    p.x = beacon.x;
    p.z = beacon.z + 1;
    h.sim.handle('a', { type: 'use', kind: 'spot', id: 'tower_beacon' });
    expect(h.sim.rescue.phase).toBe('none');
    p.inv[3] = { id: 'radio', n: 1 };
    h.sim.handle('a', { type: 'use', kind: 'spot', id: 'tower_beacon' });
    expect(h.sim.rescue.phase).toBe('calling');
    p.hp = 1e9;
    p.food = 100;
    p.water = 100;
    h.run(RESCUE_SECONDS + 2);
    expect(h.sim.rescue.phase).toBe('landed');
    p.alive = true;
    p.x = heli.x;
    p.z = heli.z + 1;
    h.sim.handle('a', { type: 'use', kind: 'spot', id: 'tower_heli' });
    expect(p.escaped).toBe(true);
    expect((h.inbox.get('a') ?? []).some((m) => m.type === 'event' && m.e === 'win')).toBe(true);
  });

  it('round-trips through a save', () => {
    const h = harness();
    h.sim.join('a', 'Ann');
    const p = h.sim.players.get('a');
    if (!p) throw new Error();
    p.inv[4] = { id: 'wood', n: 7 };
    h.sim.flags.add('seen:crash');
    h.sim.nodes.set(5, { hp: 0, until: 9999 });
    const json = JSON.parse(JSON.stringify(h.sim.serialize()));
    const save = parseIslandSave(json);
    expect(save).not.toBeNull();
    const again = new IslandSim(island, save ?? newSave(1), () => {}, rng(1));
    expect(count(again.players.get('a')?.inv ?? [], 'wood')).toBe(7);
    expect(again.flags.has('seen:crash')).toBe(true);
    expect(again.nodeGone(5)).toBe(true);
    expect(parseIslandSave({ nonsense: true })).toBeNull();
  });

  it('discovers landmarks when a player walks near them', () => {
    const h = harness();
    h.sim.join('a', 'Ann');
    const p = h.sim.players.get('a');
    const tail = POI_BY_ID['tail'];
    if (!p || !tail) throw new Error();
    p.x = tail.x + 10;
    p.z = tail.z;
    h.run(1.2);
    expect(h.sim.flags.has('seen:tail')).toBe(true);
  });
});
