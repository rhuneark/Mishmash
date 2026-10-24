// The Bloom: one root colony under the island (Project Perennial's "Specimen
// M"), wearing whatever it grows into. Husks were people once, Thornbacks the
// station's guard dogs; Snapjaws grow where the dead lay down, Puffers are its
// seed pods. Their parts feed the Mashbench. And the island's own animals (not
// the Bloom's): crabs, wild boars, goats, jungle fowl and the station's runaway
// dogs, which can be hunted, or fed until they trust you.

import type { Drop } from './nodes';

export type MonsterKind =
  | 'husk'
  | 'snapjaw'
  | 'puffer'
  | 'thornback'
  | 'mother'
  | 'crab'
  | 'boar'
  | 'goat'
  | 'fowl'
  | 'dog';

/** An island animal: what it eats (and how many feedings win it over), how it behaves. */
export interface AnimalDef {
  /** Favourite foods: hold one and it comes closer; feed it to tame it. */
  food: string[];
  /** Feedings until it trusts you. */
  feeds: number;
  /** Runs from people (unless you hold its food). */
  shy: boolean;
  /** Fights back when hurt; once tamed it fights the Bloom for you. */
  fights: boolean;
  /** Once tamed: something it gives every so often (seconds), collected by using it. */
  gives?: { item: string; every: number };
  /** A name for the kind in sentences ("the goat"). */
  noun: string;
  icon: string;
}

export interface MonsterDef {
  kind: MonsterKind;
  name: string;
  hp: number;
  /** m/s while wandering and while chasing. */
  walk: number;
  run: number;
  damage: number;
  /** Attack reach (m) and wind-up before it lands (s); players can step out of it. */
  reach: number;
  windup: number;
  cooldown: number;
  /** Notices players within this range (day / night). */
  aggroDay: number;
  aggroNight: number;
  radius: number;
  /** Keeps out of fire light unless enraged. */
  fearsFire: boolean;
  /** Never moves. */
  rooted: boolean;
  /** Burning hurts it this many times more. */
  fireWeak: number;
  drops: Drop[];
  hostile: boolean;
  animal?: AnimalDef;
}

