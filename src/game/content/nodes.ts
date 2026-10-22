// Harvestable world objects. The island generator scatters them by biome;
// the server tracks damage, depletion and regrowth.

import type { ToolKind } from './items';

export interface Drop {
  item: string;
  n: number;
  /** 0..1, default 1. */
  chance?: number;
}

export interface NodeDef {
  id: number;
  key: string;
  name: string;
  hp: number;
  tool: ToolKind;
  drops: Drop[];
  /** Collision radius (0 = walk through). */
  radius: number;
  /** Seconds until it grows back; null = never. */
  regrow: number | null;
  /** Shown on the action button. */
  verb: string;
}

export const NODE = {
  palm: 0,
  jungle: 1,
  pine: 2,
  bush: 3,
  berry: 4,
  rock: 5,
  pebble: 6,
  branch: 7,
  scrap: 8,
  mushroom: 9,
  luggage: 10,
  vines: 11,
} as const;

const DAY = 600;

export const NODES: NodeDef[] = [
  {
    id: NODE.palm,
    key: 'palm',
    name: 'Palm tree',
    hp: 75,
    tool: 'axe',
    radius: 0.45,
    regrow: 3 * DAY,
    verb: 'Chop',
    drops: [
      { item: 'wood', n: 3 },
      { item: 'coconut', n: 1, chance: 0.6 },
    ],
  },
  {
    id: NODE.jungle,
    key: 'jungle',
    name: 'Jungle tree',
    hp: 120,
    tool: 'axe',
    radius: 0.7,
    regrow: 3 * DAY,
    verb: 'Chop',
    drops: [
      { item: 'wood', n: 5 },
      { item: 'fiber', n: 1, chance: 0.5 },
    ],
  },
  {
    id: NODE.pine,
    key: 'pine',
    name: 'Pine tree',
    hp: 100,
    tool: 'axe',
    radius: 0.55,
    regrow: 3 * DAY,
    verb: 'Chop',
    drops: [{ item: 'wood', n: 4 }],
  },
  {
    id: NODE.bush,
    key: 'bush',
    name: 'Bush',
    hp: 10,
    tool: 'hand',
    radius: 0,
    regrow: DAY,
    verb: 'Gather',
    drops: [{ item: 'fiber', n: 2 }],
  },
  {
    id: NODE.berry,
    key: 'berry',
    name: 'Berry bush',
    hp: 10,
    tool: 'hand',
    radius: 0,
    regrow: DAY,
    verb: 'Pick',
    drops: [
      { item: 'berries', n: 3 },
      { item: 'fiber', n: 1, chance: 0.5 },
    ],
  },
  {
    id: NODE.rock,
    key: 'rock',
    name: 'Rock',
    hp: 120,
    tool: 'pick',
    radius: 1.0,
    regrow: 4 * DAY,
    verb: 'Mine',
    drops: [{ item: 'stone', n: 4 }],
  },
  {
    id: NODE.pebble,
    key: 'pebble',
    name: 'Loose stone',
    hp: 1,
    tool: 'hand',
    radius: 0,
    regrow: DAY,
    verb: 'Pick up',
    drops: [{ item: 'stone', n: 1 }],
  },
  {
    id: NODE.branch,
    key: 'branch',
    name: 'Fallen branch',
    hp: 1,
    tool: 'hand',
    radius: 0,
    regrow: DAY,
    verb: 'Pick up',
    drops: [{ item: 'wood', n: 1 }],
  },
  {
    id: NODE.scrap,
    key: 'scrap',
    name: 'Wreckage',
    hp: 60,
    tool: 'pick',
    radius: 0.8,
    regrow: null,
    verb: 'Salvage',
    drops: [{ item: 'scrap', n: 2 }],
  },
  {
    id: NODE.mushroom,
    key: 'mushroom',
    name: 'Mushroom',
    hp: 1,
    tool: 'hand',
    radius: 0,
    regrow: DAY,
    verb: 'Pick',
    drops: [{ item: 'mushroom', n: 1 }],
  },
  {
    id: NODE.luggage,
    key: 'luggage',
    name: 'Suitcase',
    hp: 1,
    tool: 'hand',
    radius: 0.5,
    regrow: null,
    verb: 'Open',
    drops: [],
  },
  {
    id: NODE.vines,
    key: 'vines',
    name: 'Bloom vines',
    hp: 80,
    tool: 'machete',
    radius: 1.3,
    regrow: 2 * DAY,
    verb: 'Cut',
    drops: [
      { item: 'fiber', n: 2 },
      { item: 'sap', n: 1, chance: 0.3 },
    ],
  },
];

/** Hand-searchable nodes still yield a little with any tool; scrap can also be torn by hand. */
export function canHarvest(def: NodeDef, held: ToolKind | null): boolean {
  if (def.tool === 'hand') return true;
  if (def.id === NODE.scrap) return true;
  return held === def.tool;
}

/** What a suitcase holds: a few random useful things (rolled per suitcase). */
export const LUGGAGE_LOOT: { item: string; n: number; weight: number }[] = [
  { item: 'cloth', n: 2, weight: 5 },
  { item: 'ration', n: 1, weight: 3 },
  { item: 'water_bottle', n: 1, weight: 3 },
  { item: 'bandage', n: 1, weight: 2 },
  { item: 'rope', n: 1, weight: 2 },
  { item: 'scrap', n: 1, weight: 2 },
  { item: 'torch', n: 1, weight: 1 },
];
