// The island: generated from a seed, identically on every client and on the
// room server. Heights, biomes, harvestable nodes (ids are stable indices),
// freshwater pools, landmark colliders and monster spots.

import { fbm, bump, smoothstep } from './noise';
import { hash01, rng } from './rng';
import { NODE, NODES } from './content/nodes';
import { MOTHER_SPOT, POIS, TOWER_VINES, SPAWN, type PoiDef } from './content/pois';
import { cargoCode } from './content/notes';
import { SECRETS, TREASURES, type SecretDef } from './content/secrets';
import {
  CLASSIC,
  climateGen,
  layoutPois,
  place,
  unplace,
  type IslandParts,
  type IslandSpec,
  type Terrain,
} from './islands';

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
  /** What it was made from: seed, layout, climate, terrain. */
  spec: IslandSpec;
  /** Landmarks where they stand on this island (islands.ts layoutPois). */
  pois: PoiDef[];
  poiById: Record<string, PoiDef>;
  /** Where survivors wake up (the crash site). */
  spawn: { x: number; z: number };
  /** Where the Mother Bloom grows. */
  mother: { x: number; z: number };
  /** 1 for nodes under a secret site (secrets.ts): never there. */
  hidden: Uint8Array;
  /** Where each treasure map's X is (treasure_1 is [0]). */
  treasures: { x: number; z: number }[];
}

/** Extra terrain for the non-classic styles, in the classic layout's coordinates. */
interface TerrainGen {
  style: Terrain;
  islets: { x: number; z: number; r: number }[];
  hills: { x: number; z: number; r: number; h: number }[];
  bogs: { x: number; z: number; r: number }[];
}

/** Coast wobble along a direction (the classic one; rugged coasts wobble more). */
function coastVar(nx: number, nz: number, seed: number, rugged: boolean): number {
  const base = fbm(nx * 2.2 + 5, nz * 2.2 + 5, seed + 11, 3) - 0.5;
  if (!rugged) return base * 0.55;
  return base * 0.95 + (fbm(nx * 7 + 9, nz * 7 + 9, seed + 13, 2) - 0.5) * 0.4;
}

function terrainGen(style: Terrain, seed: number): TerrainGen | null {
  if (style === 'classic') return null;
  const g: TerrainGen = { style, islets: [], hills: [], bogs: [] };
  const clear = (x: number, z: number, room: number) =>
    POIS.every((p) => dist(p.x, p.z, x, z) > p.flat + room);
  // Integer hashes only (the island must come out the same on every device).
  for (let k = 0; k < 400; k++) {
    const rx = hash01(k, 1, seed + 301) * 2 - 1;
    const rz = hash01(k, 2, seed + 301) * 2 - 1;
    const len = Math.sqrt(rx * rx + rz * rz);
    if (len < 0.3 || len > 1) continue;
    const nx = rx / len;
    const nz = rz / len;
    if (style === 'islets' && g.islets.length < 11) {
      const coast = 400 * (1 + coastVar(nx, nz, seed, false));
      const out = coast + 18 + hash01(k, 3, seed + 301) * 40;
      const x = nx * out;
      const z = nz * out;
      if (
        Math.abs(x) < 480 &&
        Math.abs(z) < 480 &&
        g.islets.every((i) => dist(i.x, i.z, x, z) > 90)
      )
        g.islets.push({ x, z, r: 16 + hash01(k, 4, seed + 301) * 18 });
    }
    if (style === 'highlands' && g.hills.length < 4) {
      const r = 110 + hash01(k, 5, seed + 301) * 170;
      const x = nx * r;
      const z = nz * r;
      if (clear(x, z, 55) && g.hills.every((i) => dist(i.x, i.z, x, z) > 140))
        g.hills.push({
          x,
          z,
          r: 70 + hash01(k, 6, seed + 301) * 40,
          h: 10 + hash01(k, 7, seed + 301) * 8,
        });
    }
    if (style === 'wetlands' && g.bogs.length < 2) {
      const r = 90 + hash01(k, 8, seed + 301) * 180;
      const x = nx * r;
      const z = nz * r;
      if (
        clear(x, z, 70) &&
        dist(x, z, BOG.x, BOG.z) > 200 &&
        g.bogs.every((i) => dist(i.x, i.z, x, z) > 180)
      )
        g.bogs.push({ x, z, r: 70 + hash01(k, 9, seed + 301) * 30 });
    }
  }
  return g;
}

