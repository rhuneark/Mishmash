// The shop, for RUN Bits (RUN's currency, 100 Bits = $1): outfit sets, base styles, pet
// gear and fire colours (looks only), three more island slots, and the Verdance Gold Card
// (claims the ad rewards without the video, still once a day each). Never anything that makes
// a survivor stronger. Each is bought once and kept: a non-consumable entitlement with the
// set's id (outfits.ts unlocks by it). rundot/shop.config.json is generated from this list
// (npm run shop-config); a test keeps the two the same.

export const OUTFIT_SETS = ['outfit_verdance', 'outfit_captain', 'outfit_night'] as const;
export const SETS = [
  ...OUTFIT_SETS,
  'base_outpost',
  'base_driftwood',
  'base_cabin',
  'pet_gear',
  'fire_colours',
  'more_islands',
  'gold_card',
] as const;
export type SetId = (typeof SETS)[number];

/** Island save slots, and how many more the extra islands pack gives. */
export const BASE_SLOTS = 3;
export const MORE_SLOTS = 3;

export type PackKind = 'outfit' | 'base' | 'pet' | 'fire' | 'extra';

export interface Pack {
  id: string;
  name: string;
  blurb: string;
  /** Price in RUN Bits. */
  bits: number;
  /** The sets it unlocks. */
  sets: readonly SetId[];
  kind: PackKind;
}

export const PACKS: readonly Pack[] = [
  {
    id: 'outfit_verdance',
    name: 'Verdance set',
    blurb: "The hood and lab coat Kessler Station's staff wore. Looks only.",
    bits: 199,
    sets: ['outfit_verdance'],
    kind: 'outfit',
  },
  {
    id: 'outfit_captain',
    name: "Captain's set",
    blurb: "A captain's hat and a navy coat over white trousers. Looks only.",
    bits: 199,
    sets: ['outfit_captain'],
    kind: 'outfit',
  },
  {
    id: 'outfit_night',
    name: 'Night set',
    blurb: 'A top hat and a midnight suit, for Bloom nights. Looks only.',
    bits: 199,
    sets: ['outfit_night'],
    kind: 'outfit',
  },
  {
    id: 'outfit_all',
    name: 'Wardrobe bundle',
    blurb: 'All three sets for less. Looks only.',
    bits: 449,
    sets: OUTFIT_SETS,
    kind: 'outfit',
  },
  {
    id: 'base_outpost',
    name: 'Verdance Outpost',
    blurb:
      'White panels and green trim, like Kessler Station. Paints the walls, floors, roofs and doors you build. Everyone on your island sees it.',
    bits: 199,
    sets: ['base_outpost'],
    kind: 'base',
  },
  {
    id: 'base_driftwood',
    name: 'Driftwood',
    blurb:
      'Sun-bleached planks and pale sandstone, washed up and nailed together. Paints the walls, floors, roofs and doors you build.',
    bits: 199,
    sets: ['base_driftwood'],
    kind: 'base',
  },
  {
    id: 'base_cabin',
    name: 'Cozy Cabin',
    blurb:
      'Warm red-brown logs and a red shingle roof. Paints the walls, floors, roofs and doors you build.',
    bits: 199,
    sets: ['base_cabin'],
    kind: 'base',
  },
  {
    id: 'pet_gear',
    name: 'Pet wardrobe',
    blurb: 'A red collar, a bandana and a tiny top hat for every animal you tame. Looks only.',
    bits: 149,
    sets: ['pet_gear'],
    kind: 'pet',
  },
  {
    id: 'fire_colours',
    name: 'Fire colours',
    blurb:
      'Blue spirit, Bloom green, violet and ghost white flames for your campfires, torch posts, lamps and torches.',
    bits: 99,
    sets: ['fire_colours'],
    kind: 'fire',
  },
  {
    id: 'more_islands',
    name: 'Three more islands',
    blurb: 'Keep six islands side by side instead of three.',
    bits: 199,
    sets: ['more_islands'],
    kind: 'extra',
  },
  {
    id: 'gold_card',
    name: 'Verdance Gold Card',
    blurb:
      'Claim the in-flight channel, Second wind, the repair crew, care packages, the vet drone and bonus shipments without watching the ad. Still once a day each.',
    bits: 499,
    sets: ['gold_card'],
    kind: 'extra',
  },
];

/** The packs to offer: sets not owned yet, and the bundle only while none is. */
export function packsFor(owned: ReadonlySet<string>): Pack[] {
  return PACKS.filter((p) =>
    p.sets.length > 1 ? p.sets.every((s) => !owned.has(s)) : !owned.has(p.sets[0] as string),
  );
}

export interface PackGrant {
  entitlementId: string;
  quantity: number;
  consumable: boolean;
}

export function packGrants(p: Pack): PackGrant[] {
  return p.sets.map((s) => ({ entitlementId: s, quantity: 1, consumable: false }));
}

/** The RUN shop config (written to rundot/shop.config.json). */
export function shopConfig(): Record<string, unknown> {
  return {
    items: PACKS.map((p, i) => ({
      itemId: p.id,
      name: p.name,
      description: p.blurb,
      category: 'non_consumable',
      price: { type: 'bucks', value: String(p.bits) },
      entitlements: packGrants(p),
      unique: true,
      active: true,
      regions: [],
      refundEligible: false,
      refundWindowHours: 0,
      tags: [p.sets.length > 1 ? 'bundle' : p.kind],
      sortOrder: i + 1,
      releasedAt: null,
      expiresAt: null,
    })),
    sales: [],
    collections: [],
  };
}
