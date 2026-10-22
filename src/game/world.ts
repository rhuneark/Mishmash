// The island: generated from a seed, identically on every client and on the
// room server. Heights, biomes, harvestable nodes (ids are stable indices),
// freshwater pools, landmark colliders and monster spots.

import { fbm, bump, smoothstep } from './noise';
import { hash01, rng } from './rng';
import { NODE, NODES } from './content/nodes';
import { POIS, TOWER_VINES, POI_BY_ID, SPAWN } from './content/pois';
import { cargoCode } from './content/notes';

export const WORLD = 1024;
export const HALF = WORLD / 2;
/** Heightmap spacing (m). */
export const CELL = 2;
export const GRID = WORLD / CELL;
export const CHUNK = 32;
export const CHUNKS = WORLD / CHUNK;
/** Terrain lower than this is too deep to walk. */
export const DEEP = -0.9;

export const BIOME = {
  ocean: 0,
  beach: 1,
  meadow: 2,
  jungle: 3,
  forest: 4,
  highland: 5,
  bog: 6,
} as const;
export type Biome = (typeof BIOME)[keyof typeof BIOME];

export const BIOME_NAMES = [
  'Ocean',
  'Beach',
  'Meadow',
  'Jungle',
  'Pine forest',
  'Highlands',
  'Marsh',
];

/** The peak (radio tower) and the marsh (research station). */
export const PEAK = { x: 150, z: -175 };
export const BOG = { x: 215, z: 95 };

export interface Pool {
  x: number;
  z: number;
  r: number;
  /** Water surface height. */
  y: number;
}

/** A rotated box collider (landmark structures). */
export interface Collider {
  x: number;
  z: number;
  hw: number;
  hd: number;
  c: number;
  s: number;
  h: number;
  poi: string;
}

export interface Island {
  seed: number;
  heights: Float32Array;
  biomes: Uint8Array;
  nodeX: Float32Array;
  nodeZ: Float32Array;
  nodeType: Uint8Array;
  /** 0..255 per node: picks size, rotation and colour variety. */
  nodeVar: Uint8Array;
  nodeCount: number;
  /** Node ids of chunk c are chunkStart[c] .. chunkStart[c + 1] - 1. */
  chunkStart: Int32Array;
  pools: Pool[];
  colliders: Collider[];
  /** Rooted Snapjaws (respawn daily). */
  snapjaws: { x: number; z: number }[];
  /** The vine nodes over the tower base. */
  towerVines: number[];
  /** The cargo lock code. */
  code: string;
}

function islandHeight(
  x: number,
  z: number,
  seed: number,
): { h: number; land: number; bogW: number } {
  const d = Math.sqrt(x * x + z * z);
  const nx = d > 1 ? x / d : 0;
  const nz = d > 1 ? z / d : 0;
  const coastVar = (fbm(nx * 2.2 + 5, nz * 2.2 + 5, seed + 11, 3) - 0.5) * 0.55;
  const radius = 400 * (1 + coastVar);
  const t = d / radius;
  const land = 1 - t * t;
  const detail = fbm(x * 0.008, z * 0.008, seed + 21, 4) - 0.5;
  let h = land * 10 + detail * 7 * smoothstep(-0.1, 0.25, land);
  if (land < 0.02) h = Math.min(h, land * 14);
  if (land > 0.12) h = Math.max(h, 0.8 + land * 2);
  // Lumpy, not round: the radius of each feature wobbles with noise.
  const wob = fbm(x * 0.012 + 40, z * 0.012 - 90, seed + 51, 3);
  h += 26 * bump(x - PEAK.x, z - PEAK.z, 150 * (0.7 + wob * 0.6));
  h += 7 * bump(x - PEAK.x + 70, z - PEAK.z - 40, 70 * (0.7 + wob * 0.6));
  h += 9 * bump(x + 165, z + 175, 95 * (0.75 + wob * 0.5));
  h += 5 * bump(x + 40, z + 40, 120);
  const bogW = bump(x - BOG.x, z - BOG.z, 115 * (0.65 + wob * 0.7));
  if (bogW > 0) h = h * (1 - bogW * 0.8) + bogW * 0.8 * 1.4;
  return { h, land, bogW };
}

