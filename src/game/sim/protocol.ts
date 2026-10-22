// Messages between a player's game and the island authority (the room server
// in co-op, or the same code running in-process for solo play).

export interface Slot {
  id: string;
  n: number;
  /** Durability left (tools, weapons, torches). */
  d?: number;
}

export type UseKind = 'node' | 'mob' | 'build' | 'spot' | 'drop' | 'pool';

export type C2S =
  | { type: 'hello'; name: string }
  | { type: 'init'; part: number; parts: number; data: string }
  | { type: 'pos'; x: number; z: number; ry: number; mv: number }
  | { type: 'use'; kind: UseKind; id: number | string }
  | { type: 'throw'; slot: number; x: number; z: number }
  | { type: 'eat'; slot: number }
  | { type: 'equip'; slot: number }
  | { type: 'craft'; recipe: string }
  | { type: 'place'; slot: number; x: number; z: number; rot: number }
  | { type: 'demolish'; id: number }
  | { type: 'move'; from: number; to: number }
  | { type: 'drop'; slot: number }
  | { type: 'store'; id: number; slot: number }
  | { type: 'take'; id: number; slot: number }
  | { type: 'code'; code: string }
  | { type: 'respawn' }
  /** Leaving a co-op island: the host gets a last save first. */
  | { type: 'bye' };

/** Another player in a tick: [id, x, z, ry, mv, hp, heldItemId, alive(1/0)]. */
export type PlayerNet = [string, number, number, number, number, number, string, number];

/** A monster in a tick: [id, kind, x, z, ry, state, hpPct, burning(1/0)]. */
export type MobNet = [number, number, number, number, number, number, number, number];

export const MOB_KINDS = ['husk', 'snapjaw', 'puffer', 'thornback', 'mother', 'crab'] as const;

/** Monster animation states sent to clients. */
export const MOB_STATE = {
  idle: 0,
  walk: 1,
  run: 2,
  windup: 3,
  strike: 4,
  hurt: 5,
  dying: 6,
  burrow: 7,
  emerge: 8,
} as const;

export interface BuildingNet {
  id: number;
  kind: string;
  x: number;
  z: number;
  rot: number;
  hp: number;
  owner: string;
  /** Campfire fuel seconds, door open (1/0), rain charges. */
  v?: number;
  /** Storage contents. */
  inv?: (Slot | null)[];
}

export interface DropNet {
  id: number;
  x: number;
  z: number;
  items: Slot[];
  /** Whose things these were (a fallen player's bag). */
  label: string;
}

export interface PlayerInfo {
  id: string;
  name: string;
  color: number;
}

export interface MeNet {
  hp: number;
  food: number;
  water: number;
  inv: (Slot | null)[];
  held: number;
  alive: boolean;
  poison: number;
  spawnSet: boolean;
  escaped: boolean;
  kills: number;
  crafted: number;
  deaths: number;
}

export interface RescueNet {
  phase: 'none' | 'calling' | 'landed' | 'gone';
  /** Seconds left until the helicopter lands / leaves. */
  left: number;
}

/** The world as it stands, sent on join (JSON, possibly in parts). */
export interface Snapshot {
  seed: number;
  time: number;
  nodes: [number, number, number][];
  buildings: BuildingNet[];
  drops: DropNet[];
  flags: string[];
  notes: string[];
  players: PlayerInfo[];
  rescue: RescueNet;
}

export type FxKind =
  | 'chop'
  | 'mine'
  | 'gather'
  | 'hit'
  | 'swing'
  | 'mobhit'
  | 'death'
  | 'burst'
  | 'boom'
  | 'slam'
  | 'slamwarn'
  | 'bite'
  | 'build'
  | 'break'
  | 'eat'
  | 'heal'
  | 'craft'
  | 'deny'
  | 'unlock'
  | 'pickup'
  | 'drink'
  | 'throw';

export type S2C =
  | { type: 'welcome'; you: string; part: number; parts: number; data: string }
  | { type: 'wait'; text: string }
  | { type: 'tick'; t: number; p: PlayerNet[]; m: MobNet[] }
  | { type: 'me'; me: MeNet }
  | { type: 'players'; list: PlayerInfo[] }
  | { type: 'node'; id: number; hp: number; gone: number }
  | { type: 'build'; b: BuildingNet }
  | { type: 'unbuild'; id: number }
  | { type: 'drop'; d: DropNet }
  | { type: 'undrop'; id: number }
  | { type: 'fx'; k: FxKind; x: number; z: number; by?: string; n?: number; r?: number }
  | { type: 'toast'; text: string }
  | { type: 'progress'; flags: string[]; notes: string[] }
  | {
      type: 'event';
      e: 'dusk' | 'night' | 'bloom' | 'dawn' | 'dead' | 'respawn' | 'win' | 'note';
      text?: string;
      id?: string;
    }
  | { type: 'rescue'; r: RescueNet }
  | { type: 'save'; part: number; parts: number; data: string };

/** Splits a long string into message-sized parts. */
export function splitParts(data: string, size = 16000): string[] {
  const parts: string[] = [];
  for (let i = 0; i < data.length; i += size) parts.push(data.slice(i, i + size));
  return parts.length ? parts : [''];
}

/** Collects parts until a whole string is ready. */
export class PartBuffer {
  private parts: string[] = [];
  private got = 0;

  /** Returns the whole string once every part has arrived, else null. */
  add(part: number, parts: number, data: string): string | null {
    if (part === 0 || this.parts.length !== parts) {
      this.parts = new Array<string>(parts).fill('');
      this.got = 0;
    }
    if (part < 0 || part >= parts) return null;
    this.parts[part] = data;
    this.got++;
    return this.got >= parts ? this.parts.join('') : null;
  }
}
