// Repaints models whose colours live in their vertices (geo.ts): every face of a colour in the
// map takes the new colour, keeping the slight shade each face was given. Base styles and fire
// colours (game/paints.ts) are drawn this way, so no model needs its own painted copy.

import * as THREE from 'three';

interface Swap {
  from: THREE.Color;
  sum: number;
  to: THREE.Color;
}

const swaps = new Map<Record<number, number>, Swap[]>();

function swapsOf(map: Record<number, number>): Swap[] {
  let list = swaps.get(map);
  if (!list) {
    list = Object.entries(map).map(([from, to]) => {
      const a = new THREE.Color(Number(from));
      return { from: a, sum: a.r + a.g + a.b, to: new THREE.Color(to) };
    });
    swaps.set(map, list);
  }
  return list;
}

/**
 * A copy of `geo` with its vertex colours repainted (or `geo` itself when nothing in it is a
 * colour of the map).
 */
export function repaintGeometry(
  geo: THREE.BufferGeometry,
  map: Record<number, number>,
): THREE.BufferGeometry {
  const attr = geo.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!attr) return geo;
  const list = swapsOf(map);
  let out: THREE.BufferGeometry | null = null;
  let col: THREE.BufferAttribute | null = null;
  for (let i = 0; i < attr.count; i++) {
    const r = attr.getX(i);
    const g = attr.getY(i);
    const b = attr.getZ(i);
    for (const s of list) {
      // Each face is its colour times a shade near 1 (geo.ts jitter).
      const k = (r + g + b) / s.sum;
      if (k < 0.9 || k > 1.1) continue;
      const e = 0.006 * k;
      if (
        Math.abs(r - s.from.r * k) > e ||
        Math.abs(g - s.from.g * k) > e ||
        Math.abs(b - s.from.b * k) > e
      )
        continue;
      if (!out) {
        out = geo.clone();
        col = out.getAttribute('color') as THREE.BufferAttribute;
      }
      col?.setXYZ(i, s.to.r * k, s.to.g * k, s.to.b * k);
      break;
    }
  }
  return out ?? geo;
}

/** Repaints every mesh under `obj` (each gets its own copy of the geometry it changes). */
export function repaint(obj: THREE.Object3D, map: Record<number, number>): void {
  obj.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const geo = repaintGeometry(o.geometry as THREE.BufferGeometry, map);
    if (geo !== o.geometry) o.geometry = geo;
  });
}