export function generateIsland(seed: number): Island {
  const n1 = GRID + 1;
  const heights = new Float32Array(n1 * n1);
  const lands = new Float32Array(n1 * n1);
  const bogs = new Float32Array(n1 * n1);
  for (let j = 0; j <= GRID; j++) {
    const z = j * CELL - HALF;
    for (let i = 0; i <= GRID; i++) {
      const x = i * CELL - HALF;
      const s = islandHeight(x, z, seed);
      heights[j * n1 + i] = s.h;
      lands[j * n1 + i] = s.land;
      bogs[j * n1 + i] = s.bogW;
    }
  }

  // Flatten the ground under landmarks.
  for (const poi of POIS) {
    const ci = Math.round((poi.x + HALF) / CELL);
    const cj = Math.round((poi.z + HALF) / CELL);
    const target = Math.max(1.6, heights[cj * n1 + ci] ?? 1.6);
    const r = poi.flat;
    const rc = Math.ceil(r / CELL) + 1;
    for (let j = cj - rc; j <= cj + rc; j++) {
      for (let i = ci - rc; i <= ci + rc; i++) {
        if (i < 0 || j < 0 || i > GRID || j > GRID) continue;
        const dx = i * CELL - HALF - poi.x;
        const dz = j * CELL - HALF - poi.z;
        const w = 1 - smoothstep(r * 0.6, r, Math.sqrt(dx * dx + dz * dz));
        const k = j * n1 + i;
        heights[k] = (heights[k] as number) * (1 - w) + target * w;
      }
    }
  }

  const random = rng(seed ^ 0x13579bdf);

  // Freshwater pools in meadows and jungle.
  const pools: Pool[] = [];
  for (let tries = 0; tries < 4000 && pools.length < 14; tries++) {
    const x = (random() - 0.5) * 760;
    const z = (random() - 0.5) * 760;
    const hc = sampleHeights(heights, x, z);
    const land = sampleHeights(lands, x, z);
    const bogW = sampleHeights(bogs, x, z);
    if (land < 0.3 || bogW > 0.05 || hc < 1.2 || hc > 9) continue;
    if (POIS.some((p) => dist(p.x, p.z, x, z) < p.flat + 25)) continue;
    if (pools.some((p) => dist(p.x, p.z, x, z) < 90)) continue;
    const r = 2.5 + random() * 2;
    pools.push({ x, z, r, y: hc - 0.25 });
    carvePool(heights, x, z, r, hc);
  }

  // Biomes per cell.
  const biomes = new Uint8Array(GRID * GRID);
  for (let j = 0; j < GRID; j++) {
    const z = j * CELL - HALF + CELL / 2;
    for (let i = 0; i < GRID; i++) {
      const x = i * CELL - HALF + CELL / 2;
      const h = sampleHeights(heights, x, z);
      const land = sampleHeights(lands, x, z);
      const bogW = sampleHeights(bogs, x, z);
      let b: Biome;
      if (h < -0.05) b = BIOME.ocean;
      else if (h < 1.7 && land < 0.4) b = BIOME.beach;
      else if (bogW > 0.22) b = BIOME.bog;
      else if (h + (fbm(x * 0.03, z * 0.03, seed + 61, 2) - 0.5) * 8 > 17) b = BIOME.highland;
      else {
        const moist = fbm(x * 0.006 + 300, z * 0.006 - 200, seed + 31, 2);
        const pine = fbm(x * 0.005 - 700, z * 0.005 + 50, seed + 41, 2);
        if (h > 10 || pine > 0.63) b = BIOME.forest;
        else if (moist > 0.5) b = BIOME.jungle;
        else b = BIOME.meadow;
      }
      biomes[j * GRID + i] = b;
    }
  }

  // Landmark colliders.
  const colliders: Collider[] = [];
  for (const poi of POIS) {
    for (const b of poi.boxes) {
      colliders.push({
        x: poi.x + b.dx,
        z: poi.z + b.dz,
        hw: b.w / 2,
        hd: b.d / 2,
        c: Math.cos(b.rot),
        s: Math.sin(b.rot),
        h: b.h,
        poi: poi.id,
      });
    }
  }

  // Scatter nodes.
  type Cand = { x: number; z: number; t: number; v: number; chunk: number; order: number };
  const cands: Cand[] = [];
  const push = (x: number, z: number, t: number, v: number) => {
    const cx = Math.floor((x + HALF) / CHUNK);
    const cz = Math.floor((z + HALF) / CHUNK);
    if (cx < 0 || cz < 0 || cx >= CHUNKS || cz >= CHUNKS) return;
    cands.push({ x, z, t, v, chunk: cz * CHUNKS + cx, order: cands.length });
  };
  const SP = 3;
  const cells = WORLD / SP;
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const r0 = hash01(i, j, seed + 101);
      const x = i * SP - HALF + hash01(i, j, seed + 102) * SP;
      const z = j * SP - HALF + hash01(i, j, seed + 103) * SP;
      const b = biomeAtArr(biomes, x, z);
      if (b === BIOME.ocean) continue;
      if (POIS.some((p) => dist2(p.x, p.z, x, z) < (p.flat + 2) * (p.flat + 2))) continue;
      if (pools.some((p) => dist2(p.x, p.z, x, z) < (p.r + 2.5) * (p.r + 2.5))) continue;
      const t = pickNode(b, r0);
      if (t < 0) continue;
      push(x, z, t, Math.floor(hash01(i, j, seed + 104) * 256));
    }
  }

  // Crash debris: suitcases and wreckage around the fuselage, cockpit and tail.
  const crash = POI_BY_ID['crash'];
  const cockpit = POI_BY_ID['cockpit'];
  const tail = POI_BY_ID['tail'];
  // Rejection sampling (no trig) keeps positions identical across JS engines.
  const ring = (cx: number, cz: number, rMin: number, rMax: number, n: number, type: number) => {
    for (let k = 0; k < n;) {
      const dx = (random() * 2 - 1) * rMax;
      const dz = (random() * 2 - 1) * rMax;
      const d2 = dx * dx + dz * dz;
      if (d2 < rMin * rMin || d2 > rMax * rMax) continue;
      if (hitColliderList(colliders, cx + dx, cz + dz, 1)) continue;
      push(cx + dx, cz + dz, type, Math.floor(random() * 256));
      k++;
    }
  };
  if (crash) {
    ring(crash.x, crash.z, 12, 48, 16, NODE.luggage);
    ring(crash.x, crash.z, 10, 40, 10, NODE.scrap);
  }
  if (cockpit) {
    ring(cockpit.x, cockpit.z, 7, 20, 4, NODE.scrap);
    ring(cockpit.x, cockpit.z, 8, 22, 3, NODE.luggage);
  }
  if (tail) {
    ring(tail.x, tail.z, 9, 26, 6, NODE.scrap);
    ring(tail.x, tail.z, 10, 30, 5, NODE.luggage);
  }

  // Tower vines (tracked so the antenna knows when the way is clear).
  const tower = POI_BY_ID['tower'];
  const vineOrders: number[] = [];
  if (tower) {
    for (const v of TOWER_VINES) {
      vineOrders.push(cands.length);
      push(tower.x + v.dx, tower.z + v.dz, NODE.vines, 128);
    }
  }

  // Stable sort by chunk so each chunk's ids are contiguous.
  const sorted = [...cands].sort((a, b) => a.chunk - b.chunk || a.order - b.order);
  const count = sorted.length;
  const nodeX = new Float32Array(count);
  const nodeZ = new Float32Array(count);
  const nodeType = new Uint8Array(count);
  const nodeVar = new Uint8Array(count);
  const chunkStart = new Int32Array(CHUNKS * CHUNKS + 1);
  const idOfOrder = new Map<number, number>();
  for (let k = 0; k < count; k++) {
    const c = sorted[k] as Cand;
    nodeX[k] = c.x;
    nodeZ[k] = c.z;
    nodeType[k] = c.t;
    nodeVar[k] = c.v;
    idOfOrder.set(c.order, k);
    (chunkStart[c.chunk + 1] as number)++;
  }
  for (let c = 0; c < CHUNKS * CHUNKS; c++) {
    chunkStart[c + 1] = (chunkStart[c + 1] as number) + (chunkStart[c] as number);
  }

  // Rooted Snapjaws in the jungle and marsh, away from the crash site.
  const snapjaws: { x: number; z: number }[] = [];
  const SJ = 9;
  for (let j = 0; j < WORLD / SJ; j++) {
    for (let i = 0; i < WORLD / SJ; i++) {
      const x = i * SJ - HALF + hash01(i, j, seed + 201) * SJ;
      const z = j * SJ - HALF + hash01(i, j, seed + 202) * SJ;
      const b = biomeAtArr(biomes, x, z);
      const chance = b === BIOME.jungle ? 0.02 : b === BIOME.bog ? 0.06 : 0;
      if (hash01(i, j, seed + 203) >= chance) continue;
      if (dist(x, z, SPAWN.x, SPAWN.z) < 70) continue;
      if (POIS.some((p) => p.id !== 'station' && dist(p.x, p.z, x, z) < p.flat + 6)) continue;
      snapjaws.push({ x, z });
    }
  }

  return {
    seed,
    heights,
    biomes,
    nodeX,
    nodeZ,
    nodeType,
    nodeVar,
    nodeCount: count,
    chunkStart,
    pools,
    colliders,
    snapjaws,
    towerVines: vineOrders.map((o) => idOfOrder.get(o) ?? -1).filter((id) => id >= 0),
    code: cargoCode(seed),
  };
}