function islandHeight(
  x: number,
  z: number,
  seed: number,
  tg: TerrainGen | null,
): { h: number; land: number; bogW: number } {
  const d = Math.sqrt(x * x + z * z);
  const nx = d > 1 ? x / d : 0;
  const nz = d > 1 ? z / d : 0;
  let radius = 400 * (1 + coastVar(nx, nz, seed, tg?.style === 'rugged'));
  // Every landmark stays inland, and the coast inside the world.
  if (tg) radius = Math.min(495, Math.max(318, radius));
  const t = d / radius;
  const land = 1 - t * t;
  const detail = fbm(x * 0.008, z * 0.008, seed + 21, 4) - 0.5;
  let h = land * 10 + detail * (tg?.style === 'rugged' ? 10 : 7) * smoothstep(-0.1, 0.25, land);
  if (land < 0.02) h = Math.min(h, land * 14);
  if (land > 0.12) h = Math.max(h, 0.8 + land * 2);
  // Lumpy, not round: the radius of each feature wobbles with noise.
  const wob = fbm(x * 0.012 + 40, z * 0.012 - 90, seed + 51, 3);
  h += 26 * bump(x - PEAK.x, z - PEAK.z, 150 * (0.7 + wob * 0.6));
  h += 7 * bump(x - PEAK.x + 70, z - PEAK.z - 40, 70 * (0.7 + wob * 0.6));
  h += 9 * bump(x + 165, z + 175, 95 * (0.75 + wob * 0.5));
  h += 5 * bump(x + 40, z + 40, 120);
  let bogW = bump(x - BOG.x, z - BOG.z, 115 * (0.65 + wob * 0.7));
  if (tg) {
    if (tg.style === 'highlands') h += 8 * bump(x - PEAK.x, z - PEAK.z, 150 * (0.7 + wob * 0.6));
    for (const k of tg.hills) h += k.h * bump(x - k.x, z - k.z, k.r * (0.7 + wob * 0.6));
    for (const b of tg.bogs)
      bogW = Math.max(bogW, bump(x - b.x, z - b.z, b.r * (0.65 + wob * 0.7)));
  }
  if (bogW > 0) h = h * (1 - bogW * 0.8) + bogW * 0.8 * 1.4;
  if (tg) {
    for (const i of tg.islets) {
      // A sandbar of shallow water out to it, then the islet itself.
      const apron = bump(x - i.x, z - i.z, i.r * 3.4);
      if (apron > 0) h = Math.max(h, -0.75 + apron * 0.3);
      const b = bump(x - i.x, z - i.z, i.r * (0.75 + wob * 0.5));
      if (b > 0) h = Math.max(h, h * (1 - b) + 3.4 * b);
    }
  }
  return { h, land, bogW };
}

/**
 * The island for a seed and its parts (islands.ts). The classic parts give the island
 * the seed always gave; other layouts are the classic shape turned or mirrored on the
 * height grid, with the climate and terrain style on top.
 */
