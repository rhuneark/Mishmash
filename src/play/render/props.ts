// Low-poly models for harvestable nodes, drawn as one InstancedMesh per type.

import * as THREE from 'three';
import { NODE } from '../../game/content/nodes';
import { box, cone, cyl, dodeca, ico, merge, sphere, torus, triangles } from './geo';
import type { PlantColors } from './climate';

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

/** The palette the builders below paint with (a climate's colours while they run). */
let P = C;

/** A colour times `k` (darker below 1). */
function shade(hex: number, k: number): number {
  const c = new THREE.Color(hex).multiplyScalar(k);
  return c.getHex();
}

/** Between two colours. */
function mix(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}

type V3 = [number, number, number];

/**
 * One palm frond: a spine that rises from the crown and arches down, with a row of
 * swept-forward leaflets on each side that droop like a V (a zigzag edge from above).
 */
function frond(
  o: V3,
  yaw: number,
  len: number,
  up: number,
  down: number,
  width: number,
  base: number,
  tip: number,
): THREE.BufferGeometry {
  const N = 8;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const sx = Math.cos(yaw);
  const sz = -Math.sin(yaw);
  const spine: V3[] = [o];
  let [x, y, z] = o;
  for (let i = 1; i <= N; i++) {
    const t = (i - 0.5) / N;
    const pitch = up - (up - down) * Math.pow(t, 1.3);
    const step = len / N;
    x += fx * Math.cos(pitch) * step;
    z += fz * Math.cos(pitch) * step;
    y += Math.sin(pitch) * step;
    spine.push([x, y, z]);
  }
  const pos: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = spine[i] as V3;
    const b = spine[i + 1] as V3;
    const t = (i + 0.5) / N;
    // Narrow at the stalk and the tip, widest a third of the way out.
    const w = width * (i === 0 ? 0.25 : Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.9 + 0.12);
    const color = mix(base, tip, t);
    for (const side of [-1, 1]) {
      // The leaflet's tip sits ahead of the segment, out to the side and a little down.
      const e: V3 = [
        b[0] + (b[0] - a[0]) * 0.45 + sx * side * w,
        b[1] + (b[1] - a[1]) * 0.45 - w * 0.5,
        b[2] + (b[2] - a[2]) * 0.45 + sz * side * w,
      ];
      if (side > 0) pos.push(...a, ...b, ...e);
      else pos.push(...a, ...e, ...b);
      cols.push(color);
    }
  }
  return triangles(pos, cols, true);
}

/**
 * A coconut palm: a ringed trunk curving up out of the sand, a crown of long fronds that
 * arch and droop, a few young ones standing up, a dead one hanging, coconuts under it.
 */
function palm(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const SEG = 7;
  const H = 6.4;
  const BEND = 1.4;
  const pts: [number, number][] = [];
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    pts.push([BEND * t * t, H * t]);
  }
  // Palm bark is grey-tan, lighter than other trunks.
  const bark = mix(P.trunk, 0xc2ab80, 0.45);
  parts.push(cyl(0.3, 0.46, 0.45, 8, shade(bark, 0.8), { y: 0.22 }));
  for (let i = 0; i < SEG; i++) {
    const [ax, ay] = pts[i] as [number, number];
    const [bx, by] = pts[i + 1] as [number, number];
    const len = Math.hypot(bx - ax, by - ay);
    const r = 0.29 - i * 0.018;
    // Each piece is wider at its foot than the last one's top: the trunk's rings.
    parts.push(
      cyl(r - 0.035, r + 0.035, len + 0.02, 7, i % 2 ? bark : shade(bark, 0.84), {
        x: (ax + bx) / 2,
        y: (ay + by) / 2,
        rz: -Math.atan2(bx - ax, by - ay),
      }),
    );
  }
  const [tx, ty] = pts[SEG] as [number, number];
  const top: V3 = [tx, ty, 0];
  parts.push(ico(0.36, 0, shade(P.palm, 0.55), { x: tx, y: ty + 0.05, sy: 1.2 }));
  const green = P.palm;
  const dark = shade(P.palm, 0.62);
  const light = mix(P.palm, 0xe8f080, 0.3);
  for (let k = 0; k < 10; k++) {
    const yaw = (k / 10) * Math.PI * 2 + (k % 2 ? 0.17 : -0.1);
    const len = 3.6 + (k % 3) * 0.35;
    parts.push(frond(top, yaw, len, 0.55, -1.1 - (k % 2) * 0.2, 0.8, dark, green));
  }
  for (let k = 0; k < 3; k++) {
    const yaw = (k / 3) * Math.PI * 2 + 0.6;
    parts.push(frond([tx, ty + 0.1, 0], yaw, 1.9, 1.2, 0.25, 0.42, green, light));
  }
  parts.push(frond([tx, ty - 0.1, 0], 2.4, 2.1, -0.7, -1.45, 0.4, 0x6f5a34, 0x9a7b45));
  const nuts: [number, number][] = [
    [0.24, 0.1],
    [-0.2, 0.22],
    [0.05, -0.27],
    [-0.26, -0.12],
    [0.2, -0.16],
  ];
  nuts.forEach(([dx, dz], i) =>
    parts.push(
      sphere(0.22, 6, 5, i % 3 ? 0x5e4422 : 0x6e7d2c, {
        x: tx + dx,
        y: ty - 0.32 - (i % 2) * 0.12,
        z: dz,
      }),
    ),
  );
  return merge(parts);
}