/** Node type for a scatter cell in this biome (-1 for none). */
function pickNode(b: number, r: number): number {
  const table = NODE_TABLE[b];
  if (!table) return -1;
  let acc = 0;
  for (const [t, p] of table) {
    acc += p;
    if (r < acc) return t;
  }
  return -1;
}

// Probability per 3 m scatter cell, by biome.
const NODE_TABLE: Record<number, [number, number][]> = {
  [BIOME.beach]: [
    [NODE.palm, 0.05],
    [NODE.pebble, 0.03],
    [NODE.branch, 0.012],
  ],
  [BIOME.meadow]: [
    [NODE.bush, 0.06],
    [NODE.berry, 0.028],
    [NODE.pebble, 0.018],
    [NODE.branch, 0.022],
    [NODE.rock, 0.012],
    [NODE.palm, 0.01],
    [NODE.jungle, 0.02],
  ],
  [BIOME.jungle]: [
    [NODE.jungle, 0.16],
    [NODE.bush, 0.1],
    [NODE.berry, 0.02],
    [NODE.mushroom, 0.03],
    [NODE.branch, 0.03],
    [NODE.rock, 0.01],
    [NODE.vines, 0.006],
    [NODE.palm, 0.02],
  ],
  [BIOME.forest]: [
    [NODE.pine, 0.17],
    [NODE.bush, 0.05],
    [NODE.berry, 0.03],
    [NODE.rock, 0.03],
    [NODE.branch, 0.03],
    [NODE.mushroom, 0.012],
  ],
  [BIOME.highland]: [
    [NODE.rock, 0.08],
    [NODE.pine, 0.04],
    [NODE.pebble, 0.03],
    [NODE.bush, 0.02],
  ],
  [BIOME.bog]: [
    [NODE.vines, 0.035],
    [NODE.mushroom, 0.05],
    [NODE.jungle, 0.05],
    [NODE.bush, 0.05],
    [NODE.branch, 0.02],
  ],
};

