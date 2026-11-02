// Starting and ending a game: solo on your own island (saved to appStorage),
// hosting it for friends, joining a friend's island by its multiplayer code, or a public
// island with strangers (kept apart from the slots: it's shared). Loaded when a game starts
// (with the rest of the game); the slots themselves are in slots.ts.

import * as run from '../sdk/run';
import { cleanJoinCode, randomParts } from '../game/islands';
import { randomSeed } from '../game/rng';
import { DEFAULT_RULES } from '../game/rules';
import type { IslandSave } from '../game/sim/types';
import { GameClient } from './client';
import { islandFor } from './islandCache';
import { LocalLink } from './link';
import { RoomLink } from './roomLink';
import { noteHappened } from './records';
import {
  PUBLIC_KEY,
  currentSlot,
  keeper,
  makeIsland,
  playerId,
  readSave,
  savedIsland,
  specOf,
  type NewIsland,
} from './slots';

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 30));

export type StartFail = 'login' | 'notfound' | 'full' | 'error';
export type Started = { ok: true; client: GameClient } | { ok: false; reason: StartFail };

/** Your own island, run on this device (`fresh`: a new one, made as asked). */
export async function startSolo(fresh: NewIsland | null): Promise<Started> {
  const keep = keeper(currentSlot());
  let save = fresh ? null : await savedIsland();
  if (!save) {
    save = makeIsland(fresh);
    await keep(save);
    noteHappened({ island: true });
  }
  await nextFrame();
  const island = islandFor(specOf(save));
  const link = new LocalLink(island, save, playerId(), keep);
  const client = new GameClient(link, run.myName(), islandFor);
  client.start();
  run.track('island_start', { mode: 'solo', day: Math.floor(save.time / 600) + 1 });
  return { ok: true, client };
}

/** Opens your island to friends (`fresh`: a new one): it moves into a RUN room. */
export async function startHost(fresh: NewIsland | null = null): Promise<Started> {
  const keep = keeper(currentSlot());
  let save = fresh ? null : await savedIsland();
  if (!save) {
    save = makeIsland(fresh);
    await keep(save);
    noteHappened({ island: true });
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

/**
 * A public island with strangers: one that's open, or yours (made the first time) when
 * nobody's on one. Saves come back while you host it, also after taking it over.
 */
export async function startPublic(): Promise<Started> {
  const keep = (save: IslandSave) => void run.setItem(PUBLIC_KEY, JSON.stringify(save));
  const mine = async (): Promise<IslandSave> => {
    const saved = await readSave(PUBLIC_KEY);
    if (saved) return saved;
    const r = Math.random;
    const save = makeIsland({
      seed: randomSeed(r),
      parts: randomParts(r),
      rules: { ...DEFAULT_RULES },
    });
    keep(save);
    noteHappened({ island: true });
    return save;
  };
  let res = await RoomLink.quick(mine, keep);
  if (!res.ok && res.reason === 'login' && (await run.promptLogin()))
    res = await RoomLink.quick(mine, keep);
  if (!res.ok) return res;
  const client = new GameClient(res.link, run.myName(), islandFor);
  client.start();
  run.track('island_start', { mode: 'public' });
  return { ok: true, client };
}

export const FAIL_TEXT: Record<StartFail, string> = {
  login: 'Sign in to RUN to play with friends.',
  notfound: "That isn't an island code. It's 6 letters and numbers, like ABC-234.",
  full: 'That island is full (4 survivors).',
  error: "Couldn't connect. Check your connection and try again.",
};
