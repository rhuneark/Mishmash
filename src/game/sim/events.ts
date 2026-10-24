// World events: things that happen on their own, so the island never sits still.
// Wreckage from MX207 keeps washing up on the beaches; Verdance's automated
// drones still drop supply pods for a station nobody runs (the crash of a landing
// wakes the Bloom around it); and by day, packs of Husks roam the island.

import { BIOME, biomeAt, heightAt, hitCollider, poolNear } from '../world';
import type { MonsterKind } from '../content/monsters';
import type { Slot } from './protocol';
import { spawnMob } from './mobs';
import type { IslandSim } from './sim';
import type { SimPlayer } from './types';
import { eventScale, monsterScale } from '../rules';
import { DAY } from './time';

/** Seconds from the start of a new island to its first event. */
export const FIRST_EVENT = 150;
/** Seconds between events (a day is 600). */
export const EVENT_GAP = { min: 210, max: 390 };
/** Seconds a supply pod takes to come down. */
export const POD_FALL = 4;

export type WorldEvent = 'wreck' | 'pod' | 'pack';

interface LootRow {
  id: string;
  min: number;
  max: number;
  chance: number;
}

export const WRECK_LOOT: LootRow[] = [
  { id: 'scrap', min: 2, max: 4, chance: 1 },
  { id: 'cloth', min: 1, max: 3, chance: 0.8 },
  { id: 'rope', min: 1, max: 2, chance: 0.5 },
  { id: 'ration', min: 1, max: 2, chance: 0.6 },
  { id: 'water_bottle', min: 1, max: 2, chance: 0.6 },
  { id: 'bandage', min: 1, max: 2, chance: 0.4 },
  { id: 'torch', min: 1, max: 1, chance: 0.3 },
  { id: 'seed_tomato', min: 2, max: 3, chance: 0.25 },
  { id: 'seed_corn', min: 2, max: 3, chance: 0.25 },
];

export const POD_LOOT: LootRow[] = [
  { id: 'scrap', min: 3, max: 6, chance: 1 },
  { id: 'medkit', min: 1, max: 2, chance: 0.8 },
  { id: 'ration', min: 2, max: 3, chance: 0.8 },
  { id: 'water_bottle', min: 1, max: 3, chance: 0.7 },
  { id: 'firebomb', min: 1, max: 2, chance: 0.5 },
  { id: 'rope', min: 2, max: 3, chance: 0.4 },
  { id: 'axe_scrap', min: 1, max: 1, chance: 0.12 },
  { id: 'pick_scrap', min: 1, max: 1, chance: 0.12 },
  { id: 'machete', min: 1, max: 1, chance: 0.08 },
  // Verdance's drones still bring the station its seed stock.
  { id: 'seed_pumpkin', min: 2, max: 3, chance: 0.35 },
  { id: 'seed_potato', min: 2, max: 3, chance: 0.3 },
];

/** Rolls a loot table (always at least one thing). */
export function rollLoot(table: LootRow[], random: () => number): Slot[] {
  const out: Slot[] = [];
  for (const row of table) {
    if (random() >= row.chance) continue;
    const n = row.min + Math.floor(random() * (row.max - row.min + 1));
    out.push({ id: row.id, n });
  }
  if (!out.length) {
    const first = table[0] as LootRow;
    out.push({ id: first.id, n: first.min });
  }
  return out;
}

/** Which way (x east, z south) from where you stand. */
export function compass(dx: number, dz: number): string {
  const names = [
    'north',
    'north-east',
    'east',
    'south-east',
    'south',
    'south-west',
    'west',
    'north-west',
  ];
  const a = Math.atan2(dx, -dz);
  const k = Math.round((a / (Math.PI * 2)) * 8);
  return names[((k % 8) + 8) % 8] as string;
}

/** Which event, from a roll (0..1), at night or by day, on which day. */
export function pickEvent(r: number, night: boolean, day: number): WorldEvent {
  if (night) return r < 0.55 ? 'wreck' : 'pod';
  if (day < 2) return r < 0.6 ? 'wreck' : 'pod';
  return r < 0.4 ? 'wreck' : r < 0.72 ? 'pod' : 'pack';
}

