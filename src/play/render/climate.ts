// How each climate looks: colour swaps for the ground, the plants, the grass and the
// sky. The models stay the same; a climate only repaints them (tropic is the classic
// palette, so it changes nothing).

import { BIOME } from '../../game/world';
import type { Climate } from '../../game/islands';

/** Plant and rock colours of the node models (see props.ts `C`). */
export interface PlantColors {
  trunk: number;
  trunkDark: number;
  palm: number;
  jungle: number;
  jungle2: number;
  pine: number;
  pine2: number;
  bush: number;
  rock: number;
  rockDark: number;
  vine: number;
  vineDark: number;
}

export interface ClimateLook {
  /** Ground shades per biome (replacing the classic ones). */
  ground: Partial<Record<number, number[]>>;
  /** Wet sand at the waterline. */
  wetSand?: number;
  plants: Partial<PlantColors>;
  /** Grass blade colours per biome. */
  grass: Partial<Record<number, number[]>>;
  skyDay?: number;
  skyDusk?: number;
  hemiDay?: number;
  groundDay?: number;
  /** Sea colour by day. */
  sea?: number;
  /** Fog distance × this (below 1: mistier). */
  fog?: number;
}

const LOOKS: Record<Climate, ClimateLook> = {
  tropic: { ground: {}, plants: {}, grass: {} },
  autumn: {
    ground: {
      [BIOME.meadow]: [0xc2a24a, 0xb8913c, 0xcfae55, 0xa98a3f],
      [BIOME.jungle]: [0x8a6a32, 0x7d5e2c, 0x957438],
      [BIOME.forest]: [0x5f6a3e, 0x566236, 0x6a7246],
      [BIOME.highland]: [0x948a78, 0x8a8070, 0x9a7a52, 0xa09888],
    },
    plants: {
      palm: 0xa8a040,
      jungle: 0xd2691e,
      jungle2: 0xe8a33a,
      bush: 0xc0703a,
      pine: 0x3c5a38,
      pine2: 0x6a7a3a,
    },
    grass: {
      [BIOME.meadow]: [0xc8a446, 0xd8b85a, 0xb08a3a],
      [BIOME.jungle]: [0xa0682a, 0xc08a3a, 0x8a5a2a],
      [BIOME.forest]: [0x7a7a3e, 0x8a6a36],
      [BIOME.highland]: [0xb0a060, 0x9a8a52],
    },
    skyDay: 0xc9d8e0,
    skyDusk: 0xf08a4a,
    hemiDay: 0xffe8cc,
    groundDay: 0x8a6a3a,
  },
  pines: {
    ground: {
      [BIOME.beach]: [0xc8c2aa, 0xbfb9a0, 0xd0cab2],
      [BIOME.meadow]: [0x7a9a6a, 0x6f8f62, 0x86a474, 0x75956a],
      [BIOME.jungle]: [0x4a7055, 0x43684e, 0x527a5c],
      [BIOME.forest]: [0x3e5a44, 0x38523e, 0x46644c],
      [BIOME.highland]: [0xb8bcc0, 0xa8acb0, 0xd8dde2, 0x9a9ea2],
    },
    wetSand: 0xa8a290,
    plants: {
      palm: 0x4a7a4a,
      jungle: 0x2a5a40,
      jungle2: 0x35664a,
      pine: 0x1f4a36,
      pine2: 0x2a5a44,
      bush: 0x48724a,
    },
    grass: {
      [BIOME.meadow]: [0x6a8a5a, 0x7a9a68, 0x5a7a50],
      [BIOME.jungle]: [0x3a6648, 0x4a7656],
      [BIOME.forest]: [0x3e5e46, 0x4a6a50],
      [BIOME.highland]: [0x9aa4a0, 0x8a9690],
    },
    skyDay: 0xb4c4cc,
    skyDusk: 0xb8909a,
    hemiDay: 0xdde6ee,
    groundDay: 0x5a6a5a,
    sea: 0x3a7a90,
    fog: 0.7,
  },
  volcanic: {
    ground: {
      [BIOME.beach]: [0x55545a, 0x4c4b50, 0x5e5c60],
      [BIOME.meadow]: [0x7a8048, 0x6f7a42, 0x868a50, 0x707440],
      [BIOME.jungle]: [0x4a6a3a, 0x426234, 0x527240],
      [BIOME.forest]: [0x4a5a3e, 0x42523a, 0x526244],
      [BIOME.highland]: [0x3e3a3a, 0x4a4442, 0x5a3a30, 0x34302f],
      [BIOME.bog]: [0x4a4038, 0x403a34, 0x524640, 0x3a3430],
    },
    wetSand: 0x3a3a3e,
    plants: {
      palm: 0x6a9a3a,
      jungle: 0x3a6a32,
      bush: 0x5a7a34,
      rock: 0x4a4a50,
      rockDark: 0x2e2e33,
      trunk: 0x4a3a2e,
      trunkDark: 0x2e2420,
    },
    grass: {
      [BIOME.meadow]: [0x8a8a48, 0x7a7a40, 0x9a9050],
      [BIOME.highland]: [0x5a4a3a, 0x6a5a42],
      [BIOME.bog]: [0x5a5038, 0x4a4430],
    },
    skyDay: 0xc4ac98,
    skyDusk: 0xe0603a,
    hemiDay: 0xffd8c0,
    groundDay: 0x5a3a2a,
    sea: 0x2a5a6a,
    fog: 0.8,
  },
  overgrown: {
    ground: {
      [BIOME.meadow]: [0x5aa848, 0x4f9c40, 0x68b454, 0x7aa860],
      [BIOME.jungle]: [0x2e6a3a, 0x285f34, 0x367442],
      [BIOME.forest]: [0x3a6a46, 0x346040, 0x44744e],
      [BIOME.bog]: [0x6a4a7a, 0x5a4a62, 0x74527e, 0x7a5a84],
    },
    plants: {
      jungle: 0x2a8a4a,
      jungle2: 0xc0508a,
      bush: 0x3a8a3a,
      palm: 0x4aa040,
      vine: 0x3a6a2a,
      vineDark: 0x6a2a5a,
    },
    grass: {
      [BIOME.meadow]: [0x5aa040, 0x6ab84a, 0xd070a8],
      [BIOME.jungle]: [0x2a7a38, 0x3a8a44, 0xb0508a],
      [BIOME.bog]: [0x6a7a3a, 0x8a5a7a, 0x7a6a3a],
    },
    skyDay: 0xb4dcc8,
    skyDusk: 0xe08aa8,
    hemiDay: 0xf0e0f0,
    groundDay: 0x4a6a3a,
    fog: 0.85,
  },
};

export function climateLook(c: Climate): ClimateLook {
  return LOOKS[c];
}