function carvePool(heights: Float32Array, x: number, z: number, r: number, h0: number): void {
  const n1 = GRID + 1;
  const ci = Math.round((x + HALF) / CELL);
  const cj = Math.round((z + HALF) / CELL);
  const rc = Math.ceil((r + 3) / CELL);
  for (let j = cj - rc; j <= cj + rc; j++) {
    for (let i = ci - rc; i <= ci + rc; i++) {
      if (i < 0 || j < 0 || i > GRID || j > GRID) continue;
      const d = dist(i * CELL - HALF, j * CELL - HALF, x, z);
      const k = j * n1 + i;
      if (d <= r) heights[k] = h0 - 0.8;
      else if (d <= r + 3) {
        const w = smoothstep(r + 3, r, d);
        heights[k] = (heights[k] as number) * (1 - w) + (h0 - 0.1) * w;
      }
    }
  }
}

function dist(ax: number, az: number, bx: number, bz: number): number {
  return Math.sqrt((ax - bx) * (ax - bx) + (az - bz) * (az - bz));
}

function dist2(ax: number, az: number, bx: number, bz: number): number {
  return (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
}

function sampleHeights(heights: Float32Array, x: number, z: number): number {
  const n1 = GRID + 1;
  const fx = Math.min(GRID - 0.001, Math.max(0, (x + HALF) / CELL));
  const fz = Math.min(GRID - 0.001, Math.max(0, (z + HALF) / CELL));
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  const a = heights[j * n1 + i] as number;
  const b = heights[j * n1 + i + 1] as number;
  const c = heights[(j + 1) * n1 + i] as number;
  const d = heights[(j + 1) * n1 + i + 1] as number;
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function biomeAtArr(biomes: Uint8Array, x: number, z: number): number {
  const i = Math.floor((x + HALF) / CELL);
  const j = Math.floor((z + HALF) / CELL);
  if (i < 0 || j < 0 || i >= GRID || j >= GRID) return BIOME.ocean;
  return biomes[j * GRID + i] as number;
}

// ---------------------------------------------------------------------------
// Queries.

export function heightAt(island: Island, x: number, z: number): number {
  return sampleHeights(island.heights, x, z);
}

export function biomeAt(island: Island, x: number, z: number): Biome {
  return biomeAtArr(island.biomes, x, z) as Biome;
}

export function chunkIndex(x: number, z: number): number {
  const cx = Math.min(CHUNKS - 1, Math.max(0, Math.floor((x + HALF) / CHUNK)));
  const cz = Math.min(CHUNKS - 1, Math.max(0, Math.floor((z + HALF) / CHUNK)));
  return cz * CHUNKS + cx;
}

/** Calls fn for every node id within radius r of (x, z). */
export function forNodesNear(
  island: Island,
  x: number,
  z: number,
  r: number,
  fn: (id: number, d2: number) => void,
): void {
  const c0x = Math.max(0, Math.floor((x - r + HALF) / CHUNK));
  const c1x = Math.min(CHUNKS - 1, Math.floor((x + r + HALF) / CHUNK));
  const c0z = Math.max(0, Math.floor((z - r + HALF) / CHUNK));
  const c1z = Math.min(CHUNKS - 1, Math.floor((z + r + HALF) / CHUNK));
  const r2 = r * r;
  for (let cz = c0z; cz <= c1z; cz++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      const c = cz * CHUNKS + cx;
      const end = island.chunkStart[c + 1] as number;
      for (let id = island.chunkStart[c] as number; id < end; id++) {
        const dx = (island.nodeX[id] as number) - x;
        const dz = (island.nodeZ[id] as number) - z;
        const d2 = dx * dx + dz * dz;
        if (d2 <= r2) fn(id, d2);
      }
    }
  }
}

/** Collision radius of a node type. */
export function nodeRadius(type: number): number {
  return NODES[type]?.radius ?? 0;
}

/** Is (x, z) inside a landmark collider (expanded by r)? Returns the collider. */
export function hitCollider(island: Island, x: number, z: number, r: number): Collider | null {
  return hitColliderList(island.colliders, x, z, r);
}

function hitColliderList(colliders: Collider[], x: number, z: number, r: number): Collider | null {
  for (const col of colliders) {
    const dx = x - col.x;
    const dz = z - col.z;
    if (Math.abs(dx) > col.hw + col.hd + r + 1 || Math.abs(dz) > col.hw + col.hd + r + 1) continue;
    const lx = dx * col.c + dz * col.s;
    const lz = -dx * col.s + dz * col.c;
    if (Math.abs(lx) < col.hw + r && Math.abs(lz) < col.hd + r) return col;
  }
  return null;
}

/** The pool whose water is within reach of (x, z), if any. */
export function poolNear(island: Island, x: number, z: number, reach: number): Pool | null {
  for (const p of island.pools) {
    if (dist(p.x, p.z, x, z) <= p.r + reach) return p;
  }
  return null;
}
