// Starting and ending a game: solo on your own island (saved to appStorage),
// hosting it for friends, or joining a friend's island by its multiplayer code.

import * as run from '../sdk/run';
import {
  CLASSIC,
  GEN,
  cleanJoinCode,
  islandName,
  newJoinCode,
  randomParts,
  specKey,
  type IslandParts,
  type IslandSpec,
} from '../game/islands';
import { randomSeed } from '../game/rng';
import { DEFAULT_RULES, type WorldRules } from '../game/rules';
import { ISLAND_SLOTS } from '../game/save';
import { newSave, parseIslandSave, type IslandSave } from '../game/sim/types';
import { generateIsland, type Island } from '../game/world';
import { GameClient } from './client';
import { LocalLink } from './link';
import { RoomLink } from './roomLink';

export const ISLAND_KEY = 'mishmash_island';

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

let cached: Island | null = null;

/** The island for a spec (generating one takes a moment; the last is kept). */
export function islandFor(spec: IslandSpec): Island {
  if (!cached || specKey(cached.spec) !== specKey(spec)) cached = generateIsland(spec.seed, spec);
  return cached;
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
}

/** The last save kept per slot this session (a room's save can come in after leaving). */
const lastSaves = new Map<number, IslandSave>();

/** Keeps saves of the island in slot `n` (bound when a game starts). */
function keeper(n: number): (save: IslandSave) => Promise<void> {
  return (save) => {
    lastSaves.set(n, save);
    return run.setItem(islandKey(n), JSON.stringify(save)).then(() => undefined);
  };
}

/** A new island, with its own multiplayer code. */
function makeIsland(fresh: NewIsland | null): IslandSave & { code: string } {
  const save = fresh
    ? newSave(fresh.seed, fresh.parts, fresh.rules)
    : newSave(randomSeed(Math.random), { ...CLASSIC, gen: GEN });
  return { ...save, code: newJoinCode(Math.random) };
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
  const raw = await run.getItem(islandKey(n));
  if (!raw) return null;
  let save: IslandSave | null;
  try {
    save = parseIslandSave(JSON.parse(raw));
  } catch {
    return null;
  }
  if (!save) return null;
  if (save.code) return save as IslandSave & { code: string };
  const coded = { ...save, code: newJoinCode(Math.random) };
  await keeper(n)(coded);
  return coded;
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

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 30));

export type StartFail = 'login' | 'notfound' | 'full' | 'error';
export type Started = { ok: true; client: GameClient } | { ok: false; reason: StartFail };

/** Your own island, run on this device (`fresh`: a new one, made as asked). */
export async function startSolo(fresh: NewIsland | null): Promise<Started> {
  const keep = keeper(slot);
  let save = fresh ? null : await savedIsland();
  if (!save) {
    save = makeIsland(fresh);
    await keep(save);
  }
  await nextFrame();
  const island = islandFor(specOf(save));
  const link = new LocalLink(island, save, playerId(), keep);
  const client = new GameClient(link, run.myName(), islandFor);
  client.start();
  run.track('island_start', { mode: 'solo', day: Math.floor(save.time / 600) + 1 });
  return { ok: true, client };
}

/** The island you play (the last one kept this session, else the saved one). */
async function savedIsland(): Promise<(IslandSave & { code: string }) | null> {
  const last = lastSaves.get(slot);
  if (last?.code) return last as IslandSave & { code: string };
  return loadIsland();
}

/** Opens your island to friends (`fresh`: a new one): it moves into a RUN room. */
export async function startHost(fresh: NewIsland | null = null): Promise<Started> {
  const keep = keeper(slot);
  let save = fresh ? null : await savedIsland();
  if (!save) {
    save = makeIsland(fresh);
    await keep(save);
  }
  const mine = save;
  let res = await RoomLink.host(mine, (s) => void keep(s));
  if (!res.ok && res.reason === 'login' && (await run.promptLogin()))
    res = await RoomLink.host(mine, (s) => void keep(s));
  if (!res.ok) return res;
  const client = new GameClient(res.link, run.myName(), islandFor);
  client.start();
  run.track('island_start', { mode: 'host' });
  return { ok: true, client };
}

/** Joins a friend's island by its multiplayer code. */
export async function startJoin(typed: string): Promise<Started> {
  const code = cleanJoinCode(typed);
  if (!code) return { ok: false, reason: 'notfound' };
  let res = await RoomLink.join(code);
  if (!res.ok && res.reason === 'login' && (await run.promptLogin()))
    res = await RoomLink.join(code);
  if (!res.ok) return res;
  const client = new GameClient(res.link, run.myName(), islandFor);
  client.start();
  run.track('island_start', { mode: 'guest' });
  return { ok: true, client };
}

export const FAIL_TEXT: Record<StartFail, string> = {
  login: 'Sign in to RUN to play with friends.',
  notfound: "That isn't an island code. It's 6 letters and numbers, like ABC-234.",
  full: 'That island is full (4 survivors).',
  error: "Couldn't connect. Check your connection and try again.",
};