export function generateIsland(seed: number, parts: IslandParts = CLASSIC): Island {
  const spec: IslandSpec = { seed, ...parts };
  const turned = parts.turn !== 0 || parts.mirror;
  // A copy: the secret sites are added to it later (the classic layout is POIS itself).
  const pois = layoutPois(parts, POIS).slice();
  const poiById: Record<string, PoiDef> = Object.fromEntries(pois.map((p) => [p.id, p]));
  const cg = climateGen(parts.climate);
  const tg = terrainGen(parts.terrain, seed);
  const n1 = GRID + 1;
  const heights = new Float32Array(n1 * n1);
  const lands = new Float32Array(n1 * n1);
  const bogs = new Float32Array(n1 * n1);
  for (let j = 0; j <= GRID; j++) {
    const z = j * CELL - HALF;
    for (let i = 0; i <= GRID; i++) {
      const x = i * CELL - HALF;
      const q = turned ? unplace(parts, x, z) : { x, z };
      const s = islandHeight(q.x, q.z, seed, tg);
      heights[j * n1 + i] = s.h;
      lands[j * n1 + i] = s.land;
      bogs[j * n1 + i] = s.bogW;
    }
  }

  // Flatten the ground under landmarks.
  for (const poi of pois) {
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
  const poolCount = parts.terrain === 'wetlands' ? 26 : 14;
  for (let tries = 0; tries < 4000 && pools.length < poolCount; tries++) {
    const x = (random() - 0.5) * 760;
    const z = (random() - 0.5) * 760;
    const hc = sampleHeights(heights, x, z);
    const land = sampleHeights(lands, x, z);
    const bogW = sampleHeights(bogs, x, z);
    if (land < 0.3 || bogW > 0.05 || hc < 1.2 || hc > 9) continue;
    if (pois.some((p) => dist(p.x, p.z, x, z) < p.flat + 25)) continue;
    if (pools.some((p) => dist(p.x, p.z, x, z) < (poolCount > 14 ? 60 : 90))) continue;
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
      else if (h + (fbm(x * 0.03, z * 0.03, seed + 61, 2) - 0.5) * 8 > (cg?.highland ?? 17))
        b = BIOME.highland;
      else {
        const moist = fbm(x * 0.006 + 300, z * 0.006 - 200, seed + 31, 2);
        const pine = fbm(x * 0.005 - 700, z * 0.005 + 50, seed + 41, 2);
        if (h > 10 || pine > (cg?.pine ?? 0.63)) b = BIOME.forest;
        else if (moist > (cg?.moist ?? 0.5)) b = BIOME.jungle;
        else b = BIOME.meadow;
      }
      biomes[j * GRID + i] = b;
    }
  }

  // Landmark colliders.
  const colliders: Collider[] = [];
  for (const poi of pois) {
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
  const table = cg ? climateTable(cg.plants) : NODE_TABLE;
  const SP = 3;
  const cells = WORLD / SP;
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const r0 = hash01(i, j, seed + 101);
      const x = i * SP - HALF + hash01(i, j, seed + 102) * SP;
      const z = j * SP - HALF + hash01(i, j, seed + 103) * SP;
      const b = biomeAtArr(biomes, x, z);
      if (b === BIOME.ocean) continue;
      if (pois.some((p) => dist2(p.x, p.z, x, z) < (p.flat + 2) * (p.flat + 2))) continue;
      if (pools.some((p) => dist2(p.x, p.z, x, z) < (p.r + 2.5) * (p.r + 2.5))) continue;
      const t = pickNode(b, r0, table);
      if (t < 0) continue;
      push(x, z, t, Math.floor(hash01(i, j, seed + 104) * 256));
    }
  }

  // Crash debris: suitcases and wreckage around the fuselage, cockpit and tail.
  const crash = poiById['crash'];
  const cockpit = poiById['cockpit'];
  const tail = poiById['tail'];
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
  const tower = poiById['tower'];
  const vineOrders: number[] = [];
  if (tower) {
    for (const v of TOWER_VINES) {
      vineOrders.push(cands.length);
      const o = place(parts, v.dx, v.dz);
      push(tower.x + o.x, tower.z + o.z, NODE.vines, 128);
    }
  }

  // Starter supplies (generation 2): twigs, loose stones and bushes topped up around where
  // survivors wake, so the first tools come quick on every island.
  const spawn = place(parts, SPAWN.x, SPAWN.z);
  if ((parts.gen ?? 1) >= 2)
    starterKit(cands, push, spawn, { heights, colliders, pois, pools, seed });

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
      const chance = (b === BIOME.jungle ? 0.02 : b === BIOME.bog ? 0.06 : 0) * (cg?.snapjaws ?? 1);
      if (hash01(i, j, seed + 203) >= chance) continue;
      if (dist(x, z, spawn.x, spawn.z) < 70) continue;
      if (pois.some((p) => p.id !== 'station' && dist(p.x, p.z, x, z) < p.flat + 6)) continue;
      snapjaws.push({ x, z });
    }
  }

  const island: Island = {
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
    spec,
    pois,
    poiById,
    spawn,
    mother: place(parts, MOTHER_SPOT.x, MOTHER_SPOT.z),
    hidden: new Uint8Array(count),
    treasures: [],
  };
  placeSecrets(island);
  return island;
}

