// Models for things held in a hand and bags on the ground.

import * as THREE from 'three';
import { MAT, box, cone, cyl, ico, merge, sphere } from './geo';

const cache = new Map<string, THREE.BufferGeometry>();
const glowCache = new Map<string, THREE.BufferGeometry>();

function geoFor(id: string): {
  lit: THREE.BufferGeometry | null;
  glow: THREE.BufferGeometry | null;
} {
  if (cache.has(id) || glowCache.has(id))
    return { lit: cache.get(id) ?? null, glow: glowCache.get(id) ?? null };
  let lit: THREE.BufferGeometry[] = [];
  let glow: THREE.BufferGeometry[] = [];
  const handle = (len: number, color = 0x7a5232) =>
    cyl(0.035, 0.04, len, 5, color, { y: -len / 2 + 0.1 });
  switch (id) {
    case 'axe_stone':
    case 'axe_scrap':
      lit = [
        handle(0.75),
        box(0.08, 0.22, 0.28, id === 'axe_scrap' ? 0xb0b6bd : 0x8a8c90, { y: -0.5, z: 0.12 }),
      ];
      break;
    case 'pick_stone':
    case 'pick_scrap':
      lit = [
        handle(0.75),
        box(0.06, 0.08, 0.55, id === 'pick_scrap' ? 0xb0b6bd : 0x8a8c90, { y: -0.52, z: 0.05 }),
      ];
      break;
    case 'machete':
      lit = [handle(0.2, 0x2a2420), box(0.03, 0.7, 0.1, 0xd7dadf, { y: -0.45, z: 0.03 })];
      break;
    case 'club':
      lit = [cyl(0.05, 0.11, 0.8, 6, 0x6b4a2a, { y: -0.35 })];
      break;
    case 'spear':
      lit = [
        cyl(0.03, 0.03, 1.8, 5, 0x7a5232, { y: -0.3, rx: 0 }),
        cone(0.06, 0.25, 4, 0x8a8c90, { y: -1.3, rx: Math.PI }),
      ];
      break;
    case 'torch':
      lit = [handle(0.55)];
      glow = [cone(0.09, 0.3, 5, 0xffa53a, { y: 0.28 }), cone(0.05, 0.2, 5, 0xffe07a, { y: 0.3 })];
      break;
    case 'firebomb':
      lit = [
        cyl(0.06, 0.08, 0.2, 6, 0x4a7a3a, { y: -0.1 }),
        box(0.04, 0.1, 0.04, 0xe8d8b0, { y: 0.05 }),
      ];
      glow = [sphere(0.04, 4, 3, 0xd6ff6a, { y: -0.1, z: 0.07 })];
      break;
    case 'jawblade':
      lit = [
        handle(0.2, 0x3f8a35),
        box(0.04, 0.72, 0.12, 0xc9d0d8, { y: -0.46, z: 0.03 }),
        ...[0, 1, 2, 3].map((k) =>
          cone(0.03, 0.1, 3, 0xf2efe0, { y: -0.25 - k * 0.15, z: 0.1, rx: Math.PI / 2 }),
        ),
      ];
      break;
    case 'thornmaul':
      lit = [
        handle(0.8),
        box(0.28, 0.24, 0.36, 0x5a6a3a, { y: -0.75 }),
        ...[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) =>
            cone(0.04, 0.16, 4, 0xd8c8a0, { x: sx * 0.15, y: -0.75, z: sz * 0.19, rz: sx * 1.2 }),
          ),
        ),
      ];
      break;
    case 'spore_bomb':
      lit = [
        sphere(0.11, 6, 5, 0x9a6ac8, { y: -0.1 }),
        box(0.04, 0.08, 0.04, 0xe8d8b0, { y: 0.03 }),
      ];
      glow = [sphere(0.03, 4, 3, 0xd6ff6a, { y: -0.08, z: 0.1 })];
      break;
    case 'bloom_tonic':
      lit = [
        cyl(0.05, 0.08, 0.18, 6, 0xff7ab8, { y: -0.1 }),
        box(0.04, 0.05, 0.04, 0x8a5f3a, { y: 0.02 }),
      ];
      break;
    case 'petal_mask':
      lit = [
        cone(0.2, 0.36, 7, 0xe85fa8, { y: 0.02, rx: Math.PI }),
        box(0.06, 0.03, 0.02, 0x1b1a2b, { x: -0.06, y: 0.08, z: 0.1 }),
        box(0.06, 0.03, 0.02, 0x1b1a2b, { x: 0.06, y: 0.08, z: 0.1 }),
      ];
      break;
    case 'radio':
      lit = [
        box(0.22, 0.3, 0.1, 0x3a3a3a, { y: -0.15 }),
        cyl(0.01, 0.01, 0.3, 3, 0xaaaaaa, { x: 0.08, y: 0.1 }),
      ];
      break;
    default:
      return { lit: null, glow: null };
  }
  const l = lit.length ? merge(lit) : null;
  const g = glow.length ? merge(glow) : null;
  if (l) cache.set(id, l);
  if (g) glowCache.set(id, g);
  return { lit: l, glow: g };
}

