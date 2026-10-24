// Where buildings may go. Shared so the build preview on the phone agrees
// with the authority.

import { BUILDINGS } from '../content/buildings';
import { NODES } from '../content/nodes';
import { forNodesNear, heightAt, hitCollider, poolNear, type Island } from '../world';
import { boxesOverlap, circleHitsBox, footprint, type Aabb } from './types';

export interface PlacedLike {
  kind: string;
  x: number;
  z: number;
  rot: number;
}

/** How far from you build mode puts pieces down and takes them down (the authority's limit). */
export const BUILD_REACH = 24;
/** The build cursor stays this close (a little inside the authority's limit). */
export const BUILD_RANGE = 22;

/** Monsters and animals never appear this close to anything you built (BASE_CLEAR m). */
export const BASE_CLEAR = 10;

/** Why a building can't go here, or null if it can. */
export function placementProblem(
  island: Island,
  buildings: Iterable<PlacedLike>,
  nodeGone: (id: number) => boolean,
  kind: string,
  x: number,
  z: number,
  rot: number,
): string | null {
  const def = BUILDINGS[kind];
  if (!def) return 'Unknown building.';
  const box = footprint(kind, x, z, rot);
  const corners: [number, number][] = [
    [box.minX, box.minZ],
    [box.maxX, box.minZ],
    [box.minX, box.maxZ],
    [box.maxX, box.maxZ],
    [x, z],
  ];
  let lo = Infinity;
  let hi = -Infinity;
  for (const [cx, cz] of corners) {
    const h = heightAt(island, cx, cz);
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
  }
  if (lo < 0.2) return 'Too close to the water.';
  if (hi - lo > (def.layer === 'floor' ? 1.2 : 1.8)) return 'The ground is too steep.';
  // Floors lie under things and roofs over them: pieces only meet their own layer.
  for (const b of buildings) {
    if (BUILDINGS[b.kind]?.layer !== def.layer) continue;
    const other = footprint(b.kind, b.x, b.z, b.rot);
    if (boxesOverlap(box, other) && !joins(kind, b.kind, box, other))
      return 'Something is already there.';
  }
  for (const [cx, cz] of corners) {
    if (hitCollider(island, cx, cz, 0.2)) return 'Wreckage is in the way.';
  }
  let blocked = false;
  forNodesNear(island, x, z, 4, (id) => {
    if (blocked || nodeGone(id)) return;
    const r = NODES[island.nodeType[id] as number]?.radius ?? 0;
    if (r > 0 && circleHitsBox(island.nodeX[id] as number, island.nodeZ[id] as number, r, box))
      blocked = true;
  });
  if (blocked) return 'A tree or rock is in the way.';
  if (poolNear(island, x, z, 1.5)) return 'Too close to the pool.';
  return null;
}

/** Wall pieces and posts may meet: they overlap only where they join, not along their length. */
const JOINT = 0.62;

function joins(a: string, b: string, boxA: Aabb, boxB: Aabb): boolean {
  if (!BUILDINGS[a]?.shape || !BUILDINGS[b]?.shape) return false;
  const w = Math.min(boxA.maxX, boxB.maxX) - Math.max(boxA.minX, boxB.minX);
  const d = Math.min(boxA.maxZ, boxB.maxZ) - Math.max(boxA.minZ, boxB.minZ);
  return w <= JOINT && d <= JOINT;
}

/** Snaps a build position: walls to a 1 m grid so they line up, others to 0.5 m. */
export function snapPlacement(kind: string, x: number, z: number): { x: number; z: number } {
  const step = BUILDINGS[kind]?.shape === 'edge' ? 1 : 0.5;
  return { x: Math.round(x / step) * step, z: Math.round(z / step) * step };
}

/**
 * Snaps a piece to the build grid (cells `grid` metres across): walls and doors run along
 * grid lines with their ends on grid points, posts sit on grid points, everything else fills
 * a cell. Rotations are quarter turns.
 */
export function snapToGrid(
  kind: string,
  x: number,
  z: number,
  rot: number,
  grid: number,
): { x: number; z: number } {
  const def = BUILDINGS[kind];
  if (!def) return { x, z };
  const along = (v: number, len: number) => {
    const step = Math.min(grid, len);
    return Math.round((v - len / 2) / step) * step + len / 2;
  };
  // (+ 0 turns -0 into 0.)
  const line = (v: number) => Math.round(v / grid) * grid + 0;
  if (def.shape === 'corner') return { x: line(x), z: line(z) };
  if (def.shape === 'edge') {
    // Quarter turns 1 and 3 run the piece along z.
    return rot & 1 ? { x: line(x), z: along(z, def.w) } : { x: along(x, def.w), z: line(z) };
  }
  const w = rot & 1 ? def.d : def.w;
  const d = rot & 1 ? def.w : def.d;
  // Small things snap to half cells; bigger ones line their edges up with the grid.
  const fine = grid / 2;
  const cell = (v: number, len: number) => Math.round((v - len / 2) / fine) * fine + len / 2;
  return { x: cell(x, Math.ceil(w / fine) * fine), z: cell(z, Math.ceil(d / fine) * fine) };
}