export const MONSTERS: Record<MonsterKind, MonsterDef> = {
  husk: {
    kind: 'husk',
    name: 'Husk',
    hp: 60,
    walk: 1.4,
    run: 2.9,
    damage: 10,
    reach: 1.7,
    windup: 0.6,
    cooldown: 1.2,
    aggroDay: 12,
    aggroNight: 24,
    radius: 0.45,
    fearsFire: true,
    rooted: false,
    fireWeak: 2,
    hostile: true,
    drops: [
      { item: 'sap', n: 1, chance: 0.6 },
      { item: 'bloom_tendril', n: 1, chance: 0.65 },
      { item: 'cloth', n: 1, chance: 0.35 },
      { item: 'fiber', n: 1, chance: 0.5 },
    ],
  },
  snapjaw: {
    kind: 'snapjaw',
    name: 'Snapjaw',
    hp: 45,
    walk: 0,
    run: 0,
    damage: 14,
    reach: 2.3,
    windup: 0.45,
    cooldown: 1.6,
    aggroDay: 3,
    aggroNight: 3.5,
    radius: 0.6,
    fearsFire: false,
    rooted: true,
    fireWeak: 2,
    hostile: true,
    drops: [
      { item: 'sap', n: 2 },
      { item: 'snap_tooth', n: 2 },
    ],
  },
  puffer: {
    kind: 'puffer',
    name: 'Puffer',
    hp: 20,
    walk: 1.2,
    run: 2.2,
    damage: 8,
    reach: 2.0,
    windup: 1.0,
    cooldown: 99,
    aggroDay: 10,
    aggroNight: 20,
    radius: 0.5,
    fearsFire: true,
    rooted: false,
    fireWeak: 3,
    hostile: true,
    drops: [
      { item: 'sap', n: 1 },
      { item: 'spore_sac', n: 1, chance: 0.85 },
    ],
  },
  thornback: {
    kind: 'thornback',
    name: 'Thornback',
    hp: 130,
    walk: 2.2,
    run: 4.4,
    damage: 18,
    reach: 1.9,
    windup: 0.5,
    cooldown: 1.1,
    aggroDay: 16,
    aggroNight: 32,
    radius: 0.7,
    fearsFire: false,
    rooted: false,
    fireWeak: 1.5,
    hostile: true,
    drops: [
      { item: 'sap', n: 3 },
      { item: 'thorn_plate', n: 1 },
      { item: 'thorn_plate', n: 1, chance: 0.4 },
      { item: 'fiber', n: 2 },
    ],
  },
  mother: {
    kind: 'mother',
    name: 'The Mother Bloom',
    hp: 900,
    walk: 0,
    run: 0,
    damage: 28,
    reach: 14,
    windup: 1.3,
    cooldown: 2.4,
    aggroDay: 18,
    aggroNight: 18,
    radius: 2.6,
    fearsFire: false,
    rooted: true,
    fireWeak: 2,
    hostile: true,
    drops: [
      { item: 'transmitter', n: 1 },
      { item: 'sap', n: 8 },
    ],
  },
  crab: {
    kind: 'crab',
    name: 'Crab',
    hp: 12,
    walk: 1.0,
    run: 3.2,
    damage: 0,
    reach: 0,
    windup: 0,
    cooldown: 99,
    aggroDay: 5,
    aggroNight: 5,
    radius: 0.35,
    fearsFire: false,
    rooted: false,
    fireWeak: 1,
    hostile: false,
    drops: [{ item: 'crab_raw', n: 1 }],
  },
  boar: {
    kind: 'boar',
    name: 'Wild boar',
    hp: 70,
    walk: 1.3,
    run: 4.3,
    damage: 9,
    reach: 1.6,
    windup: 0.5,
    cooldown: 1.3,
    aggroDay: 0,
    aggroNight: 0,
    radius: 0.55,
    fearsFire: false,
    rooted: false,
    fireWeak: 1,
    hostile: false,
    drops: [
      { item: 'meat_raw', n: 2 },
      { item: 'hide', n: 1 },
    ],
    animal: {
      food: ['potato', 'mushroom', 'berries', 'corn'],
      feeds: 3,
      shy: false,
      fights: true,
      noun: 'boar',
      icon: '🐗',
    },
  },
  goat: {
    kind: 'goat',
    name: 'Mountain goat',
    hp: 40,
    walk: 1.2,
    run: 4.0,
    damage: 0,
    reach: 0,
    windup: 0,
    cooldown: 99,
    aggroDay: 0,
    aggroNight: 0,
    radius: 0.45,
    fearsFire: false,
    rooted: false,
    fireWeak: 1,
    hostile: false,
    drops: [
      { item: 'meat_raw', n: 1 },
      { item: 'hide', n: 1 },
    ],
    animal: {
      food: ['fiber', 'corn', 'berries', 'tomato'],
      feeds: 3,
      shy: true,
      fights: false,
      gives: { item: 'milk', every: 600 },
      noun: 'goat',
      icon: '🐐',
    },
  },
  fowl: {
    kind: 'fowl',
    name: 'Jungle fowl',
    hp: 14,
    walk: 1.0,
    run: 3.8,
    damage: 0,
    reach: 0,
    windup: 0,
    cooldown: 99,
    aggroDay: 0,
    aggroNight: 0,
    radius: 0.3,
    fearsFire: false,
    rooted: false,
    fireWeak: 1,
    hostile: false,
    drops: [
      { item: 'feather', n: 2 },
      { item: 'meat_raw', n: 1 },
    ],
    animal: {
      food: ['corn', 'berries', 'seed_berry', 'seed_corn'],
      feeds: 2,
      shy: true,
      fights: false,
      gives: { item: 'egg', every: 300 },
      noun: 'fowl',
      icon: '🐔',
    },
  },
  dog: {
    kind: 'dog',
    name: 'Stray dog',
    hp: 60,
    walk: 1.6,
    run: 5.2,
    damage: 12,
    reach: 1.6,
    windup: 0.4,
    cooldown: 1.0,
    aggroDay: 0,
    aggroNight: 0,
    radius: 0.4,
    fearsFire: false,
    rooted: false,
    fireWeak: 1,
    hostile: false,
    drops: [],
    animal: {
      food: ['meat_raw', 'meat_cooked', 'crab_raw', 'crab_cooked'],
      feeds: 2,
      shy: true,
      fights: true,
      noun: 'dog',
      icon: '🐕',
    },
  },
};

/** Names for animals that trust you (picked by their id). */
export const PET_NAMES = [
  'Mango',
  'Biscuit',
  'Pepper',
  'Coco',
  'Pickles',
  'Maple',
  'Noodle',
  'Clover',
  'Peanut',
  'Hazel',
  'Taro',
  'Sprout',
  'Juniper',
  'Basil',
  'Kiwi',
  'Waffles',
];

/** Puffers burst: this radius and poison. */
export const PUFFER_BURST = { radius: 3, poisonDps: 3, poisonSeconds: 6 };
/** The Mother Bloom's slam lands in a circle around where you stood. */
export const MOTHER_SLAM_RADIUS = 3.2;
