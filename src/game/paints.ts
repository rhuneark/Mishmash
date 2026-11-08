// Colours for the base styles and fire colours (outfits.ts, shop.ts): which colours of a built
// piece each style repaints (the timber, beams, stone and roof colours the models in
// play/render/structures.ts are drawn with), and each flame's colours and light. Pure data:
// play/render/paint.ts does the painting, the wardrobe shows swatches.

/** The island's own colours, as the models draw them. */
export const TIMBER = 0x8a5f3a;
const TIMBER_DARK = 0x7a5232;
const BEAM = 0x5b3a22;
const BEAM_DARK = 0x4a2f1a;
const FLOORBOARD = 0x9a6a42;
export const STONE = 0x8f9196;
const STONE_DARK = 0x7f8186;
const STONE_LIGHT = 0x9a9ca1;
const STONE_PALE = 0xa3a5aa;
const STONE_MID = 0x86888d;
export const THATCH = 0xc9a85a;
const THATCH_DARK = 0xb8964a;
const THATCH_LIGHT = 0xd6b56a;
const ROOF_DARK = 0x6a4a2a;

/** For each style, a colour of a piece → the one it's painted. */
export const STYLE_PAINT: Record<string, Record<number, number>> = {
  outpost: {
    [TIMBER]: 0xdfe5e1,
    [TIMBER_DARK]: 0xc9d1cc,
    [BEAM]: 0x2f6b4a,
    [BEAM_DARK]: 0x245a3c,
    [FLOORBOARD]: 0xb4bcb7,
    [STONE]: 0xbfc4c0,
    [STONE_DARK]: 0xadb3af,
    [STONE_LIGHT]: 0xcbd0cc,
    [STONE_PALE]: 0xd3d8d4,
    [STONE_MID]: 0xb5bab6,
    [THATCH]: 0x3f7a55,
    [THATCH_DARK]: 0x2f6b4a,
    [THATCH_LIGHT]: 0x4f8d64,
    [ROOF_DARK]: 0x2f6b4a,
  },
  driftwood: {
    [TIMBER]: 0xaaa397,
    [TIMBER_DARK]: 0x968f84,
    [BEAM]: 0x6f6a61,
    [BEAM_DARK]: 0x5c5851,
    [FLOORBOARD]: 0xb5ad9f,
    [STONE]: 0xcbb995,
    [STONE_DARK]: 0xbaa784,
    [STONE_LIGHT]: 0xd6c6a3,
    [STONE_PALE]: 0xdfd0b0,
    [STONE_MID]: 0xc2b08d,
    [THATCH]: 0xd8cdae,
    [THATCH_DARK]: 0xc4b892,
    [THATCH_LIGHT]: 0xe5dbbf,
    [ROOF_DARK]: 0x7c766c,
  },
  cabin: {
    [TIMBER]: 0x92502d,
    [TIMBER_DARK]: 0x7a4024,
    [BEAM]: 0x4a2716,
    [BEAM_DARK]: 0x3b1f12,
    [FLOORBOARD]: 0xa35d33,
    [STONE]: 0x9e9182,
    [STONE_DARK]: 0x8e8273,
    [STONE_LIGHT]: 0xaa9d8e,
    [STONE_PALE]: 0xb4a798,
    [STONE_MID]: 0x978a7b,
    [THATCH]: 0xa8473a,
    [THATCH_DARK]: 0x8f3a30,
    [THATCH_LIGHT]: 0xbb5a48,
    [ROOF_DARK]: 0x8f3a30,
  },
};

/** Three chips for a style in the wardrobe: walls, stone, roof. */
export function styleSwatch(style: string): number[] {
  const p = STYLE_PAINT[style] ?? {};
  return [TIMBER, STONE, THATCH].map((c) => p[c] ?? c);
}

export interface FlamePaint {
  /** Outer, middle and core of the flame. */
  outer: number;
  mid: number;
  core: number;
  /** The light it throws. */
  light: number;
}

/** The flame colours as the models draw them (play/render/structures.ts `flameGroup`). */
export const FIRE: FlamePaint = { outer: 0xff7a2a, mid: 0xffc04a, core: 0xfff0a0, light: 0xffa04a };

export const FLAME_PAINT: Record<string, FlamePaint> = {
  fire: FIRE,
  blue: { outer: 0x2f6bff, mid: 0x4ac0ff, core: 0xc8f4ff, light: 0x4a9cff },
  green: { outer: 0x2fd14a, mid: 0x9aff4a, core: 0xe4ffb0, light: 0x7aff6a },
  violet: { outer: 0x8a3aff, mid: 0xc87aff, core: 0xf2d4ff, light: 0xb070ff },
  white: { outer: 0x9ab4ff, mid: 0xdde8ff, core: 0xffffff, light: 0xdde6ff },
};

/** A flame colour → the colour map that repaints a fire (the lamp's glow included). */
export function flameMap(flame: string): Record<number, number> | null {
  const f = FLAME_PAINT[flame];
  if (!f || flame === 'fire') return null;
  return {
    [FIRE.outer]: f.outer,
    [FIRE.mid]: f.mid,
    [FIRE.core]: f.core,
    [LAMP_GLOW]: f.mid,
  };
}

/** The lamp's glow, as its model draws it. */
export const LAMP_GLOW = 0xc8ff7a;
