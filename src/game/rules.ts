// World rules, picked when an island is made (like 7 Days to Die's world options)
// and kept in its save, so friends who join play by the host's rules. The
// defaults are the game as it always played.

export type Speed = 'walk' | 'jog' | 'run' | 'sprint';
export type DeathDrop = 'everything' | 'toolbelt' | 'backpack' | 'nothing' | 'delete';
export type Amount = 'none' | 'few' | 'normal' | 'many' | 'swarm';
export type Markers = 'all' | 'landmarks' | 'none';
export type Often = 'off' | 'rare' | 'normal' | 'often';
export type Hunger = 'off' | 'slow' | 'normal' | 'fast';
export type SpawnRate = 'slow' | 'normal' | 'fast' | 'frantic';

export interface WorldRules {
  /** Damage the Bloom does to you, % (difficulty). */
  difficulty: number;
  hunger: Hunger;
  /** What a fallen survivor leaves behind. */
  deathDrop: DeathDrop;
  /** Stacks without a limit (tools still one each). */
  infiniteStacks: boolean;
  /** How fast the Bloom moves by day and by night. */
  daySpeed: Speed;
  nightSpeed: Speed;
  /** Every Nth night is a Bloom night (0 = never). */
  bloomEvery: number;
  /** How many roam the island ('none': only the rooted ones and the Mother). */
  monsters: Amount;
  /** How fast new ones rise while there are fewer than that (the zombie spawn rate). */
  spawnRate: SpawnRate;
  /** Damage the Bloom does to walls and buildings, %. */
  bloomBlockDamage: number;
  /** Your damage to trees, rocks and the like, %. */
  blockDamage: number;
  /** What you get from trees, rocks and suitcases, %. */
  yield: number;
  /** Wreckage, supply pods and roaming packs. */
  events: Often;
  /** What the map and minimap show. */
  markers: Markers;
  /** Every storage box opens the same shared storage. */
  sharedChests: boolean;
  /** Crafting can use what's in your storage boxes, wherever you are. */
  craftFromChests: boolean;
}

export const DEFAULT_RULES: WorldRules = {
  difficulty: 100,
  hunger: 'normal',
  deathDrop: 'everything',
  infiniteStacks: false,
  daySpeed: 'jog',
  nightSpeed: 'run',
  bloomEvery: 7,
  monsters: 'normal',
  spawnRate: 'normal',
  bloomBlockDamage: 100,
  blockDamage: 100,
  yield: 100,
  events: 'normal',
  markers: 'all',
  sharedChests: false,
  craftFromChests: false,
};

export const SPEEDS: Speed[] = ['walk', 'jog', 'run', 'sprint'];
export const DEATH_DROPS: DeathDrop[] = ['everything', 'toolbelt', 'backpack', 'nothing', 'delete'];
export const AMOUNTS: Amount[] = ['none', 'few', 'normal', 'many', 'swarm'];
export const MARKERS: Markers[] = ['all', 'landmarks', 'none'];
export const OFTEN: Often[] = ['off', 'rare', 'normal', 'often'];
export const HUNGERS: Hunger[] = ['off', 'slow', 'normal', 'fast'];
export const SPAWN_RATES: SpawnRate[] = ['slow', 'normal', 'fast', 'frantic'];
export const DIFFICULTIES = [50, 100, 150, 200];
export const BLOOM_EVERY_CHOICES = [3, 5, 7, 10, 14, 0];
export const BLOCK_DAMAGES = [0, 25, 50, 100, 200, 300];
export const PLAYER_DAMAGES = [50, 100, 200, 300];
export const YIELDS = [50, 100, 200, 300];

function pick<T>(v: unknown, list: readonly T[], def: T): T {
  return list.includes(v as T) ? (v as T) : def;
}

/** Rules from saved (untrusted) data; anything missing or odd is the default. */
export function parseRules(raw: unknown): WorldRules {
  const d = DEFAULT_RULES;
  if (!raw || typeof raw !== 'object') return { ...d };
  const o = raw as Record<string, unknown>;
  return {
    difficulty: pick(o['difficulty'], DIFFICULTIES, d.difficulty),
    hunger: pick(o['hunger'], HUNGERS, d.hunger),
    deathDrop: pick(o['deathDrop'], DEATH_DROPS, d.deathDrop),
    infiniteStacks: o['infiniteStacks'] === true,
    daySpeed: pick(o['daySpeed'], SPEEDS, d.daySpeed),
    nightSpeed: pick(o['nightSpeed'], SPEEDS, d.nightSpeed),
    bloomEvery: pick(o['bloomEvery'], BLOOM_EVERY_CHOICES, d.bloomEvery),
    monsters: pick(o['monsters'], AMOUNTS, d.monsters),
    spawnRate: pick(o['spawnRate'], SPAWN_RATES, d.spawnRate),
    bloomBlockDamage: pick(o['bloomBlockDamage'], BLOCK_DAMAGES, d.bloomBlockDamage),
    blockDamage: pick(o['blockDamage'], PLAYER_DAMAGES, d.blockDamage),
    yield: pick(o['yield'], YIELDS, d.yield),
    events: pick(o['events'], OFTEN, d.events),
    markers: pick(o['markers'], MARKERS, d.markers),
    sharedChests: o['sharedChests'] === true,
    craftFromChests: o['craftFromChests'] === true,
  };
}

