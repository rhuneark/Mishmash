// Secrets off the beaten track: a Verdance bunker, a stranded freighter and buried
// treasure. The sites are placed on each island after it is generated (world.ts
// placeSecrets), so adding them never moved a tree or a hill on an existing island.
//
// The bunker: its generator needs fuel (Bloom sap burns hot), then its keypad takes a
// code with one digit on each of four Verdance survey markers around the island (the
// sign at the door puts them on your map). Inside: the seed vault, a weapons locker and
// a terminal with a treasure map.
//
// The shipwreck: the freighter Marisol ran aground long before MX207. Her hold floods
// at high water; at low tide (04:00–08:00 and 16:00–20:00) you can climb in. The
// captain's safe takes the hull number backwards (the log says so, the bow shows it).
//
// Treasure: five maps (the safe, the bunker, and bottles that wash up with the wreckage)
// each mark an X. Dig there with a shovel for a buried chest.

import type { PoiDef } from './pois';

/** A site before it's placed: everything but where it stands. */
export type SecretDef = Omit<PoiDef, 'x' | 'z'> & {
  /** Where it may go. */
  place: 'bunker' | 'wreck' | 'marker';
  /** Markers: which corner of the island (x sign, z sign). */
  corner?: [number, number];
};

export const SECRETS: SecretDef[] = [
  {
    id: 'bunker',
    name: 'Verdance bunker',
    flat: 9,
    secret: true,
    icon: '🚪',
    place: 'bunker',
    boxes: [
      { dx: 0, dz: -1, w: 7, d: 5, rot: 0, h: 3 },
      { dx: 5.2, dz: 0.6, w: 1.8, d: 1.3, rot: 0, h: 1.4 },
    ],
    spots: [
      { id: 'bunker_sign', kind: 'note', dx: -2.6, dz: 2.1, note: 'bunkersign' },
      { id: 'bunker_gen', kind: 'generator', dx: 5.2, dz: 2 },
      {
        id: 'bunker_door',
        kind: 'lock',
        lock: 'bunker',
        dx: 1.95,
        dz: 1.58,
        loot: [
          { item: 'medkit', n: 2 },
          { item: 'ration', n: 3 },
          { item: 'water_bottle', n: 2 },
        ],
      },
      {
        id: 'bunker_vault',
        kind: 'loot',
        after: 'bunker_open',
        dx: -0.1,
        dz: 2.2,
        loot: [
          { item: 'seed_corn', n: 4 },
          { item: 'seed_potato', n: 4 },
          { item: 'seed_tomato', n: 4 },
          { item: 'seed_pumpkin', n: 3 },
          { item: 'watering_can', n: 1 },
        ],
      },
      {
        id: 'bunker_locker',
        kind: 'loot',
        after: 'bunker_open',
        dx: 1.0,
        dz: 2.4,
        note: 'treasure_2',
        loot: [
          { item: 'bow', n: 1 },
          { item: 'arrow', n: 15 },
          { item: 'shovel', n: 1 },
          { item: 'firebomb', n: 2 },
        ],
      },
      {
        id: 'bunker_terminal',
        kind: 'note',
        after: 'bunker_open',
        dx: 0.4,
        dz: 1.95,
        note: 'shelterlog',
      },
    ],
  },
  {
    id: 'wreck',
    name: 'Shipwreck',
    flat: 13,
    secret: true,
    icon: '⚓',
    place: 'wreck',
    // Built along x (bow at +x), turned to lie along the shore.
    boxes: [
      { dx: 0, dz: 0, w: 20, d: 5.4, rot: 0, h: 6 },
      { dx: -6, dz: 0, w: 4.5, d: 4.4, rot: 0, h: 9 },
    ],
    spots: [
      { id: 'wreck_log', kind: 'note', dx: -7, dz: 3.8, note: 'wrecklog' },
      { id: 'wreck_plate', kind: 'note', dx: 10.6, dz: 2.2, note: 'hullplate' },
      {
        id: 'wreck_hold',
        kind: 'loot',
        tide: true,
        dx: 0.8,
        dz: 3.5,
        loot: [
          { item: 'scrap', n: 5 },
          { item: 'rope', n: 3 },
          { item: 'cloth', n: 3 },
          { item: 'bottle', n: 1 },
        ],
      },
      {
        id: 'wreck_safe',
        kind: 'lock',
        lock: 'wreck',
        tide: true,
        dx: -0.7,
        dz: 2.95,
        note: 'treasure_1',
        loot: [
          { item: 'crossbow', n: 1 },
          { item: 'bolt', n: 12 },
          { item: 'medkit', n: 1 },
        ],
      },
    ],
  },
  ...(['a', 'b', 'c', 'd'] as const).map((k, i): SecretDef => ({
    id: `marker_${k}`,
    name: `Survey marker ${k.toUpperCase()}`,
    flat: 3,
    secret: true,
    icon: '📍',
    place: 'marker',
    corner: [
      [1, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
    ][i] as [number, number],
    boxes: [{ dx: 0, dz: 0, w: 0.7, d: 0.7, rot: 0, h: 1.3 }],
    spots: [
      {
        id: `marker_${k}_plate`,
        kind: 'tag',
        code: 'bunker',
        digit: i,
        dx: 0,
        dz: 0.9,
        note: 'marker',
      },
    ],
  })),
];

export const SECRET_IDS = SECRETS.map((s) => s.id);

/** Treasure maps (notes treasure_1..5): 1 in the safe, 2 in the bunker, 3–5 in bottles. */
export const TREASURES = 5;
export const BOTTLE_MAPS = [3, 4, 5];

/** Sap the bunker's generator takes. */
export const GENERATOR_SAP = 3;

/** How many shovel blows a buried chest takes (shovel power 20). */
export const DIG_HP = 60;

export const TREASURE_LOOT: { id: string; min: number; max: number; chance: number }[] = [
  { id: 'scrap', min: 3, max: 6, chance: 1 },
  { id: 'medkit', min: 1, max: 2, chance: 0.8 },
  { id: 'arrow', min: 8, max: 14, chance: 0.6 },
  { id: 'fire_arrow', min: 3, max: 6, chance: 0.4 },
  { id: 'firebomb', min: 1, max: 3, chance: 0.5 },
  { id: 'sap', min: 2, max: 5, chance: 0.6 },
  { id: 'bow', min: 1, max: 1, chance: 0.25 },
  { id: 'machete', min: 1, max: 1, chance: 0.2 },
  { id: 'crossbow', min: 1, max: 1, chance: 0.15 },
  { id: 'seed_pumpkin', min: 2, max: 3, chance: 0.3 },
  { id: 'seed_berry', min: 2, max: 3, chance: 0.3 },
];

function digits(seed: number, salt: number): string {
  let s = (seed ^ salt) >>> 0;
  let code = '';
  for (let i = 0; i < 4; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    code += String((s >>> 16) % 10);
  }
  return code;
}

/** The bunker door's code (one digit per survey marker). */
export function bunkerCode(seed: number): string {
  return digits(seed, 0x0b0b5eed);
}

/** The hull number painted on the wreck's bow. */
export function hullNumber(seed: number): string {
  return digits(seed, 0x5a11a5);
}

/** The captain's safe: the hull number backwards. */
export function wreckCode(seed: number): string {
  return hullNumber(seed).split('').reverse().join('');
}
