// Outfits: what a survivor wears, a hat and a coat (shirt and trousers). Looks only:
// nothing about them changes play. Some are free, some are earned with the records kept
// across islands (records.ts), and three sets come from the shop for RUN Bits (shop.ts).
// A look travels to the island as a short code ("cap.khaki"); the authority only keeps
// ids it knows.

import type { Records } from './records';

export type Unlock =
  | { by: 'free' }
  | { by: 'record'; text: string; has: (r: Records) => boolean }
  | { by: 'shop'; pack: string };

export interface Hat {
  id: string;
  name: string;
  unlock: Unlock;
}

export interface Coat {
  id: string;
  name: string;
  /** Shirt and trousers; 'auto' wears your survivor colour. */
  shirt: number;
  pants: number;
  unlock: Unlock;
}

const FREE: Unlock = { by: 'free' };
const record = (text: string, has: (r: Records) => boolean): Unlock => ({
  by: 'record',
  text,
  has,
});

export const HATS: readonly Hat[] = [
  { id: 'none', name: 'No hat', unlock: FREE },
  { id: 'bandana', name: 'Bandana', unlock: FREE },
  { id: 'straw', name: 'Straw hat', unlock: FREE },
  {
    id: 'cap',
    name: 'Flight crew cap',
    unlock: record('Reach day 5 on an island', (r) => r.bestDay >= 5),
  },
  { id: 'ranger', name: 'Ranger hat', unlock: record('Survive 15 nights', (r) => r.nights >= 15) },
  {
    id: 'flowers',
    name: 'Flower crown',
    unlock: record('Do the daily goal 7 days in a row', (r) => r.daily.best >= 7),
  },
  {
    id: 'thorns',
    name: 'Thorn crown',
    unlock: record('Slay 100 of the Bloom', (r) => r.slain >= 100),
  },
  { id: 'pilot', name: "Pilot's cap", unlock: record('Escape an island', (r) => r.escapes >= 1) },
  { id: 'hood', name: 'Verdance hood', unlock: { by: 'shop', pack: 'outfit_verdance' } },
  { id: 'captain', name: "Captain's hat", unlock: { by: 'shop', pack: 'outfit_captain' } },
  { id: 'tophat', name: 'Top hat', unlock: { by: 'shop', pack: 'outfit_night' } },
];

const NAVY = 0x2d3a5a;

