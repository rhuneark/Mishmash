// Authority-side state and the island save format.

import { BUILDINGS } from '../content/buildings';
import { MONSTERS, type MonsterKind } from '../content/monsters';
import { cleanInv, type Inv } from './inventory';
import type { RescueNet, Slot } from './protocol';
import { START_TIME } from './time';

export interface SimPlayer {
  id: string;
  name: string;
  color: number;
  x: number;
  z: number;
  ry: number;
  mv: number;
  hp: number;
  food: number;
  water: number;
  inv: Inv;
  held: number;
  alive: boolean;
  /** Bedroll building id. */
  spawn: number | null;
  poisonUntil: number;
  heals: { perSec: number; until: number }[];
  /** Sim time of the last attack/harvest (cooldowns). */
  lastUse: number;
  lastPos: number;
  kills: number;
  deaths: number;
  crafted: number;
  escaped: boolean;
  /** Torch burn accumulator (seconds). */
  torchAcc: number;
}

export interface Building {
  id: number;
  kind: string;
  x: number;
  z: number;
  rot: number;
  hp: number;
  owner: string;
  /** Campfire fuel seconds, door open (1/0), rain collector charges. */
  v: number;
  /** Seconds accumulated towards the next rain charge. */
  acc: number;
  inv?: (Slot | null)[];
}

export interface Drop {
  id: number;
  x: number;
  z: number;
  items: Slot[];
  label: string;
  until: number;
}

export interface Mob {
  id: number;
  kind: MonsterKind;
  x: number;
  z: number;
  ry: number;
  hp: number;
  maxHp: number;
  /** AI state and seconds left in it. */
  st: 'idle' | 'wander' | 'chase' | 'windup' | 'recover' | 'flee' | 'burrow' | 'emerge';
  t: number;
  /** Who it's after. */
  target: string | null;
  /** Building it's breaking. */
  siege: number | null;
  /** Wander goal. */
  gx: number;
  gz: number;
  burnUntil: number;
  burnDps: number;
  enraged: boolean;
  /** Snapjaw spot index (static spawns). */
  spot: number;
  /** Mother Bloom: where the slam will land. */
  ax: number;
  az: number;
  lastHitBy: string | null;
  /** Shown as 'hurt' for a moment after a hit. */
  hurt: number;
  /** Spawned by the day/night director (vs static/boss). */
  roamer: boolean;
  nextSpawn: number;
  /** Held by a snap trap until then (sim time). */
  heldUntil: number;
}

export interface RescueState {
  phase: RescueNet['phase'];
  endsAt: number;
}

export interface PlayerSave {
  name: string;
  color: number;
  x: number;
  z: number;
  hp: number;
  food: number;
  water: number;
  inv: (Slot | null)[];
  held: number;
  alive: boolean;
  spawn: number | null;
  kills: number;
  deaths: number;
  crafted: number;
  escaped: boolean;
}

export interface IslandSave {
  v: 1;
  seed: number;
  time: number;
  nextId: number;
  /** [nodeId, hp, until] (until: 0 damaged, >0 regrows then, -1 never). */
  nodes: [number, number, number][];
  buildings: Building[];
  drops: Drop[];
  players: Record<string, PlayerSave>;
  flags: string[];
  notes: string[];
  motherHp: number | null;
  rescue: RescueState;
}

export function newSave(seed: number): IslandSave {
  return {
    v: 1,
    seed,
    time: START_TIME,
    nextId: 1,
    nodes: [],
    buildings: [],
    drops: [],
    players: {},
    flags: [],
    notes: [],
    motherHp: null,
    rescue: { phase: 'none', endsAt: 0 },
  };
}

