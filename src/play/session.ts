// Starting and ending a game: solo on your own island (saved to appStorage),
// hosting it for friends, or joining a friend's island by its multiplayer code.

import * as run from '../sdk/run';
import {
  CLASSIC,
  GEN,
  cleanJoinCode,
  islandName,
  newJoinCode,
  specKey,
  type IslandParts,
  type IslandSpec,
} from '../game/islands';
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

let lastSave: IslandSave | null = null;

function keep(save: IslandSave): Promise<void> {
  lastSave = save;
  return run.setItem(ISLAND_KEY, JSON.stringify(save)).then(() => undefined);
}

/** A new island, with its own multiplayer code. */
function makeIsland(fresh: NewIsland | null): IslandSave & { code: string } {
  const save = fresh
    ? newSave(fresh.seed, fresh.parts, fresh.rules)
    : newSave(randomSeed(Math.random), { ...CLASSIC, gen: GEN });
  return { ...save, code: newJoinCode(Math.random) };
}

/** Your island (older saves get their multiplayer code here, kept from then on). */
export async function loadIsland(): Promise<(IslandSave & { code: string }) | null> {
  const raw = await run.getItem(ISLAND_KEY);
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
  await keep(coded);
  return coded;
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
  if (lastSave?.code) return lastSave as IslandSave & { code: string };
  return loadIsland();
}

/** Opens your island to friends (`fresh`: a new one): it moves into a RUN room. */
export async function startHost(fresh: NewIsland | null = null): Promise<Started> {
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
