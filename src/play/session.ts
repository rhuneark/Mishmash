// Starting and ending a game: solo on your own island (saved to appStorage),
// hosting it for friends, or joining a friend's island by code.

import * as run from '../sdk/run';
import { CLASSIC, islandName, specCode, type IslandParts, type IslandSpec } from '../game/islands';
import { randomSeed } from '../game/rng';
import type { WorldRules } from '../game/rules';
import { newSave, parseIslandSave, type IslandSave } from '../game/sim/types';
import { generateIsland, type Island } from '../game/world';
import { GameClient } from './client';
import { LocalLink } from './link';
import { RoomLink } from './roomLink';

export const ISLAND_KEY = 'mishmash_island';

let cached: Island | null = null;

/** The island for a spec (generating one takes a moment; the last is kept). */
export function islandFor(spec: IslandSpec): Island {
  if (!cached || specCode(cached.spec) !== specCode(spec)) cached = generateIsland(spec.seed, spec);
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

let lastSave: IslandSave | null = null;

function keep(save: IslandSave): Promise<void> {
  lastSave = save;
  return run.setItem(ISLAND_KEY, JSON.stringify(save)).then(() => undefined);
}

export async function loadIsland(): Promise<IslandSave | null> {
  const raw = await run.getItem(ISLAND_KEY);
  if (!raw) return null;
  try {
    return parseIslandSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** A short summary of the saved island for the Play screen. */
export function describeSave(
  save: IslandSave,
  me: string,
): { day: number; escaped: boolean; friends: number; spec: IslandSpec; name: string } {
  const p = save.players[me] ?? Object.values(save.players)[0];
  const spec = specOf(save);
  return {
    day: Math.floor(save.time / 600) + 1,
    escaped: !!p?.escaped,
    friends: Math.max(0, Object.keys(save.players).length - 1),
    spec,
    name: islandName(spec),
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
  let save = fresh ? null : (lastSave ?? (await loadIsland()));
  if (!save) {
    save = fresh ? newSave(fresh.seed, fresh.parts, fresh.rules) : newSave(randomSeed(Math.random));
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

/** Opens your island to friends: the island moves into a RUN room. */
export async function startHost(): Promise<Started> {
  const save = lastSave ?? (await loadIsland()) ?? newSave(randomSeed(Math.random));
  let res = await RoomLink.host(save, (s) => void keep(s));
  if (!res.ok && res.reason === 'login' && (await run.promptLogin()))
    res = await RoomLink.host(save, (s) => void keep(s));
  if (!res.ok) return res;
  const client = new GameClient(res.link, run.myName(), islandFor);
  client.start();
  run.track('island_start', { mode: 'host' });
  return { ok: true, client };
}

/** Joins a friend's island by its code. */
export async function startJoin(code: string): Promise<Started> {
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
  notfound:
    'No island with that code. Check it with your friend; codes stop working when everyone leaves.',
  full: 'That island is full (4 survivors).',
  error: "Couldn't connect. Check your connection and try again.",
};