export const COATS: readonly Coat[] = [
  { id: 'auto', name: 'Your colour', shirt: -1, pants: NAVY, unlock: FREE },
  { id: 'coral', name: 'Coral', shirt: 0xe8664a, pants: NAVY, unlock: FREE },
  { id: 'sky', name: 'Sky', shirt: 0x4a9de8, pants: NAVY, unlock: FREE },
  { id: 'sun', name: 'Sun', shirt: 0xf2c14e, pants: NAVY, unlock: FREE },
  { id: 'leaf', name: 'Leaf', shirt: 0x6ccf7f, pants: NAVY, unlock: FREE },
  { id: 'plum', name: 'Plum', shirt: 0xc77dde, pants: NAVY, unlock: FREE },
  { id: 'rose', name: 'Rose', shirt: 0xf28fb0, pants: NAVY, unlock: FREE },
  { id: 'teal', name: 'Teal', shirt: 0x5fd3d0, pants: NAVY, unlock: FREE },
  { id: 'ash', name: 'Ash', shirt: 0xe0e0e0, pants: NAVY, unlock: FREE },
  {
    id: 'khaki',
    name: 'Survivor khaki',
    shirt: 0xb8a070,
    pants: 0x5a4a30,
    unlock: record('Reach day 10 on an island', (r) => r.bestDay >= 10),
  },
  {
    id: 'hunter',
    name: 'Bloom hunter',
    shirt: 0x4a6a3a,
    pants: 0x2e3a24,
    unlock: record('Slay 300 of the Bloom', (r) => r.slain >= 300),
  },
  {
    id: 'lab',
    name: 'Verdance lab coat',
    shirt: 0xeef2ee,
    pants: 0x3a4a5a,
    unlock: { by: 'shop', pack: 'outfit_verdance' },
  },
  {
    id: 'navy',
    name: "Captain's coat",
    shirt: 0x22305a,
    pants: 0xe8e4d8,
    unlock: { by: 'shop', pack: 'outfit_captain' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    shirt: 0x26262e,
    pants: 0x141418,
    unlock: { by: 'shop', pack: 'outfit_night' },
  },
];

/** A base style, pet gear or a fire colour: looks for what you build and tame. */
export interface Extra {
  id: string;
  name: string;
  unlock: Unlock;
}

/**
 * Paint for the walls, floors, roofs and doors a survivor builds (everyone on the island sees
 * it; play/render/paint.ts does the painting).
 */
export const BASE_STYLES: readonly Extra[] = [
  { id: 'plain', name: 'Island timber', unlock: FREE },
  { id: 'outpost', name: 'Verdance Outpost', unlock: { by: 'shop', pack: 'base_outpost' } },
  { id: 'driftwood', name: 'Driftwood', unlock: { by: 'shop', pack: 'base_driftwood' } },
  { id: 'cabin', name: 'Cozy Cabin', unlock: { by: 'shop', pack: 'base_cabin' } },
];

/** What a survivor's pets wear. */
export const PET_GEAR: readonly Extra[] = [
  { id: 'none', name: 'No gear', unlock: FREE },
  { id: 'collar', name: 'Red collar', unlock: { by: 'shop', pack: 'pet_gear' } },
  { id: 'bandana', name: 'Bandana', unlock: { by: 'shop', pack: 'pet_gear' } },
  { id: 'tophat', name: 'Tiny top hat', unlock: { by: 'shop', pack: 'pet_gear' } },
];

/** The flames of a survivor's campfires, torch posts, lamps and torches. */
export const FLAMES: readonly Extra[] = [
  { id: 'fire', name: 'Firelight', unlock: FREE },
  { id: 'blue', name: 'Blue spirit', unlock: { by: 'shop', pack: 'fire_colours' } },
  { id: 'green', name: 'Bloom green', unlock: { by: 'shop', pack: 'fire_colours' } },
  { id: 'violet', name: 'Violet', unlock: { by: 'shop', pack: 'fire_colours' } },
  { id: 'white', name: 'Ghost white', unlock: { by: 'shop', pack: 'fire_colours' } },
];

export interface Look {
  hat: string;
  coat: string;
  base: string;
  pet: string;
  flame: string;
}

export const DEFAULT_LOOK: Look = {
  hat: 'none',
  coat: 'auto',
  base: 'plain',
  pet: 'none',
  flame: 'fire',
};

const hatById = new Map(HATS.map((h) => [h.id, h]));
const coatById = new Map(COATS.map((c) => [c.id, c]));
const baseById = new Map(BASE_STYLES.map((e) => [e.id, e]));
const petById = new Map(PET_GEAR.map((e) => [e.id, e]));
const flameById = new Map(FLAMES.map((e) => [e.id, e]));

export function hatOf(id: string): Hat {
  return hatById.get(id) ?? (HATS[0] as Hat);
}

export function coatOf(id: string): Coat {
  return coatById.get(id) ?? (COATS[0] as Coat);
}

/** "hat.coat.base.pet.flame" (codes from before v1.38 have the first two only). */
export function lookCode(look: Look): string {
  return `${look.hat}.${look.coat}.${look.base}.${look.pet}.${look.flame}`;
}

/** A look from its code (untrusted: unknown parts are the default). */
export function parseLook(raw: unknown): Look {
  if (typeof raw !== 'string') return { ...DEFAULT_LOOK };
  const [hat = '', coat = '', base = '', pet = '', flame = ''] = raw.slice(0, 80).split('.');
  return {
    hat: hatById.has(hat) ? hat : DEFAULT_LOOK.hat,
    coat: coatById.has(coat) ? coat : DEFAULT_LOOK.coat,
    base: baseById.has(base) ? base : DEFAULT_LOOK.base,
    pet: petById.has(pet) ? pet : DEFAULT_LOOK.pet,
    flame: flameById.has(flame) ? flame : DEFAULT_LOOK.flame,
  };
}

/** Is it the player's to wear (records kept, shop sets owned)? */
export function unlocked(u: Unlock, r: Records, owned: ReadonlySet<string>): boolean {
  if (u.by === 'free') return true;
  if (u.by === 'record') return u.has(r);
  return owned.has(u.pack);
}

/** The look to wear: anything no longer the player's goes back to the default part. */
export function wearable(look: Look, r: Records, owned: ReadonlySet<string>): Look {
  const ok = (u: Unlock | undefined) => !!u && unlocked(u, r, owned);
  return {
    hat: ok(hatOf(look.hat).unlock) ? look.hat : DEFAULT_LOOK.hat,
    coat: ok(coatOf(look.coat).unlock) ? look.coat : DEFAULT_LOOK.coat,
    base: ok(baseById.get(look.base)?.unlock) ? look.base : DEFAULT_LOOK.base,
    pet: ok(petById.get(look.pet)?.unlock) ? look.pet : DEFAULT_LOOK.pet,
    flame: ok(flameById.get(look.flame)?.unlock) ? look.flame : DEFAULT_LOOK.flame,
  };
}

/** The shirt colour a look shows (`own`: the survivor's colour, for 'auto'). */
export function shirtOf(look: Look, own: number): number {
  const c = coatOf(look.coat);
  return c.shirt < 0 ? own : c.shirt;
}