/** Pieces push out of a neighbour they overlap by at most this much (a wall's half thickness+). */
const MAX_PUSH = 0.6;
/** Gaps smaller than this close up: the piece snaps flush against its neighbour. */
const MAGNET = 0.45;
/** Edges this close line up along the side you touch. */
const ALIGN = 0.3;

/**
 * Snaps a piece flush against what's around it in its layer: out of a wall it overlaps a
 * little, up against a bench it almost touches, its front lined up with the bench's. Walls,
 * doors and posts keep to the grid (`shape` pieces aren't moved).
 */
export function snapFlush(
  kind: string,
  x: number,
  z: number,
  rot: number,
  buildings: Iterable<PlacedLike>,
): { x: number; z: number } {
  const def = BUILDINGS[kind];
  if (!def || def.shape) return { x, z };
  const near: Aabb[] = [];
  for (const b of buildings) {
    if (BUILDINGS[b.kind]?.layer !== def.layer) continue;
    if (Math.abs(b.x - x) > 6 || Math.abs(b.z - z) > 6) continue;
    near.push(footprint(b.kind, b.x, b.z, b.rot));
  }
  if (!near.length) return { x, z };
  let px = x;
  let pz = z;
  // Out of shallow overlaps (a bench snapped onto a wall's grid line).
  for (let pass = 0; pass < 4; pass++) {
    const box = footprint(kind, px, pz, rot);
    let moved = false;
    for (const o of near) {
      const ox = Math.min(box.maxX, o.maxX) - Math.max(box.minX, o.minX);
      const oz = Math.min(box.maxZ, o.maxZ) - Math.max(box.minZ, o.minZ);
      if (ox <= 0.001 || oz <= 0.001 || Math.min(ox, oz) > MAX_PUSH) continue;
      if (ox < oz) px += px < (o.minX + o.maxX) / 2 ? -ox : ox;
      else pz += pz < (o.minZ + o.maxZ) / 2 ? -oz : oz;
      moved = true;
      break;
    }
    if (!moved) break;
  }
  // Close small gaps, then line up with what you touch.
  const box = footprint(kind, px, pz, rot);
  let gx = MAGNET;
  let sx = 0;
  let tx: Aabb | null = null;
  let gz = MAGNET;
  let sz = 0;
  let tz: Aabb | null = null;
  for (const o of near) {
    const spanZ = Math.min(box.maxZ, o.maxZ) - Math.max(box.minZ, o.minZ);
    const spanX = Math.min(box.maxX, o.maxX) - Math.max(box.minX, o.minX);
    if (spanZ > 0.1) {
      const right = o.minX - box.maxX;
      const left = box.minX - o.maxX;
      if (right >= -0.001 && right < gx) [gx, sx, tx] = [right, right, o];
      if (left >= -0.001 && left < gx) [gx, sx, tx] = [left, -left, o];
    }
    if (spanX > 0.1) {
      const down = o.minZ - box.maxZ;
      const up = box.minZ - o.maxZ;
      if (down >= -0.001 && down < gz) [gz, sz, tz] = [down, down, o];
      if (up >= -0.001 && up < gz) [gz, sz, tz] = [up, -up, o];
    }
  }
  px += sx;
  pz += sz;
  // Side by side: fronts (or backs) in a line.
  const after = footprint(kind, px, pz, rot);
  if (tx && !tz) {
    const dMin = tx.minZ - after.minZ;
    const dMax = tx.maxZ - after.maxZ;
    const d = Math.abs(dMin) <= Math.abs(dMax) ? dMin : dMax;
    if (Math.abs(d) < ALIGN) pz += d;
  } else if (tz && !tx) {
    const dMin = tz.minX - after.minX;
    const dMax = tz.maxX - after.maxX;
    const d = Math.abs(dMin) <= Math.abs(dMax) ? dMin : dMax;
    if (Math.abs(d) < ALIGN) px += d;
  }
  return { x: Math.round(px * 1000) / 1000, z: Math.round(pz * 1000) / 1000 };
}
