// Seeded randomness. Only integer math and basic float ops, so the same seed
// gives the same island on every JS engine (phones, browsers, the room server).

/** Mulberry32: a fast seeded generator returning floats in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash of a 2D lattice point and a seed, as a uint32. */
export function hash2(x: number, z: number, seed: number): number {
  let h =
    Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** hash2 as a float in [0, 1). */
export function hash01(x: number, z: number, seed: number): number {
  return hash2(x, z, seed) / 4294967296;
}

/** A fresh random seed for a new island (uses Math.random: callers outside the rules only). */
export function randomSeed(random: () => number): number {
  return Math.floor(random() * 0x7fffffff) + 1;
}