const num = (v: unknown, def: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : def;
const str = (v: unknown, def: string): string => (typeof v === 'string' ? v : def);

/** Parses and repairs an island save from untrusted JSON; null if unusable. */
export function parseIslandSave(raw: unknown): IslandSave | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const seed = num(d['seed'], 0);
  if (!seed) return null;
  const save = newSave(seed);
  save.time = Math.max(0, num(d['time'], START_TIME));
  save.nextId = Math.max(1, Math.floor(num(d['nextId'], 1)));
  if (Array.isArray(d['nodes'])) {
    for (const e of d['nodes']) {
      if (Array.isArray(e) && e.length === 3 && e.every((v) => typeof v === 'number')) {
        save.nodes.push([e[0] as number, e[1] as number, e[2] as number]);
      }
    }
  }
  if (Array.isArray(d['buildings'])) {
    for (const b of d['buildings'] as Record<string, unknown>[]) {
      const kind = str(b?.['kind'], '');
      if (!BUILDINGS[kind]) continue;
      const id = Math.floor(num(b['id'], 0));
      if (id <= 0) continue;
      const building: Building = {
        id,
        kind,
        x: num(b['x'], 0),
        z: num(b['z'], 0),
        rot: Math.floor(num(b['rot'], 0)) & 3,
        hp: Math.max(1, num(b['hp'], 1)),
        owner: str(b['owner'], ''),
        v: num(b['v'], 0),
        acc: num(b['acc'], 0),
      };
      if (kind === 'storage') building.inv = cleanInv(b['inv']).slice(0, 12);
      save.buildings.push(building);
      save.nextId = Math.max(save.nextId, id + 1);
    }
  }
  if (Array.isArray(d['drops'])) {
    for (const o of d['drops'] as Record<string, unknown>[]) {
      const id = Math.floor(num(o?.['id'], 0));
      if (id <= 0) continue;
      const items = cleanInv(o['items']).filter((s): s is Slot => s !== null);
      if (!items.length) continue;
      save.drops.push({
        id,
        x: num(o['x'], 0),
        z: num(o['z'], 0),
        items,
        label: str(o['label'], 'Bag'),
        until: num(o['until'], 0),
      });
      save.nextId = Math.max(save.nextId, id + 1);
    }
  }
  const players = d['players'];
  if (players && typeof players === 'object') {
    for (const [pid, pv] of Object.entries(players as Record<string, Record<string, unknown>>)) {
      if (!pv || typeof pv !== 'object') continue;
      save.players[pid] = {
        name: str(pv['name'], 'Survivor').slice(0, 24),
        color: Math.floor(num(pv['color'], 0)) & 0xffffff,
        x: num(pv['x'], 0),
        z: num(pv['z'], 0),
        hp: Math.min(100, Math.max(0, num(pv['hp'], 100))),
        food: Math.min(100, Math.max(0, num(pv['food'], 80))),
        water: Math.min(100, Math.max(0, num(pv['water'], 80))),
        inv: cleanInv(pv['inv']),
        held: Math.min(5, Math.max(0, Math.floor(num(pv['held'], 0)))),
        alive: pv['alive'] !== false,
        spawn: typeof pv['spawn'] === 'number' ? pv['spawn'] : null,
        kills: Math.floor(num(pv['kills'], 0)),
        deaths: Math.floor(num(pv['deaths'], 0)),
        crafted: Math.floor(num(pv['crafted'], 0)),
        escaped: pv['escaped'] === true,
      };
    }
  }
  if (Array.isArray(d['flags']))
    save.flags = d['flags'].filter((f): f is string => typeof f === 'string');
  if (Array.isArray(d['notes']))
    save.notes = d['notes'].filter((f): f is string => typeof f === 'string');
  const mh = d['motherHp'];
  save.motherHp = typeof mh === 'number' && mh > 0 ? Math.min(MONSTERS.mother.hp, mh) : null;
  const r = d['rescue'] as Record<string, unknown> | undefined;
  const phase = r?.['phase'];
  if (phase === 'calling' || phase === 'landed') {
    save.rescue = { phase, endsAt: num(r?.['endsAt'], 0) };
  }
  return save;
}

/** A building's axis-aligned footprint (rotations are quarter turns). */
export function footprint(kind: string, x: number, z: number, rot: number) {
  const def = BUILDINGS[kind];
  const w = def?.w ?? 1;
  const d = def?.d ?? 1;
  const hw = (rot & 1 ? d : w) / 2;
  const hd = (rot & 1 ? w : d) / 2;
  return { minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd };
}

export type Aabb = ReturnType<typeof footprint>;

/** Does a circle overlap a box? */
export function circleHitsBox(x: number, z: number, r: number, b: Aabb): boolean {
  const cx = Math.max(b.minX, Math.min(x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

/** Pushes a circle out of a box; returns the corrected position, or null if it wasn't inside. */
export function pushOutOfBox(
  x: number,
  z: number,
  r: number,
  b: Aabb,
): { x: number; z: number } | null {
  const cx = Math.max(b.minX, Math.min(x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    return { x: cx + (dx / d) * r, z: cz + (dz / d) * r };
  }
  // Centre inside the box: leave by the nearest side.
  const left = x - b.minX + r;
  const right = b.maxX - x + r;
  const up = z - b.minZ + r;
  const down = b.maxZ - z + r;
  const m = Math.min(left, right, up, down);
  if (m === left) return { x: b.minX - r, z };
  if (m === right) return { x: b.maxX + r, z };
  if (m === up) return { x, z: b.minZ - r };
  return { x, z: b.maxZ + r };
}

export function boxesOverlap(a: Aabb, b: Aabb, shrink = 0.05): boolean {
  return (
    a.minX + shrink < b.maxX - shrink &&
    a.maxX - shrink > b.minX + shrink &&
    a.minZ + shrink < b.maxZ - shrink &&
    a.maxZ - shrink > b.minZ + shrink
  );
}

/** Does this building block movement right now (open doors don't)? */
export function blocksNow(b: Building): boolean {
  const def = BUILDINGS[b.kind];
  if (!def?.blocks) return false;
  if (b.kind === 'door_wood' && b.v === 1) return false;
  return true;
}

export const PLAYER_COLORS = [
  0xe8664a, 0x4a9de8, 0xf2c14e, 0x6ccf7f, 0xc77dde, 0xf28fb0, 0x5fd3d0, 0xe0e0e0,
];

export function colorFor(id: string): number {
  let h = 0;
  for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return PLAYER_COLORS[Math.abs(h) % PLAYER_COLORS.length] as number;
}
