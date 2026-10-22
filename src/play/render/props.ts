// Low-poly models for harvestable nodes, drawn as one InstancedMesh per type.

import * as THREE from 'three';
import { NODE } from '../../game/content/nodes';
import { box, cone, cyl, dodeca, ico, merge, sphere, torus } from './geo';

export const C = {
  trunk: 0x7a5232,
  trunkDark: 0x5b3a22,
  palm: 0x5fae3c,
  jungle: 0x2f7d3a,
  jungle2: 0x3f9447,
  pine: 0x2c5e3f,
  pine2: 0x3a6f4a,
  bush: 0x4a9a3c,
  rock: 0x8a8c90,
  rockDark: 0x6e7075,
  metal: 0xb0b6bd,
  metalDark: 0x6d737a,
  vine: 0x2c4f2a,
  vineDark: 0x1f3a24,
  bloom: 0xe85fa8,
  glow: 0xd6ff6a,
};

function palm(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < 6; i++) {
    const lean = 0.06 * i;
    parts.push(
      cyl(0.2 - i * 0.015, 0.24 - i * 0.015, 1.1, 6, i % 2 ? C.trunk : C.trunkDark, {
        x,
        y: y + 0.55,
        rz: -lean,
      }),
    );
    x += Math.sin(lean) * 1.05;
    y += Math.cos(lean) * 1.0;
  }
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    parts.push(
      box(0.5, 0.06, 2.4, k % 2 ? C.palm : 0x6cbd45, {
        x: x + Math.sin(a) * 1.0,
        y: y - 0.25,
        z: Math.cos(a) * 1.0,
        ry: a,
        rx: 0.45,
      }),
    );
  }
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    parts.push(
      sphere(0.17, 5, 4, 0x6b4a2a, {
        x: x + Math.sin(a) * 0.25,
        y: y - 0.35,
        z: Math.cos(a) * 0.25,
      }),
    );
  }
  return merge(parts);
}

function jungleTree(): THREE.BufferGeometry {
  return merge([
    cyl(0.3, 0.45, 4, 7, C.trunkDark, { y: 2 }),
    box(0.25, 0.5, 1.1, C.trunkDark, { x: 0.45, y: 0.2, ry: 0.4, rz: 0.4 }),
    box(0.25, 0.5, 1.1, C.trunkDark, { x: -0.4, y: 0.2, z: 0.2, ry: -0.8, rz: -0.4 }),
    ico(2.1, 0, C.jungle, { y: 4.6, sy: 0.65 }),
    ico(1.6, 0, C.jungle2, { x: 1.2, y: 4.2, z: 0.6, sy: 0.7 }),
    ico(1.5, 0, 0x2a6d33, { x: -1.1, y: 4.4, z: -0.5, sy: 0.7 }),
  ]);
}

function pine(): THREE.BufferGeometry {
  return merge([
    cyl(0.18, 0.26, 1.4, 6, C.trunk, { y: 0.7 }),
    cone(1.7, 2.4, 7, C.pine, { y: 2.4 }),
    cone(1.35, 2.1, 7, C.pine2, { y: 3.6 }),
    cone(0.95, 1.8, 7, C.pine, { y: 4.7 }),
  ]);
}

function bush(berries: number | null): THREE.BufferGeometry {
  const parts = [
    ico(0.7, 0, C.bush, { y: 0.5, sy: 0.75 }),
    ico(0.5, 0, 0x5aad48, { x: 0.45, y: 0.4, z: 0.2, sy: 0.75 }),
    ico(0.45, 0, 0x3f8a35, { x: -0.4, y: 0.35, z: -0.2, sy: 0.8 }),
  ];
  if (berries !== null) {
    const spots = [
      [0.3, 0.85, 0.35],
      [-0.35, 0.7, 0.3],
      [0.55, 0.55, -0.2],
      [-0.1, 0.9, -0.4],
      [0.1, 0.5, 0.6],
      [-0.6, 0.5, -0.1],
    ];
    for (const [x, y, z] of spots) parts.push(sphere(0.09, 4, 3, berries, { x, y, z }));
  }
  return merge(parts);
}

function rock(): THREE.BufferGeometry {
  return merge([
    dodeca(0.9, C.rock, { y: 0.4, sx: 1.3, sy: 0.8, sz: 1.1 }),
    dodeca(0.5, C.rockDark, { x: 0.7, y: 0.2, z: 0.4, sy: 0.7 }),
  ]);
}

function pebble(): THREE.BufferGeometry {
  return merge([
    dodeca(0.22, C.rock, { y: 0.1, sx: 1.3, sy: 0.6 }),
    dodeca(0.13, C.rockDark, { x: 0.25, y: 0.06, z: 0.1 }),
  ]);
}

