// Where buildings may go. Shared so the build preview on the phone agrees
// with the authority.

import { BUILDINGS } from '../content/buildings';
import { NODES } from '../content/nodes';
import { forNodesNear, heightAt, hitCollider, poolNear, type Island } from '../world';
import { boxesOverlap, circleHitsBox, footprint } from './types';

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
  if (!BUILDINGS[kind]) return 'Unknown building.';
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
  if (hi - lo > 1.8) return 'The ground is too steep.';
  for (const b of buildings) {
    if (boxesOverlap(box, footprint(b.kind, b.x, b.z, b.rot))) return 'Something is already there.';
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

/** Snaps a build position: walls to a 1 m grid so they line up, others to 0.5 m. */
export function snapPlacement(kind: string, x: number, z: number): { x: number; z: number } {
  const step = kind.startsWith('wall') || kind === 'door_wood' || kind === 'spikes' ? 1 : 0.5;
  return { x: Math.round(x / step) * step, z: Math.round(z / step) * step };
}
