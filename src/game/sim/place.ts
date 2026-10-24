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