/** A rainforest giant: buttress roots, a stout trunk, a broad layered canopy, hanging vines. */
function jungleTree(): THREE.BufferGeometry {
  const bark = mix(P.trunkDark, 0x9a8a6a, 0.3);
  const parts: THREE.BufferGeometry[] = [
    cyl(0.3, 0.46, 4.6, 7, bark, { y: 2.3 }),
    cyl(0.12, 0.2, 2.2, 5, bark, { x: 0.8, y: 4.0, rz: -0.75 }),
    cyl(0.1, 0.18, 2.0, 5, bark, { x: -0.7, y: 4.1, z: -0.3, rz: 0.7, ry: 0.4 }),
  ];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    parts.push(
      box(0.14, 1.1, 1.0, shade(bark, 0.85), {
        x: Math.sin(a) * 0.45,
        y: 0.4,
        z: Math.cos(a) * 0.45,
        ry: a,
        rx: 0.55,
      }),
    );
  }
  const deep = shade(P.jungle, 0.78);
  const leaves: [number, number, number, number, number][] = [
    [2.3, 0, 5.2, 0, P.jungle],
    [1.8, 1.6, 4.6, 0.6, P.jungle2],
    [1.7, -1.5, 4.8, -0.7, deep],
    [1.5, 0.3, 6.0, -0.9, P.jungle2],
    [1.4, -0.5, 4.4, 1.5, P.jungle],
    [1.2, 1.1, 5.6, 1.1, deep],
  ];
  for (const [r, x, y, z, color] of leaves) parts.push(ico(r, 0, color, { x, y, z, sy: 0.62 }));
  const hang: [number, number, number][] = [
    [1.3, 3.6, 1.1],
    [-1.4, 3.7, -0.6],
    [0.6, 3.5, -1.5],
    [-0.4, 3.4, 1.6],
  ];
  for (const [x, y, z] of hang) parts.push(cyl(0.03, 0.04, 1.6, 4, P.vine, { x, y, z }));
  return merge(parts);
}

function pine(): THREE.BufferGeometry {
  return merge([
    cyl(0.15, 0.28, 2.0, 6, P.trunk, { y: 1.0 }),
    cone(1.95, 1.9, 8, shade(P.pine, 0.85), { y: 2.2 }),
    cone(1.65, 1.8, 8, P.pine2, { y: 3.1, ry: 0.4 }),
    cone(1.32, 1.7, 8, P.pine, { y: 4.0, ry: 0.8 }),
    cone(0.98, 1.55, 7, P.pine2, { y: 4.85, ry: 0.2 }),
    cone(0.58, 1.3, 6, P.pine, { y: 5.6, ry: 0.5 }),
  ]);
}