function branch(): THREE.BufferGeometry {
  return merge([
    cyl(0.07, 0.09, 1.6, 5, C.trunk, { y: 0.08, rz: Math.PI / 2 }),
    cyl(0.04, 0.05, 0.6, 4, C.trunk, { x: 0.3, y: 0.12, z: 0.2, rz: Math.PI / 2, ry: -0.7 }),
    box(0.25, 0.04, 0.12, C.bush, { x: -0.6, y: 0.12, z: 0.05 }),
  ]);
}

function wreckage(): THREE.BufferGeometry {
  return merge([
    box(1.4, 0.08, 0.9, C.metal, { y: 0.3, rx: 0.3, rz: 0.2 }),
    box(0.9, 0.08, 1.1, C.metalDark, { x: 0.4, y: 0.2, z: 0.3, rx: -0.2, ry: 0.6 }),
    cyl(0.12, 0.12, 1.4, 6, C.metalDark, { x: -0.3, y: 0.25, z: -0.3, rz: 1.2 }),
    box(0.5, 0.35, 0.4, 0xd7dadf, { x: -0.5, y: 0.18, z: 0.4, ry: 0.5 }),
  ]);
}

function mushroom(): THREE.BufferGeometry {
  return merge([
    cyl(0.07, 0.09, 0.35, 5, 0xeee3cf, { y: 0.17 }),
    sphere(0.22, 6, 3, 0xc8553d, { y: 0.36, sy: 0.6 }),
    cyl(0.05, 0.06, 0.25, 5, 0xeee3cf, { x: 0.22, y: 0.12, z: 0.1 }),
    sphere(0.14, 6, 3, 0xd4734f, { x: 0.22, y: 0.26, z: 0.1, sy: 0.6 }),
  ]);
}

function luggage(): THREE.BufferGeometry {
  return merge([
    box(0.9, 0.28, 0.6, 0xffffff, { y: 0.15, ry: 0.3 }, 0.04),
    box(0.3, 0.06, 0.06, 0x333333, { y: 0.32, ry: 0.3 }),
    box(0.92, 0.04, 0.05, 0x444444, { y: 0.15, ry: 0.3 }),
  ]);
}

function vines(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const r = 0.5 + (k % 3) * 0.25;
    parts.push(
      cyl(0.08, 0.16, 2.6, 5, k % 2 ? C.vine : C.vineDark, {
        x: Math.sin(a) * r,
        y: 1.0,
        z: Math.cos(a) * r,
        rx: Math.cos(a) * 0.5,
        rz: -Math.sin(a) * 0.5,
      }),
    );
  }
  parts.push(torus(0.9, 0.1, C.vineDark, { y: 1.2, rx: Math.PI / 2 }));
  parts.push(torus(0.6, 0.08, C.vine, { y: 2.0, rx: Math.PI / 2.4 }));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.3;
    parts.push(
      cone(0.22, 0.3, 5, C.bloom, {
        x: Math.sin(a) * 0.8,
        y: 1.6 + k * 0.2,
        z: Math.cos(a) * 0.8,
        rx: Math.PI,
      }),
    );
    parts.push(
      sphere(0.07, 4, 3, C.glow, { x: Math.sin(a) * 0.8, y: 1.45 + k * 0.2, z: Math.cos(a) * 0.8 }),
    );
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    parts.push(
      cone(0.06, 0.35, 4, 0x6b2a3a, {
        x: Math.sin(a) * 1.0,
        y: 1.0 + (k % 2) * 0.6,
        z: Math.cos(a) * 1.0,
        rz: Math.sin(a) * 1.4,
        rx: -Math.cos(a) * 1.4,
      }),
    );
  }
  return merge(parts);
}

/** Geometry per node type (index = NODE id). */
export function nodeGeometries(): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = [];
  geos[NODE.palm] = palm();
  geos[NODE.jungle] = jungleTree();
  geos[NODE.pine] = pine();
  geos[NODE.bush] = bush(null);
  geos[NODE.berry] = bush(0xd8304a);
  geos[NODE.rock] = rock();
  geos[NODE.pebble] = pebble();
  geos[NODE.branch] = branch();
  geos[NODE.scrap] = wreckage();
  geos[NODE.mushroom] = mushroom();
  geos[NODE.luggage] = luggage();
  geos[NODE.vines] = vines();
  return geos;
}

/** Per-instance colour tint for variety (suitcases get bright colours). */
export function nodeTint(type: number, v: number, out: THREE.Color): THREE.Color {
  if (type === NODE.luggage) {
    const colors = [0xd0453b, 0x2f6fb5, 0x3a3a3a, 0xe0b02f, 0x5aa36b, 0x8e5bb0];
    return out.setHex(colors[v % colors.length] as number);
  }
  const k = 0.88 + (v / 255) * 0.24;
  return out.setRGB(k, k, k);
}

/** Size variety per node. */
export function nodeScale(type: number, v: number): number {
  if (type === NODE.luggage || type === NODE.scrap || type === NODE.vines) return 1;
  if (type <= NODE.pine) return 0.85 + (v / 255) * 0.4;
  return 0.8 + (v / 255) * 0.4;
}