/**
 * Starter supplies near the spawn: each kind is topped up to `want` within its ring (bushes
 * a little further out, off the bare crash site), counting berry bushes as bushes. Clear of
 * the wreck, the landmarks' spots, pools and the sea, a step apart, on its own random stream
 * so nothing else on the island moves.
 */
const KIT: { t: number; want: number; r0: number; r1: number }[] = [
  { t: NODE.branch, want: 8, r0: 5, r1: 24 },
  { t: NODE.pebble, want: 8, r0: 5, r1: 24 },
  { t: NODE.bush, want: 6, r0: 12, r1: 30 },
];

function starterKit(
  cands: { x: number; z: number; t: number }[],
  push: (x: number, z: number, t: number, v: number) => void,
  spawn: { x: number; z: number },
  w: {
    heights: Float32Array;
    colliders: Collider[];
    pois: PoiDef[];
    pools: Pool[];
    seed: number;
  },
): void {
  const random = rng(w.seed ^ 0x2468ace1);
  const near = cands.filter((c) => dist2(c.x, c.z, spawn.x, spawn.z) < 34 * 34);
  const spots: { x: number; z: number }[] = [];
  for (const poi of w.pois)
    for (const sp of poi.spots) spots.push({ x: poi.x + sp.dx, z: poi.z + sp.dz });
  for (const k of KIT) {
    let have = near.filter(
      (c) =>
        (c.t === k.t || (k.t === NODE.bush && c.t === NODE.berry)) &&
        dist2(c.x, c.z, spawn.x, spawn.z) < k.r1 * k.r1,
    ).length;
    for (let tries = 0; have < k.want && tries < 600; tries++) {
      const dx = (random() * 2 - 1) * k.r1;
      const dz = (random() * 2 - 1) * k.r1;
      const d2 = dx * dx + dz * dz;
      if (d2 < k.r0 * k.r0 || d2 > k.r1 * k.r1) continue;
      const x = spawn.x + dx;
      const z = spawn.z + dz;
      if (sampleHeights(w.heights, x, z) < 0.4) continue;
      if (hitColliderList(w.colliders, x, z, 1.5)) continue;
      if (spots.some((p) => dist2(p.x, p.z, x, z) < 3 * 3)) continue;
      if (w.pools.some((p) => dist2(p.x, p.z, x, z) < (p.r + 2) * (p.r + 2))) continue;
      if (near.some((c) => dist2(c.x, c.z, x, z) < 1.6 * 1.6)) continue;
      push(x, z, k.t, Math.floor(random() * 256));
      near.push({ x, z, t: k.t });
      have++;
    }
  }
}

/** Eight headings: (cos, sin) of k quarter-of-a-right-angle turns, exact on every engine. */
const HEADINGS: [number, number][] = [
  [1, 0],
  [Math.SQRT1_2, Math.SQRT1_2],
  [0, 1],
  [-Math.SQRT1_2, Math.SQRT1_2],
  [-1, 0],
  [-Math.SQRT1_2, -Math.SQRT1_2],
  [0, -1],
  [Math.SQRT1_2, -Math.SQRT1_2],
];

