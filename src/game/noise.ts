// Value noise and fractal noise built only from +, -, *, floor and hashes
// (no trig or exp), so results match bit-for-bit across JS engines.

import { hash01 } from './rng';

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Smooth value noise in [0, 1). */
export function noise2(x: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const a = hash01(xi, zi, seed);
  const b = hash01(xi + 1, zi, seed);
  const c = hash01(xi, zi + 1, seed);
  const d = hash01(xi + 1, zi + 1, seed);
  const u = fade(xf);
  const v = fade(zf);
  const top = a + (b - a) * u;
  const bottom = c + (d - c) * u;
  return top + (bottom - top) * v;
}

/** Fractal (fbm) value noise in [0, 1). */
export function fbm(x: number, z: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * f, z * f, seed + i * 1013) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/** Smooth 0→1 step between edge0 and edge1. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** A round bump: 1 at the centre, 0 at `radius` and beyond (no exp). */
export function bump(dx: number, dz: number, radius: number): number {
  const t = (dx * dx + dz * dz) / (radius * radius);
  if (t >= 1) return 0;
  const s = 1 - t;
  return s * s;
}
