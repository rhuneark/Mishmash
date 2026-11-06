// Ground detail drawn in code: one tileable 256² texture with a pattern per channel,
// R grass (mottling and tufts), G sand (wind ripples and grains), B leaf litter (fallen
// leaves; needles and marsh blotches at other scales) and A rock (cracks and grain).
// The terrain shader mixes them by biome; the water uses G and B for ripples and foam.

import * as THREE from 'three';

const N = 256;

let shared: THREE.DataTexture | null = null;

/** The shared detail texture (made once, on first use). */
export function groundTexture(): THREE.DataTexture {
  if (shared) return shared;
  const data = new Uint8Array(N * N * 4);
  const rand = mulberry(20261104);
  const grass = grassLayer(rand);
  const sand = sandLayer(rand);
  const leaves = leafLayer(rand);
  const rock = rockLayer(rand);
  for (let i = 0; i < N * N; i++) {
    data[i * 4] = byte(grass[i] as number);
    data[i * 4 + 1] = byte(sand[i] as number);
    data[i * 4 + 2] = byte(leaves[i] as number);
    data[i * 4 + 3] = byte(rock[i] as number);
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  shared = tex;
  return tex;
}

/**
 * How sharp the ground stays where the camera looks along it (anisotropic filtering; the
 * device's own limit applies).
 */
export function setGroundAnisotropy(n: number): void {
  const tex = groundTexture();
  if (tex.anisotropy === n) return;
  tex.anisotropy = n;
  tex.needsUpdate = true;
}

const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable value noise: a `period`² lattice of random values, smoothly interpolated. */
function lattice(period: number, rand: () => number): (x: number, y: number) => number {
  const v = new Float32Array(period * period);
  for (let i = 0; i < v.length; i++) v[i] = rand();
  return (x, y) => {
    const fx = (x / N) * period;
    const fy = (y / N) * period;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const at = (i: number, j: number) =>
      v[(((j % period) + period) % period) * period + (((i % period) + period) % period)] as number;
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

/** Fractal noise from lattices of the given periods (each half as strong as the last). */
function fbm(periods: number[], rand: () => number): (x: number, y: number) => number {
  const layers = periods.map((p) => lattice(p, rand));
  let total = 0;
  for (let k = 0; k < layers.length; k++) total += 0.5 ** k;
  return (x, y) => {
    let s = 0;
    for (let k = 0; k < layers.length; k++)
      s += (layers[k] as (x: number, y: number) => number)(x, y) * 0.5 ** k;
    return s / total;
  };
}

/** Stamps a soft-edged rotated ellipse, wrapping round the edges. */
function stamp(
  out: Float32Array,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  angle: number,
  value: number,
  mode: 'max' | 'set' | 'add',
): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const r = Math.ceil(Math.max(rx, ry)) + 1;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const u = (dx * c + dy * s) / rx;
      const w = (-dx * s + dy * c) / ry;
      const d = u * u + w * w;
      if (d > 1) continue;
      const k = Math.min(1, (1 - d) * 3);
      const x = (((Math.round(cx) + dx) % N) + N) % N;
      const y = (((Math.round(cy) + dy) % N) + N) % N;
      const i = y * N + x;
      const old = out[i] as number;
      if (mode === 'max') out[i] = Math.max(old, value * k);
      else if (mode === 'add') out[i] = old + value * k;
      else out[i] = old + (value - old) * k;
    }
  }
}

function grassLayer(rand: () => number): Float32Array {
  const out = new Float32Array(N * N);
  const big = fbm([4, 8, 16, 32], rand);
  const fine = lattice(64, rand);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      out[y * N + x] = 0.5 + (big(x, y) - 0.5) * 1.1 + (fine(x, y) - 0.5) * 0.25;
  // Tufts: little darker clumps and sunlit blades.
  for (let k = 0; k < 900; k++) {
    const v = rand() < 0.5 ? -0.22 : 0.2;
    stamp(
      out,
      rand() * N,
      rand() * N,
      1 + rand() * 1.6,
      1 + rand() * 1.2,
      rand() * Math.PI,
      v,
      'add',
    );
  }
  return out;
}

function sandLayer(rand: () => number): Float32Array {
  const out = new Float32Array(N * N);
  const warp = fbm([4, 8], rand);
  const grain = lattice(128, rand);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const t = (y / N) * 10 + warp(x, y) * 2.2;
      const ripple = Math.sin(t * Math.PI * 2);
      // Ripples are sharp on the crest, soft in the trough.
      const r = ripple > 0 ? ripple ** 0.6 : -((-ripple) ** 1.6);
      out[y * N + x] = 0.55 + r * 0.2 + (grain(x, y) - 0.5) * 0.35;
    }
  }
  return out;
}

function leafLayer(rand: () => number): Float32Array {
  const out = new Float32Array(N * N);
  const clumps = fbm([4, 8], rand);
  // Leaves gather in drifts: more where the clump noise is high, overlapping there.
  for (let k = 0; k < 1500; k++) {
    const x = rand() * N;
    const y = rand() * N;
    if (clumps(x, y) < 0.35 + rand() * 0.4) continue;
    const len = 4 + rand() * 6;
    stamp(out, x, y, len, len * (0.4 + rand() * 0.25), rand() * Math.PI, 0.5 + rand() * 0.5, 'set');
  }
  return out;
}

function rockLayer(rand: () => number): Float32Array {
  const out = new Float32Array(N * N);
  const tone = fbm([4, 8, 16], rand);
  const grain = lattice(96, rand);
  const warpX = fbm([4, 8], rand);
  const warpY = fbm([4, 8], rand);
  const show = lattice(5, rand);
  // Cracks: the edges between jittered cells (Worley F2 - F1), bent by noise and only
  // showing in places, so they read as weathered rock rather than paving.
  const C = 8;
  const S = N / C;
  const px = new Float32Array(C * C);
  const py = new Float32Array(C * C);
  for (let i = 0; i < C * C; i++) {
    px[i] = rand() * S;
    py[i] = rand() * S;
  }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const wx = (((x + (warpX(x, y) - 0.5) * 40) % N) + N) % N;
      const wy = (((y + (warpY(x, y) - 0.5) * 40) % N) + N) % N;
      let f1 = Infinity;
      let f2 = Infinity;
      const ci = Math.floor(wx / S);
      const cj = Math.floor(wy / S);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const k = ((cj + dj + C) % C) * C + ((ci + di + C) % C);
          const dx = (ci + di) * S + (px[k] as number) - wx;
          const dy = (cj + dj) * S + (py[k] as number) - wy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < f1) {
            f2 = f1;
            f1 = d;
          } else if (d < f2) f2 = d;
        }
      }
      const crack =
        Math.max(0, 1 - (f2 - f1) / 2.4) * Math.max(0, Math.min(1, (show(x, y) - 0.35) * 3));
      out[y * N + x] = 0.6 + (tone(x, y) - 0.5) * 0.85 + (grain(x, y) - 0.5) * 0.3 - crack * 0.3;
    }
  }
  return out;
}