function dist(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

function players(sim: IslandSim): SimPlayer[] {
  const out: SimPlayer[] = [];
  for (const id of sim.online) {
    const p = sim.players.get(id);
    if (p?.alive && !p.escaped) out.push(p);
  }
  return out;
}

/** A spot `min`–`max` metres from (x, z) that `ok` likes, or null. */
function findSpot(
  sim: IslandSim,
  x: number,
  z: number,
  min: number,
  max: number,
  ok: (x: number, z: number) => boolean,
): { x: number; z: number } | null {
  for (let i = 0; i < 60; i++) {
    const a = sim.random() * Math.PI * 2;
    const r = min + sim.random() * (max - min);
    const sx = x + Math.sin(a) * r;
    const sz = z + Math.cos(a) * r;
    if (Math.abs(sx) > 480 || Math.abs(sz) > 480) continue;
    if (ok(sx, sz)) return { x: sx, z: sz };
  }
  return null;
}

function clear(sim: IslandSim, x: number, z: number): boolean {
  return (
    !hitCollider(sim.island, x, z, 2) && !sim.blockingAt(x, z, 2) && !poolNear(sim.island, x, z, 2)
  );
}

/** Tells everyone where it happened, from where each of them stands. */
function announce(sim: IslandSim, x: number, z: number, what: (where: string) => string): void {
  for (const p of players(sim)) {
    const d = dist(p.x, p.z, x, z);
    const where =
      d < 12 ? 'right here' : `${Math.round(d / 10) * 10} m ${compass(x - p.x, z - p.z)}`;
    sim.toast(p.id, what(where));
  }
}

/** Once a second (IslandSim.tick). */
export function runEvents(sim: IslandSim): void {
  for (let i = sim.falling.length - 1; i >= 0; i--) {
    const f = sim.falling[i] as { x: number; z: number; at: number };
    if (sim.time < f.at) continue;
    sim.falling.splice(i, 1);
    landPod(sim, f.x, f.z);
  }
  const scale = eventScale(sim.rules.events);
  if (sim.time < sim.nextEvent || scale === 0) return;
  const who = players(sim);
  if (!who.length || sim.rescue.phase === 'calling' || sim.rescue.phase === 'landed') return;
  sim.nextEvent =
    sim.time + (EVENT_GAP.min + sim.random() * (EVENT_GAP.max - EVENT_GAP.min)) * scale;
  const p = who[Math.floor(sim.random() * who.length)] as SimPlayer;
  const info = sim.info();
  const kind = pickEvent(sim.random(), info.night, info.day);
  if (kind === 'wreck' && wreck(sim, p)) return;
  if (kind === 'pack' && sim.rules.monsters !== 'none' && pack(sim, p)) return;
  pod(sim, p);
}

function wreck(sim: IslandSim, p: SimPlayer): boolean {
  const spot = findSpot(sim, p.x, p.z, 45, 170, (x, z) => {
    const h = heightAt(sim.island, x, z);
    return h > 0.05 && h < 1.6 && biomeAt(sim.island, x, z) === BIOME.beach && clear(sim, x, z);
  });
  if (!spot) return false;
  sim.makeBag(
    spot.x,
    spot.z,
    rollLoot(WRECK_LOOT, sim.random),
    'Washed-up crate',
    sim.time + 1.5 * DAY,
    'crate',
  );
  announce(sim, spot.x, spot.z, (where) => `📦 Wreckage washed up on the beach, ${where}.`);
  return true;
}

function pod(sim: IslandSim, p: SimPlayer): boolean {
  const spot = findSpot(sim, p.x, p.z, 35, 85, (x, z) => {
    const h = heightAt(sim.island, x, z);
    return h > 0.4 && clear(sim, x, z);
  });
  if (!spot) return false;
  sim.falling.push({ x: spot.x, z: spot.z, at: sim.time + POD_FALL });
  sim.fx('podfall', spot.x, spot.z);
  announce(
    sim,
    spot.x,
    spot.z,
    (where) =>
      `🛰️ A Verdance drone dropped a supply pod, ${where}. The crash will wake the Bloom around it.`,
  );
  return true;
}

function landPod(sim: IslandSim, x: number, z: number): void {
  sim.fx('land', x, z, undefined, undefined, 4);
  for (const p of players(sim)) {
    if (dist(p.x, p.z, x, z) < 2.2) sim.hurtPlayer(p, 30, x, z, false);
  }
  sim.makeBag(
    x,
    z,
    rollLoot(POD_LOOT, sim.random),
    'Verdance supply pod',
    sim.time + 2 * DAY,
    'pod',
  );
  // The crash wakes whatever sleeps nearby: they guard the pod until someone comes.
  const info = sim.info();
  const n = Math.round(
    (2 + Math.min(3, Math.floor(info.day / 3))) * monsterScale(sim.rules.monsters),
  );
  const kinds: MonsterKind[] = info.day >= 4 ? ['husk', 'husk', 'puffer', 'thornback'] : ['husk'];
  for (let k = 0; k < n; k++) {
    const s = findSpot(
      sim,
      x,
      z,
      14,
      24,
      (sx, sz) =>
        heightAt(sim.island, sx, sz) > 0.3 && clear(sim, sx, sz) && !sim.repelAt(sx, sz, 3),
    );
    if (!s) continue;
    const kind = kinds[Math.floor(sim.random() * kinds.length)] as MonsterKind;
    const m = spawnMob(sim, kind, s.x, s.z, { roamer: true, emerge: true });
    m.gx = x;
    m.gz = z;
    let best: SimPlayer | null = null;
    for (const p of players(sim)) {
      if (dist(p.x, p.z, x, z) < 70 && (!best || dist(p.x, p.z, x, z) < dist(best.x, best.z, x, z)))
        best = p;
    }
    if (best) m.target = best.id;
  }
}

function pack(sim: IslandSim, p: SimPlayer): boolean {
  const info = sim.info();
  const centre = findSpot(sim, p.x, p.z, 45, 60, (x, z) => {
    return (
      heightAt(sim.island, x, z) > 0.4 &&
      clear(sim, x, z) &&
      !sim.litAt(x, z, 4) &&
      !sim.repelAt(x, z, 4)
    );
  });
  if (!centre) return false;
  const n = Math.max(
    1,
    Math.round(Math.min(6, 3 + Math.floor(info.day / 3)) * monsterScale(sim.rules.monsters)),
  );
  let made = 0;
  for (let k = 0; k < n; k++) {
    const s = findSpot(
      sim,
      centre.x,
      centre.z,
      1,
      6,
      (x, z) => heightAt(sim.island, x, z) > 0.3 && clear(sim, x, z),
    );
    if (!s) continue;
    const kind: MonsterKind = k === 0 && info.day >= 5 ? 'thornback' : 'husk';
    const m = spawnMob(sim, kind, s.x, s.z, { roamer: true, emerge: true });
    m.goal = { x: p.x, z: p.z };
    m.target = p.id;
    made++;
  }
  if (!made) return false;
  announce(sim, centre.x, centre.z, (where) => `⚠️ A pack of Husks is on the move, ${where}.`);
  return true;
}
