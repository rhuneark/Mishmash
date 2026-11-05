// The islands kept on this device: the three slots (and the public island), loading,
// listing and throwing them away, a summary for the title. Light on purpose: the title
// screen loads it first; starting a game (session.ts) loads the rest of the game.

import * as run from '../sdk/run';
import {
  CLASSIC,
  GEN,
  islandName,
  newJoinCode,
  randomParts,
  type IslandParts,
  type IslandSpec,
} from '../game/islands';
import { randomSeed } from '../game/rng';
import { DEFAULT_RULES, type WorldRules } from '../game/rules';
import { ISLAND_SLOTS } from '../game/save';
import { newSave, parseIslandSave, type IslandSave } from '../game/sim/types';

export const ISLAND_KEY = 'mishmash_island';
/** The public island this player brings when nobody's on one (strangers). */
export const PUBLIC_KEY = 'mishmash_island_public';

/** Where an island slot is kept (slot 1 is the key from before there were slots). */
export function islandKey(slot: number): string {
  return slot <= 1 ? ISLAND_KEY : `${ISLAND_KEY}_${slot}`;
}

let slot = 1;

/** The island slot played now (the title picks it; the hub save remembers it). */
export function currentSlot(): number {
  return slot;
}

export function chooseSlot(n: number): void {
  slot = Math.max(1, Math.min(ISLAND_SLOTS, Math.floor(n) || 1));
}

/** The minimap's explored fog: one per slot, and one for friends' islands. */
export function fogKey(guest: boolean): string {
  return guest ? 'mishmash_fog_guest' : slot <= 1 ? 'mishmash_fog' : `mishmash_fog_${slot}`;
}

/** The spec of a saved island (older saves: the classic parts). */
export function specOf(save: IslandSave): IslandSpec {
  return { seed: save.seed, ...(save.island ?? CLASSIC) };
}

/** What the New island screen asks for. */
export interface NewIsland {
  seed: number;
  parts: IslandParts;
  rules: WorldRules;
  /** Its multiplayer code, when one was shown before it was made (Create world). */
  code?: string;
}

/** The last save kept per slot this session (a room's save can come in after leaving). */
const lastSaves = new Map<number, IslandSave>();

/** Keeps saves of the island in slot `n` (bound when a game starts). */
export function keeper(n: number): (save: IslandSave) => Promise<void> {
  return (save) => {
    lastSaves.set(n, save);
    return run.setItem(islandKey(n), JSON.stringify(save)).then(() => undefined);
  };
}

/** A new island, with its own multiplayer code. */
export function makeIsland(fresh: NewIsland | null): IslandSave & { code: string } {
  const save = fresh
    ? newSave(fresh.seed, fresh.parts, fresh.rules)
    : newSave(randomSeed(Math.random), { ...CLASSIC, gen: GEN });
  return { ...save, code: fresh?.code ?? newJoinCode(Math.random) };
}

/**
 * A ready-made first island (no choices to make): tropical, the classic terrain in any
 * layout, the default rules.
 */
export function quickIsland(random: () => number = Math.random): NewIsland {
  return {
    seed: randomSeed(random),
    parts: randomParts(random, { climate: 'tropic', terrain: 'classic' }),
    rules: { ...DEFAULT_RULES },
  };
}

/**
 * The island in a slot (the current one by default; older saves get their multiplayer
 * code here, kept from then on).
 */
export async function loadIsland(
  n: number = slot,
): Promise<(IslandSave & { code: string }) | null> {
  const save = await readSave(islandKey(n));
  if (!save) return null;
  if (save.code) return save as IslandSave & { code: string };
  const coded = { ...save, code: newJoinCode(Math.random) };
  await keeper(n)(coded);
  return coded;
}

export async function readSave(key: string): Promise<IslandSave | null> {
  const raw = await run.getItem(key);
  if (!raw) return null;
  try {
    return parseIslandSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Every slot's island (null: empty). */
export async function listIslands(): Promise<((IslandSave & { code: string }) | null)[]> {
  const out: ((IslandSave & { code: string }) | null)[] = [];
  for (let n = 1; n <= ISLAND_SLOTS; n++) {
    const last = lastSaves.get(n);
    out.push(last?.code ? (last as IslandSave & { code: string }) : await loadIsland(n));
  }
  return out;
}

/** Throws an island away for good (its slot is empty again). */
export async function deleteIsland(n: number): Promise<void> {
  lastSaves.delete(n);
  await run.setItem(islandKey(n), '');
}

/** A short summary of the saved island for the Play screen. */
export function describeSave(
  save: IslandSave,
  me: string,
): {
  day: number;
  escaped: boolean;
  friends: number;
  spec: IslandSpec;
  name: string;
  code: string;
} {
  const p = save.players[me] ?? Object.values(save.players)[0];
  const spec = specOf(save);
  return {
    day: Math.floor(save.time / 600) + 1,
    escaped: !!p?.escaped,
    friends: Math.max(0, Object.keys(save.players).length - 1),
    spec,
    name: islandName(spec),
    code: save.code ?? '',
  };
}

export function playerId(): string {
  return run.myId() || 'local-player';
}

/** The island you play (the last one kept this session, else the saved one). */
export async function savedIsland(): Promise<(IslandSave & { code: string }) | null> {
  const last = lastSaves.get(slot);
  if (last?.code) return last as IslandSave & { code: string };
  return loadIsland();
}
