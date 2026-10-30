// The shop: outfit sets for RUN Bits (RUN's currency, 100 Bits = $1). Looks only, never
// anything that helps on the island. Each set is bought once and kept: a non-consumable
// entitlement with the set's id (outfits.ts unlocks by it). rundot/shop.config.json is
// generated from this list (npm run shop-config); a test keeps the two the same.

export const SETS = ['outfit_verdance', 'outfit_captain', 'outfit_night'] as const;
export type SetId = (typeof SETS)[number];

export interface Pack {
  id: string;
  name: string;
  blurb: string;
  /** Price in RUN Bits. */
  bits: number;
  /** The sets it unlocks. */
  sets: readonly SetId[];
}

export const PACKS: readonly Pack[] = [
  {
    id: 'outfit_verdance',
    name: 'Verdance set',
    blurb: "The hood and lab coat Kessler Station's staff wore. Looks only.",
    bits: 199,
    sets: ['outfit_verdance'],
  },
  {
    id: 'outfit_captain',
    name: "Captain's set",
    blurb: "A captain's hat and a navy coat over white trousers. Looks only.",
    bits: 199,
    sets: ['outfit_captain'],
  },
  {
    id: 'outfit_night',
    name: 'Night set',
    blurb: 'A top hat and a midnight suit, for Bloom nights. Looks only.',
    bits: 199,
    sets: ['outfit_night'],
  },
  {
    id: 'outfit_all',
    name: 'Wardrobe bundle',
    blurb: 'All three sets for less. Looks only.',
    bits: 449,
    sets: SETS,
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
      tags: [p.sets.length > 1 ? 'bundle' : 'outfit'],
      sortOrder: i + 1,
      releasedAt: null,
      expiresAt: null,
    })),
    sales: [],
    collections: [],
  };
}