function bush(berries: number | null): THREE.BufferGeometry {
  const parts = [
    ico(0.72, 0, P.bush, { y: 0.52, sy: 0.75 }),
    ico(0.55, 0, mix(P.bush, 0xc8e070, 0.18), { x: 0.48, y: 0.42, z: 0.22, sy: 0.75 }),
    ico(0.5, 0, shade(P.bush, 0.8), { x: -0.45, y: 0.36, z: -0.2, sy: 0.8 }),
    ico(0.45, 0, P.bush, { x: -0.15, y: 0.34, z: 0.5, sy: 0.75 }),
    ico(0.42, 0, mix(P.bush, 0xc8e070, 0.25), { x: 0.2, y: 0.82, z: -0.15, sy: 0.7 }),
  ];
  if (berries !== null) {
    const spots = [
      [0.3, 0.9, 0.35],
      [-0.35, 0.72, 0.32],
      [0.6, 0.58, -0.2],
      [-0.1, 0.95, -0.42],
      [0.12, 0.55, 0.68],
      [-0.65, 0.5, -0.1],
      [0.45, 0.8, 0.1],
    ];
    for (const [x, y, z] of spots) parts.push(sphere(0.1, 4, 3, berries, { x, y, z }));
  }
  return merge(parts);
}

function rock(): THREE.BufferGeometry {
  return merge([
    dodeca(0.9, P.rock, { y: 0.4, sx: 1.3, sy: 0.8, sz: 1.1 }),
    dodeca(0.5, P.rockDark, { x: 0.7, y: 0.2, z: 0.4, sy: 0.7 }),
  ]);
}

function pebble(): THREE.BufferGeometry {
  return merge([
    dodeca(0.22, P.rock, { y: 0.1, sx: 1.3, sy: 0.6 }),
    dodeca(0.13, P.rockDark, { x: 0.25, y: 0.06, z: 0.1 }),
  ]);
}

function branch(): THREE.BufferGeometry {
  return merge([
    cyl(0.07, 0.09, 1.6, 5, P.trunk, { y: 0.08, rz: Math.PI / 2 }),
    cyl(0.04, 0.05, 0.6, 4, P.trunk, { x: 0.3, y: 0.12, z: 0.2, rz: Math.PI / 2, ry: -0.7 }),
    box(0.25, 0.04, 0.12, P.bush, { x: -0.6, y: 0.12, z: 0.05 }),
  ]);
}

function wreckage(): THREE.BufferGeometry {
  return merge([
    box(1.4, 0.08, 0.9, P.metal, { y: 0.3, rx: 0.3, rz: 0.2 }),
    box(0.9, 0.08, 1.1, P.metalDark, { x: 0.4, y: 0.2, z: 0.3, rx: -0.2, ry: 0.6 }),
    cyl(0.12, 0.12, 1.4, 6, P.metalDark, { x: -0.3, y: 0.25, z: -0.3, rz: 1.2 }),
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
      cyl(0.08, 0.16, 2.6, 5, k % 2 ? P.vine : P.vineDark, {
        x: Math.sin(a) * r,
        y: 1.0,
        z: Math.cos(a) * r,
        rx: Math.cos(a) * 0.5,
        rz: -Math.sin(a) * 0.5,
      }),
    );
  }
  parts.push(torus(0.9, 0.1, P.vineDark, { y: 1.2, rx: Math.PI / 2 }));
  parts.push(torus(0.6, 0.08, P.vine, { y: 2.0, rx: Math.PI / 2.4 }));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.3;
    parts.push(
      cone(0.22, 0.3, 5, P.bloom, {
        x: Math.sin(a) * 0.8,
        y: 1.6 + k * 0.2,
        z: Math.cos(a) * 0.8,
        rx: Math.PI,
      }),
    );
    parts.push(
      sphere(0.07, 4, 3, P.glow, { x: Math.sin(a) * 0.8, y: 1.45 + k * 0.2, z: Math.cos(a) * 0.8 }),
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
export function nodeGeometries(plants: Partial<PlantColors> = {}): THREE.BufferGeometry[] {
  P = { ...C, ...plants };
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
  P = C;
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