/** Only the rules that differ from the defaults (what a save keeps). */
export function changedRules(r: WorldRules): Partial<WorldRules> {
  const out: Partial<WorldRules> = {};
  for (const k of Object.keys(DEFAULT_RULES) as (keyof WorldRules)[]) {
    if (r[k] !== DEFAULT_RULES[k]) (out as Record<string, unknown>)[k] = r[k];
  }
  return out;
}

export interface Preset {
  id: string;
  name: string;
  desc: string;
  rules: WorldRules;
}

export const PRESETS: Preset[] = [
  {
    id: 'relaxed',
    name: 'Relaxed',
    desc: 'Build and explore. Slow Bloom, softer hits, you keep your things.',
    rules: {
      ...DEFAULT_RULES,
      difficulty: 50,
      hunger: 'slow',
      deathDrop: 'nothing',
      daySpeed: 'walk',
      nightSpeed: 'jog',
      bloomEvery: 14,
      monsters: 'few',
      spawnRate: 'slow',
      bloomBlockDamage: 25,
      yield: 200,
      craftFromChests: true,
      sharedChests: true,
    },
  },
  {
    id: 'normal',
    name: 'Survivor',
    desc: 'The island as it was made to be played.',
    rules: { ...DEFAULT_RULES },
  },
  {
    id: 'nightmare',
    name: 'Nightmare',
    desc: 'They sprint at night, hit hard, chew through walls, and bloom every third night.',
    rules: {
      ...DEFAULT_RULES,
      difficulty: 200,
      hunger: 'fast',
      deathDrop: 'everything',
      daySpeed: 'run',
      nightSpeed: 'sprint',
      bloomEvery: 3,
      monsters: 'swarm',
      spawnRate: 'fast',
      bloomBlockDamage: 300,
      yield: 50,
      events: 'often',
    },
  },
];

/** The preset these rules match, if any. */
export function presetOf(r: WorldRules): string | null {
  for (const p of PRESETS) {
    if ((Object.keys(p.rules) as (keyof WorldRules)[]).every((k) => p.rules[k] === r[k]))
      return p.id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// What the rules mean in numbers (the authority's side).

/** Walking speed for a monster: its walk and run speeds and the rule. */
export function speedFor(rule: Speed, walk: number, run: number): number {
  switch (rule) {
    case 'walk':
      return walk;
    case 'jog':
      return (walk + run) / 2;
    case 'run':
      return run;
    case 'sprint':
      return run * 1.3;
  }
}

export function monsterScale(a: Amount): number {
  return { none: 0, few: 0.5, normal: 1, many: 1.5, swarm: 2 }[a];
}

export function hungerScale(h: Hunger): number {
  return { off: 0, slow: 0.5, normal: 1, fast: 1.6 }[h];
}

/** New monsters a second while too few are around (the director runs once a second). */
export function spawnsPerSecond(r: SpawnRate): number {
  return { slow: 0.25, normal: 1, fast: 2, frantic: 3 }[r];
}

/** Rules the island's owner may change after it was made (storage stays as it was made). */
export function changeRules(current: WorldRules, raw: unknown): WorldRules {
  return { ...parseRules(raw), sharedChests: current.sharedChests };
}

/** Seconds between world events × this (0: no events). */
export function eventScale(o: Often): number {
  return { off: 0, rare: 2, normal: 1, often: 0.5 }[o];
}

/** Largest stack for an item under the rules. */
export function stackLimit(stack: number, infinite: boolean): number {
  return infinite && stack > 1 ? 9999 : stack;
}

/** Harvest yield: n items × the rule (never below one). */
export function yieldOf(n: number, percent: number): number {
  return Math.max(1, Math.round((n * percent) / 100));
}

const ORDINALS: Record<number, string> = {
  3: 'third',
  5: 'fifth',
  7: 'seventh',
  10: 'tenth',
  14: 'fourteenth',
};

/** "seventh" in the lore, as the rules have it. */
export function bloomOrdinal(every: number): string {
  return ORDINALS[every] ?? 'seventh';
}