/** The model a character holds for an item (null for things not drawn in hand). */
export function heldModel(id: string): THREE.Object3D | null {
  const { lit, glow } = geoFor(id);
  if (!lit && !glow) return null;
  const g = new THREE.Group();
  if (lit) g.add(new THREE.Mesh(lit, MAT.lit));
  if (glow) g.add(new THREE.Mesh(glow, MAT.glow));
  // Point the tool forward from the fist.
  g.rotation.x = -Math.PI / 2;
  g.position.z = 0.05;
  return g;
}

let bagGeo: THREE.BufferGeometry | null = null;

export function bagModel(): THREE.Mesh {
  bagGeo ??= merge([
    ico(0.32, 0, 0x8a6a3a, { y: 0.28, sy: 0.9 }),
    cyl(0.12, 0.16, 0.12, 6, 0x6b4f2a, { y: 0.58 }),
    box(0.5, 0.05, 0.06, 0x5a3c22, { y: 0.35, rz: 0.6 }),
  ]);
  return new THREE.Mesh(bagGeo, MAT.lit);
}

let crateGeo: THREE.BufferGeometry | null = null;

/** A crate from MX207's hold, washed up and half sunk in the sand. */
export function crateModel(): THREE.Object3D {
  crateGeo ??= merge([
    box(1.05, 0.8, 0.8, 0x9a7444, { y: 0.32, rz: 0.08 }),
    box(1.1, 0.12, 0.84, 0x6f5130, { y: 0.66, rz: 0.08 }),
    box(1.1, 0.12, 0.84, 0x6f5130, { y: 0.02, rz: 0.08 }),
    box(0.1, 0.84, 0.86, 0x6f5130, { x: -0.48, y: 0.32, rz: 0.08 }),
    box(0.1, 0.84, 0.86, 0x6f5130, { x: 0.48, y: 0.32, rz: 0.08 }),
    box(0.5, 0.18, 0.02, 0xd0453b, { y: 0.4, z: 0.41, rz: 0.08 }),
    cyl(0.03, 0.03, 1.3, 4, 0x2f6a3a, { x: 0.2, y: 0.05, z: 0.5, rz: 1.4, ry: 0.4 }),
    cyl(0.03, 0.03, 0.9, 4, 0x3a7a42, { x: -0.5, y: 0.05, z: -0.4, rz: 1.5, ry: -0.8 }),
  ]);
  const m = new THREE.Mesh(crateGeo, MAT.lit);
  m.rotation.y = 0.5;
  return m;
}

let podGeo: THREE.BufferGeometry | null = null;
let podGlowGeo: THREE.BufferGeometry | null = null;

/** A Verdance supply pod: white shell, green lights, still smoking. */
export function podModel(): { group: THREE.Group; light: THREE.Object3D } {
  podGeo ??= merge([
    cyl(0.55, 0.62, 1.5, 8, 0xe8ecef, { y: 0.75 }),
    cone(0.55, 0.6, 8, 0xd0d6da, { y: 1.8 }),
    cyl(0.64, 0.64, 0.14, 8, 0x3a4048, { y: 0.1 }),
    box(0.08, 0.6, 0.5, 0x3a4048, { x: 0.62, y: 0.35 }),
    box(0.08, 0.6, 0.5, 0x3a4048, { x: -0.62, y: 0.35 }),
    box(0.5, 0.6, 0.08, 0x3a4048, { z: 0.62, y: 0.35 }),
    box(0.5, 0.6, 0.08, 0x3a4048, { z: -0.62, y: 0.35 }),
    box(0.62, 0.22, 0.04, 0x2a9a5a, { y: 1.05, z: 0.58 }),
  ]);
  podGlowGeo ??= merge([
    cyl(0.6, 0.6, 0.06, 8, 0x7aff9a, { y: 0.55 }),
    sphere(0.08, 6, 4, 0x9aff7a, { y: 2.12 }),
  ]);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(podGeo, MAT.lit));
  const light = new THREE.Mesh(podGlowGeo, MAT.glow);
  group.add(light);
  group.rotation.z = 0.12;
  return { group, light };
}