/**
 * Puts the secret sites (content/secrets.ts) and the treasure spots on a generated island.
 * Nothing about the island moves: the sites stand on the ground as it is, and the trees
 * and rocks under them are hidden. Integer hashes only, like the rest of generation.
 */
function placeSecrets(island: Island): void {
  const seed = island.seed;
  const taken: { x: number; z: number; r: number }[] = island.pois.map((p) => ({
    x: p.x,
    z: p.z,
    r: p.flat + 30,
  }));
  taken.push({ x: island.spawn.x, z: island.spawn.z, r: 120 });
  const free = (x: number, z: number, r: number) =>
    taken.every((t) => dist(t.x, t.z, x, z) > t.r + r) &&
    island.pools.every((p) => dist(p.x, p.z, x, z) > p.r + r + 4) &&
    island.snapjaws.every((sj) => dist(sj.x, sj.z, x, z) > r + 8);
  const pick = (salt: number, test: (x: number, z: number, k: number) => boolean) => {
    for (let k = 0; k < 4000; k++) {
      const x = (hash01(k, salt, seed + 901) - 0.5) * 820;
      const z = (hash01(k, salt, seed + 902) - 0.5) * 820;
      if (test(x, z, k)) return { x, z, k };
    }
    return null;
  };
  const h = (x: number, z: number) => heightAt(island, x, z);
  const b = (x: number, z: number) => biomeAt(island, x, z);
  const inland = (x: number, z: number) => {
    const v = b(x, z);
    return v === BIOME.meadow || v === BIOME.forest || v === BIOME.jungle || v === BIOME.highland;
  };

  let bunker: { x: number; z: number } | null = null;
  for (const def of SECRETS) {
    let at: { x: number; z: number; head: number } | null = null;
    if (def.place === 'bunker') {
      const got = pick(1, (x, z) => {
        if (!inland(x, z) || !free(x, z, 10)) return false;
        const c = h(x, z);
        if (c < 2.5 || c > 18) return false;
        let lo = c;
        let hi = c;
        for (const [dx, dz] of [
          [-6, -6],
          [6, -6],
          [-6, 6],
          [6, 6],
        ] as const) {
          const v = h(x + dx, z + dz);
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
        return hi - lo < 2.2;
      });
      if (got) {
        at = { x: got.x, z: got.z, head: Math.floor(hash01(got.k, 7, seed + 903) * 8) };
        bunker = at;
      }
    } else if (def.place === 'wreck') {
      let head = 0;
      const got = pick(2, (x, z) => {
        if (b(x, z) !== BIOME.beach || !free(x, z, 14)) return false;
        const c = h(x, z);
        if (c < 0.15 || c > 1.4) return false;
        // Lie along the shore: land on the +z side, the sea behind.
        const len = Math.sqrt(x * x + z * z) || 1;
        const lx = -x / len;
        const lz = -z / len;
        let best = -2;
        for (let k = 0; k < 8; k++) {
          const [cc, ss] = HEADINGS[k] as [number, number];
          const dot = -ss * lx + cc * lz;
          if (dot > best) {
            best = dot;
            head = k;
          }
        }
        const [cc, ss] = HEADINGS[head] as [number, number];
        const sea = h(x + ss * 14, z - cc * 14);
        const land = h(x - ss * 9, z + cc * 9);
        const bow = h(x + cc * 10, z + ss * 10);
        const stern = h(x - cc * 10, z - ss * 10);
        return sea < -0.4 && land > 0.3 && bow > -1.5 && bow < 2.5 && stern > -1.5 && stern < 2.5;
      });
      if (got) at = { x: got.x, z: got.z, head };
    } else if (def.place === 'marker' && def.corner && bunker) {
      const [sx, sz] = def.corner;
      const home = bunker;
      const got = pick(3 + SECRETS.indexOf(def), (x, z) => {
        const mx = Math.abs(x) * sx;
        const mz = Math.abs(z) * sz;
        if (Math.abs(x) < 50 || Math.abs(z) < 50) return false;
        if (!inland(mx, mz) || !free(mx, mz, 3) || dist(mx, mz, home.x, home.z) < 60) return false;
        const c = h(mx, mz);
        return c > 1.5 && c < 26;
      });
      if (got) at = { x: Math.abs(got.x) * sx, z: Math.abs(got.z) * sz, head: 0 };
    }
    if (!at) continue;
    addSite(island, def, at.x, at.z, at.head);
    taken.push({ x: at.x, z: at.z, r: def.flat + 30 });
  }

  for (let n = 0; n < TREASURES; n++) {
    const got = pick(20 + n, (x, z) => {
      const v = b(x, z);
      if (v !== BIOME.beach && v !== BIOME.meadow) return false;
      const c = h(x, z);
      if (c < 0.4 || c > 12 || !free(x, z, 3)) return false;
      if (hitColliderList(island.colliders, x, z, 2)) return false;
      return island.treasures.every((t) => dist(t.x, t.z, x, z) > 70);
    });
    if (!got) continue;
    island.treasures.push({ x: got.x, z: got.z });
    taken.push({ x: got.x, z: got.z, r: 4 });
    hideNodes(island, got.x, got.z, 1.6);
  }
}

function addSite(island: Island, def: SecretDef, x: number, z: number, head: number): void {
  const [c, s] = HEADINGS[head] as [number, number];
  const turn = (dx: number, dz: number) => ({ dx: dx * c - dz * s, dz: dx * s + dz * c });
  const rot = (head * Math.PI) / 4;
  const poi: PoiDef = {
    id: def.id,
    name: def.name,
    x,
    z,
    flat: def.flat,
    secret: true,
    rot,
    icon: def.icon,
    boxes: def.boxes.map((bx) => ({ ...bx, ...turn(bx.dx, bx.dz), rot })),
    spots: def.spots.map((sp) => ({ ...sp, ...turn(sp.dx, sp.dz) })),
  };
  island.pois.push(poi);
  island.poiById[poi.id] = poi;
  for (const bx of poi.boxes) {
    const col: Collider = {
      x: x + bx.dx,
      z: z + bx.dz,
      hw: bx.w / 2,
      hd: bx.d / 2,
      c,
      s,
      h: bx.h,
      poi: poi.id,
    };
    island.colliders.push(col);
    forNodesNear(island, col.x, col.z, bx.w / 2 + bx.d / 2 + 2, (id) => {
      const r = (NODES[island.nodeType[id] as number]?.radius ?? 0) + 0.8;
      if (hitColliderList([col], island.nodeX[id] as number, island.nodeZ[id] as number, r))
        island.hidden[id] = 1;
    });
  }
  for (const sp of poi.spots) hideNodes(island, x + sp.dx, z + sp.dz, 1.2);
}

function hideNodes(island: Island, x: number, z: number, r: number): void {
  forNodesNear(island, x, z, r + 1, (id) => {
    const nr = NODES[island.nodeType[id] as number]?.radius ?? 0;
    if (dist(island.nodeX[id] as number, island.nodeZ[id] as number, x, z) < r + nr)
      island.hidden[id] = 1;
  });
}

/** Node type for a scatter cell in this biome (-1 for none). */
function pickNode(b: number, r: number, tables: Record<number, [number, number][]>): number {
  const table = tables[b];
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

/** The scatter odds with a climate's plants more or less common. */
function climateTable(plants: Partial<Record<number, number>>): Record<number, [number, number][]> {
  const out: Record<number, [number, number][]> = {};
  for (const [b, rows] of Object.entries(NODE_TABLE)) {
    out[Number(b)] = rows.map(([t, p]) => [t, p * (plants[t] ?? 1)]);
  }
  return out;
}

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
