// Buildings players place, landmark structures and their interactive spots.

import * as THREE from 'three';
import { POI_BY_ID, type PoiDef, type Spot } from '../../game/content/pois';
import { SECRETS } from '../../game/content/secrets';
import type { IslandParts } from '../../game/islands';
import { WALL_HEIGHT } from '../../game/content/buildings';
import { MAT, box, cone, cyl, disc, dodeca, ico, mesh, sphere, torus } from './geo';

export interface BuildingView {
  group: THREE.Group;
  /** Snap trap jaws (closed while re-arming). */
  jaws?: THREE.Object3D[];
  /** Heart lantern heart (pulses). */
  heart?: THREE.Object3D;
  /** Flame parts (campfire, torch post). */
  flame?: THREE.Object3D;
  /** Door leaf (rotates open). */
  door?: THREE.Object3D;
  /** A gate's second leaf (rotates open the other way). */
  door2?: THREE.Object3D;
  /** Rain collector water surface. */
  water?: THREE.Object3D;
  /** A roof: hidden while you stand under it (cutaway). */
  roof?: THREE.Object3D;
  /** Garden plot: where the crop grows (the view fills it). */
  crop?: THREE.Group;
}

const WOOD = 0x8a5f3a;
const WOOD2 = 0x7a5232;
const STONE = 0x8f9196;

function flameGroup(scale = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(
    mesh(
      [
        cone(0.32 * scale, 0.9 * scale, 6, 0xff7a2a, { y: 0.45 * scale }),
        cone(0.2 * scale, 0.7 * scale, 6, 0xffc04a, { y: 0.45 * scale, x: 0.08 * scale }),
        cone(0.12 * scale, 0.5 * scale, 5, 0xfff0a0, { y: 0.35 * scale }),
      ],
      MAT.glowAdd,
    ),
  );
  return g;
}

export function buildingModel(kind: string): BuildingView {
  const group = new THREE.Group();
  const view: BuildingView = { group };
  switch (kind) {
    case 'campfire': {
      const stones = Array.from({ length: 8 }, (_, k) => {
        const a = (k / 8) * Math.PI * 2;
        return dodeca(0.17, k % 2 ? STONE : 0x7a7c80, {
          x: Math.sin(a) * 0.55,
          y: 0.1,
          z: Math.cos(a) * 0.55,
        });
      });
      group.add(
        mesh([
          ...stones,
          cyl(0.07, 0.08, 1.0, 5, 0x5b3a22, { y: 0.12, rz: Math.PI / 2, ry: 0.6 }),
          cyl(0.07, 0.08, 1.0, 5, 0x4a2f1a, { y: 0.16, rz: Math.PI / 2, ry: -0.6 }),
          disc(0.45, 8, 0x2a2420, { y: 0.03 }),
        ]),
      );
      const flame = flameGroup(1);
      flame.position.y = 0.1;
      group.add(flame);
      view.flame = flame;
      break;
    }
    case 'workbench':
      group.add(
        mesh([
          box(1.8, 0.1, 1.0, WOOD, { y: 0.85 }),
          ...[-0.8, 0.8].flatMap((x) =>
            [-0.42, 0.42].map((z) => box(0.1, 0.85, 0.1, WOOD2, { x, y: 0.42, z })),
          ),
          box(1.6, 0.06, 0.8, WOOD2, { y: 0.3 }),
          box(0.5, 0.04, 0.12, 0xb0b6bd, { x: 0.3, y: 0.92, z: 0.1, ry: 0.4 }),
          box(0.12, 0.2, 0.12, 0x6b4a2a, { x: -0.5, y: 1.0, z: -0.2 }),
          cyl(0.03, 0.03, 0.4, 4, 0x7a5232, { x: -0.1, y: 0.93, z: -0.2, rz: Math.PI / 2 }),
        ]),
      );
      break;
    case 'wall_wood':
      group.add(
        mesh([
          ...Array.from({ length: 5 }, (_, k) =>
            box(0.38, 2.2 + (k % 2) * 0.15, 0.3, k % 2 ? WOOD : WOOD2, {
              x: -0.8 + k * 0.4,
              y: 1.1 + (k % 2) * 0.07,
            }),
          ),
          box(2.0, 0.14, 0.12, 0x5b3a22, { y: 0.6, z: 0.18 }),
          box(2.0, 0.14, 0.12, 0x5b3a22, { y: 1.7, z: 0.18 }),
        ]),
      );
      break;
    case 'door_wood': {
      group.add(
        mesh([
          box(0.18, 2.4, 0.34, 0x5b3a22, { x: -0.92, y: 1.2 }),
          box(0.18, 2.4, 0.34, 0x5b3a22, { x: 0.92, y: 1.2 }),
          box(2.0, 0.18, 0.34, 0x5b3a22, { y: 2.35 }),
        ]),
      );
      const leaf = new THREE.Group();
      leaf.position.set(-0.83, 0, 0);
      leaf.add(
        mesh([
          box(1.66, 2.1, 0.12, WOOD, { x: 0.83, y: 1.08 }),
          box(1.5, 0.12, 0.06, 0x5b3a22, { x: 0.83, y: 0.6, z: 0.08 }),
          box(1.5, 0.12, 0.06, 0x5b3a22, { x: 0.83, y: 1.6, z: 0.08 }),
          sphere(0.05, 4, 3, 0xd0c060, { x: 1.45, y: 1.1, z: 0.1 }),
        ]),
      );
      group.add(leaf);
      view.door = leaf;
      break;
    }
    case 'wall_stone':
      group.add(
        mesh(
          Array.from({ length: 10 }, (_, k) => {
            const row = Math.floor(k / 3.34);
            return box(
              0.66,
              0.6,
              0.45,
              k % 3 === 0 ? 0x8f9196 : k % 3 === 1 ? 0x7f8186 : 0x9a9ca1,
              { x: -0.66 + (k % 3) * 0.66 + (row % 2) * 0.1, y: 0.3 + row * 0.62 },
            );
          }),
        ),
      );
      break;
    case 'spikes':
      group.add(
        mesh([
          box(2.0, 0.12, 0.12, 0x5b3a22, { y: 0.4 }),
          ...Array.from({ length: 5 }, (_, k) => [
            cyl(0.06, 0.08, 1.4, 5, WOOD2, { x: -0.8 + k * 0.4, y: 0.6, z: 0.15, rx: 0.6 }),
            cone(0.08, 0.3, 4, 0xd8c8a0, { x: -0.8 + k * 0.4, y: 1.15, z: 0.55, rx: 0.6 }),
            cyl(0.06, 0.08, 1.4, 5, WOOD2, { x: -0.6 + k * 0.4, y: 0.6, z: -0.15, rx: -0.6 }),
            cone(0.08, 0.3, 4, 0xd8c8a0, { x: -0.6 + k * 0.4, y: 1.15, z: -0.55, rx: -0.6 }),
          ]).flat(),
        ]),
      );
      break;
    case 'wall_half':
      group.add(
        mesh([
          ...Array.from({ length: 3 }, (_, k) =>
            box(0.32, 2.2 + (k % 2) * 0.15, 0.3, k % 2 ? WOOD : WOOD2, {
              x: -0.34 + k * 0.34,
              y: 1.1 + (k % 2) * 0.07,
            }),
          ),
          box(1.0, 0.14, 0.12, 0x5b3a22, { y: 0.6, z: 0.18 }),
          box(1.0, 0.14, 0.12, 0x5b3a22, { y: 1.7, z: 0.18 }),
        ]),
      );
      break;
    case 'wall_window':
      group.add(
        mesh([
          // Planks below and above, posts at the sides, a cross in the window.
          ...Array.from({ length: 5 }, (_, k) =>
            box(0.38, 0.95, 0.3, k % 2 ? WOOD : WOOD2, { x: -0.8 + k * 0.4, y: 0.48 }),
          ),
          ...Array.from({ length: 5 }, (_, k) =>
            box(0.38, 0.5, 0.3, k % 2 ? WOOD2 : WOOD, { x: -0.8 + k * 0.4, y: 2.05 }),
          ),
          box(0.36, 0.85, 0.3, WOOD2, { x: -0.82, y: 1.38 }),
          box(0.36, 0.85, 0.3, WOOD2, { x: 0.82, y: 1.38 }),
          box(1.3, 0.1, 0.34, 0x5b3a22, { y: 0.98 }),
          box(1.3, 0.1, 0.34, 0x5b3a22, { y: 1.78 }),
          box(0.07, 0.8, 0.08, 0x4a2f1a, { y: 1.38 }),
          box(1.28, 0.07, 0.08, 0x4a2f1a, { y: 1.38 }),
        ]),
      );
      break;
    case 'post_wood':
      group.add(
        mesh([
          box(0.44, 2.5, 0.44, WOOD2, { y: 1.25 }),
          cone(0.3, 0.28, 4, WOOD, { y: 2.64, ry: Math.PI / 4 }),
          box(0.5, 0.12, 0.5, 0x5b3a22, { y: 0.6 }),
          box(0.5, 0.12, 0.5, 0x5b3a22, { y: 1.7 }),
        ]),
      );
      break;
    case 'gate_wood': {
      group.add(
        mesh([
          box(0.24, 2.7, 0.4, 0x5b3a22, { x: -1.88, y: 1.35 }),
          box(0.24, 2.7, 0.4, 0x5b3a22, { x: 1.88, y: 1.35 }),
          box(4.0, 0.2, 0.4, 0x5b3a22, { y: 2.6 }),
        ]),
      );
      const leaf = (side: -1 | 1) => {
        const g = new THREE.Group();
        g.position.set(side * 1.76, 0, 0);
        g.add(
          mesh([
            ...Array.from({ length: 4 }, (_, k) =>
              box(0.42, 2.25, 0.12, k % 2 ? WOOD : WOOD2, {
                x: -side * (0.23 + k * 0.44),
                y: 1.15,
              }),
            ),
            box(1.7, 0.14, 0.06, 0x5b3a22, { x: -side * 0.88, y: 0.55, z: 0.08 }),
            box(1.7, 0.14, 0.06, 0x5b3a22, { x: -side * 0.88, y: 1.75, z: 0.08 }),
            box(0.1, 1.5, 0.06, 0x5b3a22, {
              x: -side * 0.88,
              y: 1.15,
              z: 0.08,
              rz: side * 0.62,
            }),
          ]),
        );
        return g;
      };
      const left = leaf(-1);
      const right = leaf(1);
      group.add(left, right);
      view.door = left;
      view.door2 = right;
      break;
    }
    case 'wall_stone_half':
      group.add(
        mesh(
          Array.from({ length: 6 }, (_, k) => {
            const row = Math.floor(k / 2);
            return box(0.5, 0.6, 0.45, k % 3 === 0 ? 0x8f9196 : k % 3 === 1 ? 0x7f8186 : 0x9a9ca1, {
              x: -0.25 + (k % 2) * 0.5 + (row % 2) * 0.05,
              y: 0.3 + row * 0.62,
            });
          }),
        ),
      );
      break;
    case 'pillar_stone':
      group.add(
        mesh([
          box(0.6, 0.35, 0.6, 0x7f8186, { y: 0.18 }),
          box(0.5, 1.9, 0.5, 0x8f9196, { y: 1.3 }),
          box(0.62, 0.3, 0.62, 0x7f8186, { y: 2.38 }),
          dodeca(0.16, 0x9a9ca1, { y: 2.62 }),
        ]),
      );
      break;
    case 'torch_post': {
      group.add(
        mesh([
          cyl(0.07, 0.1, 1.8, 6, WOOD2, { y: 0.9 }),
          cyl(0.14, 0.1, 0.25, 6, 0x3a3a3a, { y: 1.85 }),
        ]),
      );
      const flame = flameGroup(0.6);
      flame.position.y = 1.92;
      group.add(flame);
      view.flame = flame;
      break;
    }
    case 'storage':
      group.add(
        mesh([
          box(1.0, 0.7, 0.8, WOOD, { y: 0.35 }),
          box(1.04, 0.1, 0.84, 0x5b3a22, { y: 0.72 }),
          box(0.06, 0.72, 0.06, 0x6d737a, { x: 0.47, y: 0.36, z: 0.37 }),
          box(0.06, 0.72, 0.06, 0x6d737a, { x: -0.47, y: 0.36, z: 0.37 }),
          box(0.15, 0.12, 0.04, 0xd0c060, { y: 0.55, z: 0.42 }),
        ]),
      );
      break;
    case 'bedroll':
      group.add(
        mesh([
          box(0.9, 0.08, 1.8, 0x4a6a8a, { y: 0.05 }),
          box(0.85, 0.06, 0.6, 0x3a5a7a, { y: 0.11, z: 0.55 }),
          cyl(0.16, 0.16, 0.8, 7, 0xd8d0c0, { y: 0.17, z: -0.75, rz: Math.PI / 2 }),
        ]),
      );
      break;
    case 'mashbench': {
      group.add(
        mesh([
          box(1.8, 0.12, 1.1, 0x6d737a, { y: 0.85 }),
          ...[-0.8, 0.8].flatMap((x) =>
            [-0.45, 0.45].map((z) => box(0.1, 0.85, 0.1, WOOD2, { x, y: 0.42, z })),
          ),
          box(1.6, 0.06, 0.9, 0x5b3a22, { y: 0.3 }),
          box(1.7, 0.6, 0.08, 0x5b3a22, { y: 1.2, z: -0.5 }),
          ...[0, 1, 2, 3].map((k) =>
            cone(0.05, 0.22, 3, 0xf2efe0, { x: -0.6 + k * 0.18, y: 1.32, z: -0.44, rx: Math.PI }),
          ),
          cyl(0.03, 0.05, 0.7, 4, 0x3f8a35, { x: 0.45, y: 1.05, z: -0.43, rz: 0.2 }),
          cyl(0.03, 0.05, 0.6, 4, 0x2c4f2a, { x: 0.65, y: 1.1, z: -0.43, rz: -0.25 }),
          box(0.45, 0.22, 0.32, 0x5a6a3a, { x: -0.45, y: 1.0, z: 0.1, ry: 0.3 }),
          cyl(0.1, 0.1, 0.22, 6, 0xe8f4ff, { x: 0.15, y: 1.02, z: 0.25 }),
        ]),
      );
      group.add(
        mesh(
          [
            sphere(0.17, 6, 5, 0x9a6ac8, { x: 0.55, y: 1.08, z: 0.15 }),
            cyl(0.08, 0.08, 0.12, 6, 0xb6ff5a, { x: 0.15, y: 0.98, z: 0.25 }),
          ],
          MAT.glow,
        ),
      );
      break;
    }
    case 'thorn_wall':
      group.add(
        mesh([
          ...Array.from({ length: 4 }, (_, k) =>
            box(0.52, 2.0 + (k % 2) * 0.2, 0.5, k % 2 ? 0x5a6a3a : 0x4f5f33, {
              x: -0.75 + k * 0.5,
              y: 1.0 + (k % 2) * 0.1,
            }),
          ),
          ...Array.from({ length: 10 }, (_, k) =>
            cone(0.06, 0.4, 4, 0xd8c8a0, {
              x: -0.85 + (k % 5) * 0.42,
              y: 0.5 + Math.floor(k / 5) * 0.9,
              z: k % 2 ? 0.34 : -0.34,
              rx: k % 2 ? Math.PI / 2 : -Math.PI / 2,
            }),
          ),
        ]),
      );
      break;
    case 'snap_trap': {
      group.add(
        mesh([
          cyl(0.48, 0.5, 0.08, 10, 0x6d737a, { y: 0.04 }),
          sphere(0.06, 4, 3, 0xf2c14e, { y: 0.1 }),
        ]),
      );
      const jaws: THREE.Object3D[] = [];
      for (const side of [-1, 1]) {
        const pivotJaw = new THREE.Group();
        pivotJaw.position.set(0, 0.08, side * 0.42);
        pivotJaw.add(
          mesh([
            box(0.8, 0.06, 0.4, 0x7a2a3a, { z: -side * 0.2 }),
            ...[0, 1, 2, 3, 4].map((k) =>
              cone(0.04, 0.14, 3, 0xf2efe0, { x: -0.32 + k * 0.16, y: 0.08, z: -side * 0.38 }),
            ),
          ]),
        );
        group.add(pivotJaw);
        jaws.push(pivotJaw);
      }
      view.jaws = jaws;
      break;
    }
    case 'heart_lantern': {
      group.add(
        mesh([
          cyl(0.08, 0.12, 1.6, 6, 0x3a3a3a, { y: 0.8 }),
          box(0.6, 0.06, 0.6, 0x3a3a3a, { y: 1.55 }),
          box(0.6, 0.06, 0.6, 0x3a3a3a, { y: 2.25 }),
          ...[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) =>
              box(0.04, 0.7, 0.04, 0x3a3a3a, { x: sx * 0.27, y: 1.9, z: sz * 0.27 }),
            ),
          ),
          cone(0.36, 0.25, 4, 0x2a2a2a, { y: 2.4, ry: Math.PI / 4 }),
        ]),
      );
      const heart = mesh([sphere(0.2, 7, 6, 0xff5a9a, { sy: 1.1 })], MAT.glow);
      heart.position.y = 1.9;
      group.add(heart);
      view.heart = heart;
      break;
    }
    case 'rain_collector': {
      group.add(
        mesh([
          ...[-0.5, 0.5].flatMap((x) =>
            [-0.5, 0.5].map((z) => cyl(0.05, 0.05, 1.5, 4, WOOD2, { x, y: 0.75, z })),
          ),
          cyl(0.5, 0.45, 0.5, 8, 0x6a5a4a, { y: 0.3 }),
          cone(0.8, 0.5, 8, 0xd8d0c0, { y: 1.35, rx: Math.PI }),
        ]),
      );
      const water = mesh([disc(0.42, 8, 0x5ab0d8)]);
      water.position.y = 0.1;
      group.add(water);
      view.water = water;
      break;
    }
    case 'wall_scrap':
      group.add(
        mesh([
          box(0.16, 2.6, 0.38, 0x5b5f66, { x: -0.92, y: 1.3 }),
          box(0.16, 2.6, 0.38, 0x5b5f66, { x: 0.92, y: 1.3 }),
          box(1.7, 1.2, 0.18, 0xb0b6bd, { y: 0.65, rz: 0.02 }),
          box(1.7, 1.15, 0.18, 0xc9d0d8, { y: 1.85, rz: -0.03 }),
          box(1.2, 0.12, 0.2, 0xd0453b, { x: 0.1, y: 1.85, z: 0.01 }),
          ...[-0.6, 0, 0.6].map((x) => sphere(0.05, 4, 3, 0x3a3a3a, { x, y: 1.25, z: 0.11 })),
        ]),
      );
      break;
    case 'fence_wood':
      group.add(
        mesh([
          box(0.16, 1.15, 0.16, WOOD2, { x: -0.9, y: 0.58 }),
          box(0.16, 1.15, 0.16, WOOD2, { x: 0.9, y: 0.58 }),
          box(2.0, 0.12, 0.08, WOOD, { y: 0.4 }),
          box(2.0, 0.12, 0.08, WOOD, { y: 0.9 }),
        ]),
      );
      break;
    case 'fence_gate': {
      group.add(
        mesh([
          box(0.18, 1.25, 0.18, 0x5b3a22, { x: -0.94, y: 0.62 }),
          box(0.18, 1.25, 0.18, 0x5b3a22, { x: 0.94, y: 0.62 }),
        ]),
      );
      const leaf = new THREE.Group();
      leaf.position.set(-0.85, 0, 0);
      leaf.add(
        mesh([
          box(1.7, 0.12, 0.07, WOOD, { x: 0.85, y: 0.35 }),
          box(1.7, 0.12, 0.07, WOOD, { x: 0.85, y: 0.95 }),
          box(0.1, 0.8, 0.07, WOOD2, { x: 0.12, y: 0.65 }),
          box(0.1, 0.8, 0.07, WOOD2, { x: 1.58, y: 0.65 }),
          box(0.08, 1.0, 0.07, WOOD2, { x: 0.85, y: 0.65, rz: 0.95 }),
        ]),
      );
      group.add(leaf);
      view.door = leaf;
      break;
    }
    case 'floor_wood':
      group.add(
        mesh(
          Array.from({ length: 5 }, (_, k) =>
            box(0.38, 0.3, 2.0, k % 2 ? WOOD : 0x9a6a42, { x: -0.8 + k * 0.4, y: -0.03 }),
          ),
        ),
      );
      break;
    case 'floor_stone':
      group.add(
        mesh(
          Array.from({ length: 4 }, (_, k) =>
            box(0.96, 0.3, 0.96, [0x9a9ca1, 0x8f9196, 0xa3a5aa, 0x86888d][k] as number, {
              x: (k % 2) * 1.0 - 0.5,
              y: -0.03,
              z: Math.floor(k / 2) * 1.0 - 0.5,
            }),
          ),
        ),
      );
      break;
    case 'rug':
      group.add(
        mesh([
          box(2.0, 0.04, 1.4, 0xb5483b, { y: 0.03 }),
          box(1.6, 0.045, 1.0, 0xe0b04a, { y: 0.035 }),
          box(1.2, 0.05, 0.6, 0x3a6a8a, { y: 0.04 }),
        ]),
      );
      break;
    case 'roof_thatch':
    case 'roof_wood': {
      const thatch = kind === 'roof_thatch';
      const roof = mesh([
        box(2.1, 0.22, 2.1, thatch ? 0xc9a85a : WOOD2, { y: WALL_HEIGHT + 0.12 }),
        box(2.12, 0.1, 0.5, thatch ? 0xb8964a : 0x6a4a2a, { y: WALL_HEIGHT + 0.27, z: -0.6 }),
        box(2.12, 0.1, 0.5, thatch ? 0xd6b56a : WOOD, { y: WALL_HEIGHT + 0.27, z: 0.1 }),
        box(2.12, 0.1, 0.5, thatch ? 0xb8964a : 0x6a4a2a, { y: WALL_HEIGHT + 0.27, z: 0.75 }),
      ]);
      group.add(roof);
      view.roof = roof;
      break;
    }
    case 'table':
      group.add(
        mesh([
          box(1.6, 0.1, 0.9, WOOD, { y: 0.8 }),
          ...[-0.7, 0.7].flatMap((x) =>
            [-0.35, 0.35].map((z) => box(0.1, 0.8, 0.1, WOOD2, { x, y: 0.4, z })),
          ),
          cyl(0.08, 0.06, 0.14, 6, 0xd8d0c0, { x: 0.3, y: 0.92 }),
          box(0.3, 0.03, 0.22, 0xe8e0d0, { x: -0.3, y: 0.86 }),
        ]),
      );
      break;
    case 'chair':
      group.add(
        mesh([
          box(0.5, 0.08, 0.5, WOOD, { y: 0.48 }),
          box(0.5, 0.6, 0.08, WOOD2, { y: 0.8, z: -0.22 }),
          ...[-0.2, 0.2].flatMap((x) =>
            [-0.2, 0.2].map((z) => box(0.07, 0.48, 0.07, WOOD2, { x, y: 0.24, z })),
          ),
        ]),
      );
      break;
    case 'bed':
      group.add(
        mesh([
          box(1.2, 0.35, 2.2, WOOD2, { y: 0.18 }),
          box(1.1, 0.16, 2.0, 0xe8e0d0, { y: 0.42 }),
          box(1.12, 0.12, 1.2, 0x4a7ab5, { y: 0.48, z: 0.38 }),
          box(0.8, 0.14, 0.4, 0xffffff, { y: 0.55, z: -0.72 }),
          box(1.2, 0.7, 0.12, WOOD, { y: 0.55, z: -1.05 }),
        ]),
      );
      break;
    case 'shelf':
      group.add(
        mesh([
          box(0.1, 1.8, 0.5, WOOD2, { x: -0.75, y: 0.9 }),
          box(0.1, 1.8, 0.5, WOOD2, { x: 0.75, y: 0.9 }),
          ...[0.1, 0.65, 1.2, 1.75].map((y) => box(1.6, 0.06, 0.48, WOOD, { y })),
          box(0.3, 0.3, 0.3, 0xa0703f, { x: -0.4, y: 0.82 }),
          cyl(0.1, 0.1, 0.3, 6, 0x5ab0d8, { x: 0.3, y: 0.82 }),
          box(0.5, 0.2, 0.3, 0xc9a46a, { x: 0.2, y: 1.33 }),
          sphere(0.12, 6, 4, 0x6e7d2c, { x: -0.3, y: 1.35 }),
        ]),
      );
      break;
    case 'chest_big':
      group.add(
        mesh([
          box(1.4, 0.7, 0.9, WOOD, { y: 0.35 }),
          cyl(0.45, 0.45, 1.42, 8, 0x9a6a42, { y: 0.7, rz: Math.PI / 2, sz: 1.0 }),
          box(0.08, 0.95, 0.94, 0x6d737a, { x: -0.5, y: 0.5 }),
          box(0.08, 0.95, 0.94, 0x6d737a, { x: 0.5, y: 0.5 }),
          box(0.18, 0.2, 0.06, 0xd0c060, { y: 0.66, z: 0.47 }),
        ]),
      );
      break;
    case 'lamp': {
      group.add(
        mesh([
          cyl(0.2, 0.25, 0.1, 6, 0x3a3a3a, { y: 0.05 }),
          cyl(0.04, 0.05, 1.3, 5, 0x3a3a3a, { y: 0.7 }),
          cone(0.28, 0.2, 6, 0x2a2a2a, { y: 1.62 }),
        ]),
      );
      const glow = mesh([sphere(0.14, 6, 5, 0xc8ff7a)], MAT.glow);
      glow.position.y = 1.42;
      group.add(glow);
      break;
    }
    case 'garden_plot': {
      group.add(
        mesh([
          box(2.0, 0.22, 0.14, WOOD2, { y: 0.05, z: -0.93 }),
          box(2.0, 0.22, 0.14, WOOD2, { y: 0.05, z: 0.93 }),
          box(0.14, 0.22, 1.72, WOOD2, { x: -0.93, y: 0.05 }),
          box(0.14, 0.22, 1.72, WOOD2, { x: 0.93, y: 0.05 }),
          box(1.72, 0.12, 1.72, 0x4a3324, { y: 0.06 }),
          ...[-0.5, 0, 0.5].map((z) => box(1.6, 0.06, 0.18, 0x5a3e2a, { y: 0.13, z })),
        ]),
      );
      const crop = new THREE.Group();
      group.add(crop);
      view.crop = crop;
      break;
    }
    case 'cooking_pot':
      group.add(
        mesh([
          ...[0, 1, 2].map((k) => {
            const a = (k / 3) * Math.PI * 2;
            return cyl(0.03, 0.04, 1.3, 4, 0x3a3a3a, {
              x: Math.sin(a) * 0.35,
              y: 0.6,
              z: Math.cos(a) * 0.35,
              rx: Math.cos(a) * 0.3,
              rz: -Math.sin(a) * 0.3,
            });
          }),
          sphere(0.34, 8, 6, 0x4a4a50, { y: 0.55, sy: 0.85 }),
          cyl(0.3, 0.3, 0.06, 8, 0x8a6a3a, { y: 0.8 }),
          torus(0.3, 0.03, 0x2a2a2a, { y: 0.82, rx: Math.PI / 2 }),
        ]),
      );
      break;
    case 'spike_pit':
      group.add(
        mesh([
          box(1.9, 0.08, 1.9, 0x4a3a2a, { y: 0.02 }),
          ...Array.from({ length: 9 }, (_, k) =>
            cone(0.07, 0.55, 4, k % 2 ? 0xc9a46a : 0xb08a52, {
              x: (k % 3) * 0.6 - 0.6,
              y: 0.3,
              z: Math.floor(k / 3) * 0.6 - 0.6,
              rx: (k % 2 ? 0.2 : -0.2) * (k % 3 === 1 ? 0 : 1),
            }),
          ),
        ]),
      );
      break;
  }
  return view;
}

/** Glow halo for something worth walking to. */
function halo(color: number, r = 0.6): THREE.Mesh {
  return mesh([torus(r, 0.04, color, { y: 0.05, rx: Math.PI / 2 })], MAT.glowAdd);
}

export interface SpotView {
  spot: Spot;
  group: THREE.Group;
  halo: THREE.Mesh | null;
  /** Things that disappear once used/taken. */
  item: THREE.Object3D | null;
  light?: THREE.Mesh;
}

function spotModel(spot: Spot): SpotView {
  const group = new THREE.Group();
  let h: THREE.Mesh | null = null;
  let item: THREE.Object3D | null = null;
  let light: THREE.Mesh | undefined;
  switch (spot.kind) {
    case 'note':
      item = mesh([
        box(0.32, 0.02, 0.42, 0xf2ecd8, { y: 0.06, ry: 0.4 }),
        box(0.22, 0.021, 0.02, 0x555555, { y: 0.07, z: 0.05, ry: 0.4 }),
        box(0.22, 0.021, 0.02, 0x555555, { y: 0.07, z: -0.05, ry: 0.4 }),
      ]);
      h = halo(0xfff2a0);
      break;
    case 'tag':
      item = mesh([
        box(0.18, 0.02, 0.1, 0xd8b070, { y: 0.05, ry: 1.1 }),
        cyl(0.008, 0.008, 0.25, 3, 0xcc3333, { y: 0.05, x: 0.1, rz: Math.PI / 2 }),
      ]);
      h = halo(0xffd080, 0.45);
      break;
    case 'loot':
      item = mesh([
        box(0.8, 0.5, 0.55, 0x6b4a2a, { y: 0.25 }),
        box(0.84, 0.06, 0.59, 0x4a3420, { y: 0.48 }),
        box(0.06, 0.52, 0.6, 0x6d737a, { x: 0.3, y: 0.25 }),
        box(0.06, 0.52, 0.6, 0x6d737a, { x: -0.3, y: 0.25 }),
      ]);
      h = halo(0x9fe8ff, 0.8);
      break;
    case 'lock':
      group.add(
        mesh([
          box(0.4, 0.5, 0.08, 0x3a3a3a, { y: 1.1 }),
          box(0.3, 0.2, 0.02, 0x1a1a1a, { y: 1.15, z: 0.05 }),
        ]),
      );
      light = mesh([sphere(0.05, 5, 4, 0xff3030, { y: 1.3, z: 0.05 })], MAT.glow);
      group.add(light);
      h = halo(0xff8060, 0.7);
      break;
    case 'generator':
      light = mesh([sphere(0.07, 5, 4, 0xff3030, { y: 1.05, z: -0.72 })], MAT.glow);
      group.add(light);
      h = halo(0xffd080, 0.7);
      break;
    case 'antenna':
      group.add(
        mesh([
          ...Array.from({ length: 7 }, (_, k) =>
            box(0.6, 0.05, 0.05, 0x9a9a9a, { y: 0.3 + k * 0.35 }),
          ),
          box(0.05, 2.6, 0.05, 0x8a8a8a, { x: -0.3, y: 1.3 }),
          box(0.05, 2.6, 0.05, 0x8a8a8a, { x: 0.3, y: 1.3 }),
        ]),
      );
      item = mesh([
        box(0.7, 0.35, 0.4, 0x5a6a7a, { y: 0.2, z: 0.4 }),
        cyl(0.02, 0.02, 0.9, 3, 0xcccccc, { y: 0.6, z: 0.4, x: 0.2 }),
      ]);
      h = halo(0x9fe8ff, 0.8);
      break;
    case 'beacon':
      group.add(
        mesh([
          box(0.9, 1.1, 0.5, 0x4a4f55, { y: 0.55 }),
          box(0.7, 0.05, 0.4, 0x2a2f35, { y: 1.12 }),
        ]),
      );
      light = mesh([box(0.5, 0.3, 0.02, 0x40ff80, { y: 0.8, z: 0.26 })], MAT.glow);
      group.add(light);
      h = halo(0x80ffb0, 0.9);
      break;
    case 'heli':
      group.add(
        mesh([
          disc(5, 20, 0x5a5d62, { y: 0.04 }),
          torus(4.3, 0.12, 0xf2c14e, { y: 0.06, rx: Math.PI / 2 }),
          box(0.5, 0.02, 2.6, 0xf2f2f2, { x: -0.9, y: 0.07 }),
          box(0.5, 0.02, 2.6, 0xf2f2f2, { x: 0.9, y: 0.07 }),
          box(1.4, 0.02, 0.45, 0xf2f2f2, { y: 0.07 }),
        ]),
      );
      break;
  }
  if (item) group.add(item);
  if (h) group.add(h);
  return { spot, group, halo: h, item, ...(light ? { light } : {}) };
}

function fuselage(len: number, r: number, color: number, stripe: number): THREE.BufferGeometry[] {
  const parts = [
    cyl(r, r, len, 10, color, { rz: Math.PI / 2, y: r }),
    box(len, 0.25, 0.04, stripe, { y: r + 0.3, z: r - 0.02 }),
    box(len, 0.25, 0.04, stripe, { y: r + 0.3, z: -r + 0.02 }),
  ];
  for (let k = 0; k < Math.floor(len / 0.9); k++) {
    const x = -len / 2 + 0.6 + k * 0.9;
    parts.push(box(0.35, 0.3, 0.04, 0x2a3a4a, { x, y: r + 0.75, z: r - 0.05 }));
    parts.push(box(0.35, 0.3, 0.04, 0x2a3a4a, { x, y: r + 0.75, z: -r + 0.05 }));
  }
  return parts;
}

/** The static model for a landmark, in its local frame (origin at the POI centre). */
function poiStructure(poi: PoiDef): THREE.Group {
  const g = new THREE.Group();
  const add = (parts: THREE.BufferGeometry[], dx: number, dz: number, rot: number, tilt = 0) => {
    const m = mesh(parts);
    m.position.set(dx, 0, dz);
    m.rotation.set(0, -rot, tilt);
    g.add(m);
  };
  const b = poi.boxes;
  switch (poi.id) {
    case 'crash': {
      const f = b[0];
      if (f) {
        add(
          [
            ...fuselage(14, 2.1, 0xeef0f2, 0x2f6fb5),
            ...Array.from({ length: 6 }, (_, k) =>
              cone(0.4, 1.2, 4, 0xd0d3d6, {
                x: 7.2,
                y: 0.6 + k * 0.6,
                z: -1.5 + k * 0.6,
                rz: -Math.PI / 2,
              }),
            ),
          ],
          f.dx,
          f.dz,
          f.rot,
          0.04,
        );
      }
      const w = b[1];
      if (w)
        add(
          [
            box(8, 0.3, 1.6, 0xd7dadf, { y: 0.45 }),
            cyl(0.5, 0.5, 1.8, 8, 0x8a9096, { x: -1, y: 0.4, z: 0.9, rz: Math.PI / 2 }),
            box(0.6, 0.05, 1.5, 0x2f6fb5, { x: 3.6, y: 0.62 }),
          ],
          w.dx,
          w.dz,
          w.rot,
          0.12,
        );
      const d = b[2];
      if (d)
        add(
          [
            box(1.2, 1.1, 0.7, 0xb0b6bd, { y: 0.55 }),
            box(0.9, 0.8, 0.6, 0x9aa0a6, { x: 0.9, y: 0.4, z: 0.6, ry: 0.5 }),
            box(2.6, 0.12, 1.2, 0xd7dadf, { y: 0.06, z: -0.5, ry: 0.3 }),
          ],
          d.dx,
          d.dz,
          d.rot,
        );
      // Scorched ground.
      g.add(mesh([disc(9, 12, 0x3a3226, { y: 0.04 })]));
      break;
    }
    case 'cockpit': {
      const c = b[0];
      if (c)
        add(
          [
            cyl(1.6, 1.6, 3.2, 10, 0xeef0f2, { x: 0.6, y: 1.6, rz: Math.PI / 2 }),
            cone(1.6, 2.4, 10, 0xeef0f2, { x: -2.2, y: 1.6, rz: Math.PI / 2 }),
            box(0.9, 0.5, 2.0, 0x1e2c3c, { x: -1.4, y: 2.5 }),
            box(3.2, 0.25, 0.04, 0x2f6fb5, { x: 0.6, y: 1.9, z: 1.58 }),
            ...Array.from({ length: 5 }, (_, k) =>
              cone(0.35, 1.0, 4, 0xd0d3d6, {
                x: 2.4,
                y: 0.6 + k * 0.6,
                z: -1.2 + k * 0.6,
                rz: -Math.PI / 2,
              }),
            ),
          ],
          c.dx,
          c.dz,
          c.rot,
          -0.06,
        );
      break;
    }
    case 'tail': {
      const t = b[0];
      if (t)
        add(
          [
            ...fuselage(8, 1.7, 0xeef0f2, 0x2f6fb5),
            box(2.4, 4.2, 0.25, 0x2f6fb5, { x: 2.4, y: 4.6, rz: 0.35 }),
            box(2.2, 0.2, 4.6, 0xeef0f2, { x: 3, y: 2.4 }),
            cone(1.7, 2.2, 10, 0xeef0f2, { x: 5, y: 1.7, rz: -Math.PI / 2 }),
          ],
          t.dx,
          t.dz,
          t.rot,
          0.05,
        );
      const c = b[1];
      if (c)
        add(
          [
            box(6, 2.6, 2.6, 0xc8692c, { y: 1.3 }),
            ...Array.from({ length: 7 }, (_, k) =>
              box(0.08, 2.62, 2.62, 0xa8541f, { x: -2.7 + k * 0.9, y: 1.3 }),
            ),
            box(0.1, 2.4, 1.2, 0x8a3f12, { x: 3.0, y: 1.3, z: 0.6 }),
          ],
          c.dx,
          c.dz,
          c.rot,
        );
      break;
    }
    case 'tower': {
      const legs: THREE.BufferGeometry[] = [];
      const H = 18;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          legs.push(
            cyl(0.08, 0.12, H, 4, 0x9a9a9a, {
              x: sx * 0.9,
              y: H / 2,
              z: sz * 0.9,
              rz: sx * 0.035,
              rx: -sz * 0.035,
            }),
          );
        }
      }
      for (let k = 1; k < 9; k++) {
        const y = k * 2;
        const w = 1.9 - k * 0.08;
        legs.push(
          box(w, 0.06, 0.06, 0x8a8a8a, { y, z: w / 2 }),
          box(w, 0.06, 0.06, 0x8a8a8a, { y, z: -w / 2 }),
          box(0.06, 0.06, w, 0x8a8a8a, { y, x: w / 2 }),
          box(0.06, 0.06, w, 0x8a8a8a, { y, x: -w / 2 }),
        );
        legs.push(box(0.05, 2.6, 0.05, 0x8a8a8a, { y: y - 1, z: w / 2, rz: 0.7 }));
      }
      legs.push(
        box(1.6, 0.1, 1.6, 0x7a7a7a, { y: H }),
        cyl(0.05, 0.05, 4, 4, 0xbdbdbd, { y: H + 2 }),
      );
      add(legs, 0, 0, 0);
      g.add(mesh([sphere(0.18, 5, 4, 0xff3030, { y: H + 4 })], MAT.glow));
      const s = b[1];
      if (s)
        add(
          [
            box(4, 2.8, 3, 0xb8b2a6, { y: 1.4 }),
            box(4.4, 0.2, 3.4, 0x6a5a4a, { y: 2.9 }),
            box(0.9, 1.9, 0.05, 0x4a3a2a, { y: 0.95, z: 1.52 }),
            box(0.9, 0.6, 0.05, 0x2a3a4a, { x: 1.2, y: 1.8, z: 1.52 }),
          ],
          s.dx,
          s.dz,
          s.rot,
        );
      break;
    }
    case 'station': {
      for (const bx of b) {
        const parts = [
          box(bx.w, bx.h, bx.d, 0xa8aaa4, { y: bx.h / 2 }),
          box(bx.w + 0.3, 0.25, bx.d + 0.3, 0x6c6e6a, { y: bx.h + 0.1 }),
        ];
        for (let k = 0; k < Math.floor(bx.w / 2); k++)
          parts.push(
            box(1.0, 0.8, 0.05, k % 2 ? 0x2a3a4a : 0x4a6a7a, {
              x: -bx.w / 2 + 1 + k * 2,
              y: bx.h * 0.6,
              z: bx.d / 2 + 0.01,
            }),
          );
        for (let k = 0; k < 4; k++)
          parts.push(
            cyl(0.08, 0.14, bx.h * 1.2, 5, 0x2c4f2a, {
              x: -bx.w / 2 + 0.5 + k * (bx.w / 4),
              y: bx.h * 0.5,
              z: bx.d / 2 + 0.1,
              rz: 0.3 * (k % 2 ? 1 : -1),
            }),
          );
        add(parts, bx.dx, bx.dz, bx.rot);
      }
      g.add(
        mesh([
          disc(11, 14, 0x55535a, { y: 0.05 }),
          ...Array.from({ length: 10 }, (_, k) =>
            cyl(0.06, 0.06, 1.4, 4, 0x7a7a7a, {
              x: Math.sin((k / 10) * Math.PI * 2) * 13,
              y: 0.7,
              z: Math.cos((k / 10) * Math.PI * 2) * 13,
            }),
          ),
        ]),
      );
      break;
    }
    case 'bunker': {
      const CONCRETE = 0x8d8f86;
      g.add(
        mesh([
          // Sunk into the hill, on a foundation that reaches below any slope.
          box(7, 3.2, 5, CONCRETE, { y: 0.9, z: -1 }),
          box(7.3, 3, 5.3, 0x6f716a, { y: -1.9, z: -1 }),
          box(7.4, 0.35, 5.4, 0x7a7c74, { y: 2.6, z: -1 }),
          // Earth and moss over the roof.
          ico(2.2, 1, 0x5b6b3a, { x: -1.2, y: 2.75, z: -2.4, sx: 1.2, sy: 0.3, sz: 0.65 }),
          ico(1.2, 1, 0x6b7b44, { x: 2.1, y: 2.75, z: -1.8, sy: 0.32 }),
          // Door frame, hazard stripes, the Verdance leaf.
          box(2.5, 2.6, 0.3, 0x55574f, { x: 0.4, y: 1.2, z: 1.55 }),
          box(1.7, 2.1, 0.1, 0x111214, { x: 0.4, y: 1.05, z: 1.62 }),
          ...[0, 1, 2, 3, 4].map((k) =>
            box(0.42, 0.22, 0.06, k % 2 ? 0x1b1a1a : 0xf2c14e, {
              x: -0.44 + k * 0.42,
              y: 2.38,
              z: 1.72,
            }),
          ),
          box(1.2, 0.5, 0.06, 0x2f8a4a, { x: -2.4, y: 1.9, z: 1.53 }),
          cone(0.22, 0.4, 4, 0x9fe86a, { x: -2.4, y: 1.95, z: 1.58, rx: Math.PI / 2 }),
          // Air vents, grown over.
          box(0.8, 0.5, 0.8, 0x6d737a, { x: -2.6, y: 2.9, z: -2.6 }),
          cyl(0.08, 0.12, 1.4, 4, 0x3f8a35, { x: -2.3, y: 2.6, z: -2.2, rz: 0.8 }),
          // Generator.
          box(1.8, 1.1, 1.3, 0x4f6a4a, { x: 5.2, y: 0.55, z: 0.6 }),
          box(1.9, 0.12, 1.4, 0x3a4a36, { x: 5.2, y: 1.15, z: 0.6 }),
          cyl(0.1, 0.1, 1.1, 5, 0x3a3a3a, { x: 5.8, y: 1.6, z: 0.2 }),
          cyl(0.16, 0.16, 0.12, 6, 0xd0453b, { x: 4.7, y: 1.25, z: 0.9 }),
          box(0.1, 0.1, 1.4, 0x222222, { x: 3.4, y: 0.06, z: 1.0, ry: 0.4 }),
        ]),
      );
      // The door swings open (view.ts) once the code is in.
      const door = new THREE.Group();
      door.position.set(-0.4, 0, 1.68);
      door.add(
        mesh([
          box(1.6, 2.0, 0.12, 0x6d737a, { x: 0.8, y: 1.05 }),
          box(1.3, 0.12, 0.05, 0x55595e, { x: 0.8, y: 1.5, z: 0.08 }),
          box(1.3, 0.12, 0.05, 0x55595e, { x: 0.8, y: 0.6, z: 0.08 }),
          cyl(0.18, 0.18, 0.06, 8, 0x8a8c90, { x: 0.8, y: 1.05, z: 0.09, rx: Math.PI / 2 }),
        ]),
      );
      door.name = 'door';
      g.add(door);
      break;
    }
    case 'wreck': {
      const HULL = 0x7a3a2a;
      const RUST = 0x9a5a32;
      const hull = new THREE.Group();
      hull.add(
        mesh([
          box(17, 4.2, 5.4, HULL, { x: -1.5, y: 1.1 }),
          box(17, 0.5, 5.6, 0x2a2a2e, { x: -1.5, y: -0.8 }),
          box(17.2, 0.3, 5.6, 0xd8d0c0, { x: -1.5, y: 3.25 }),
          // The bow, pointed.
          cone(2.75, 4.5, 4, HULL, {
            x: 9.2,
            y: 1.1,
            rz: -Math.PI / 2,
            rx: Math.PI / 4,
            sy: 1,
            sz: 0.75,
          }),
          // The bridge and funnel.
          box(4.5, 5, 4.4, 0xe8e2d4, { x: -6, y: 5.6 }),
          ...[-1, 0, 1].map((k) =>
            box(0.9, 0.6, 0.05, 0x1c2a33, { x: -6 + k * 1.3, y: 7, z: 2.22 }),
          ),
          box(4.9, 0.3, 4.8, 0x5a5a5a, { x: -6, y: 8.2 }),
          cyl(0.7, 0.8, 3, 7, 0x3a3a3a, { x: -7.2, y: 9.6 }),
          box(1.5, 0.35, 0.05, 0xd0453b, { x: -7.2, y: 10.2, z: 0.75 }),
          // Rust runs, the breach in her side, the name on the bow.
          ...[-8, -4, 1, 5].map((x) => box(0.5, 2.2, 0.05, RUST, { x, y: 1.6, z: 2.72 })),
          box(2.8, 2, 0.08, 0x141414, { x: 0, y: 0.8, z: 2.7 }),
          box(1.6, 0.4, 0.05, 0xf2f0e8, { x: 7.6, y: 2.4, z: 2.4, ry: -0.5 }),
          // A mast fallen across the deck.
          cyl(0.12, 0.15, 9, 5, 0x6b5a4a, { x: 2, y: 3.6, z: -0.5, rz: 1.35, ry: 0.4 }),
        ]),
      );
      // Water in the breach while the tide is in (view.ts).
      const flood = mesh([box(2.6, 1.3, 0.1, 0x2e6f8a, { x: 0, y: 0.45, z: 2.76 })]);
      flood.name = 'flood';
      hull.add(flood);
      // Aground: listing to seaward and down by the stern.
      hull.rotation.set(0.14, 0, 0.05);
      hull.position.y = -0.6;
      g.add(hull);
      break;
    }
    case 'marker_a':
    case 'marker_b':
    case 'marker_c':
    case 'marker_d':
      g.add(
        mesh([
          box(0.5, 1.3, 0.5, 0x9a9c94, { y: 0.45 }),
          box(0.6, 0.12, 0.6, 0x7a7c74, { y: 1.12 }),
          box(0.34, 0.24, 0.03, 0xc9a24a, { y: 0.85, z: 0.26 }),
          box(0.24, 0.04, 0.035, 0x6b5a2a, { y: 0.88, z: 0.27 }),
          box(0.24, 0.04, 0.035, 0x6b5a2a, { y: 0.81, z: 0.27 }),
          cyl(0.03, 0.03, 0.9, 4, 0x3f8a35, { x: 0.22, y: 0.5, z: 0.24, rz: 0.4 }),
        ]),
      );
      break;
    default: {
      const t = b[0];
      if (t)
        add(
          [
            cyl(0.01, 1.7, 1.9, 3, 0x6a7a5a, { y: 0.95, rx: Math.PI / 2, ry: 0, sz: 1 }),
            box(0.06, 2.2, 0.06, 0x5b3a22, { y: 1.1, x: 1.2 }),
          ],
          t.dx,
          t.dz,
          t.rot,
        );
      g.add(
        mesh([
          ...Array.from({ length: 6 }, (_, k) =>
            dodeca(0.15, STONE, {
              x: 2 + Math.sin(k) * 0.45,
              y: 0.08,
              z: 2.5 + Math.cos(k) * 0.45,
            }),
          ),
          cyl(0.06, 0.07, 0.8, 4, 0x2a2420, { x: 2, y: 0.1, z: 2.5, rz: Math.PI / 2 }),
        ]),
      );
    }
  }
  return g;
}

const SECRET_BY_ID: Record<string, PoiDef> = Object.fromEntries(
  SECRETS.map((d) => [d.id, { ...d, x: 0, z: 0 }]),
);

/** A treasure map's X: two sticks crossed on a little mound of sand. */
export function treasureMark(): THREE.Object3D {
  return mesh([
    sphere(0.7, 7, 3, 0xd8c890, { y: -0.18, sy: 0.4 }),
    box(1.3, 0.1, 0.14, 0x6b4a2a, { y: 0.12, ry: 0.78 }),
    box(1.3, 0.1, 0.14, 0x6b4a2a, { y: 0.16, ry: -0.78 }),
  ]);
}

export interface PoiView {
  poi: PoiDef;
  group: THREE.Group;
  spots: SpotView[];
}

/**
 * The landmarks of an island. Models are built in the classic layout and the group turns
 * (and mirrors) them into place, so `poi` holds where they stand on this island.
 */
export function buildPois(
  pois: PoiDef[],
  parts: IslandParts,
  heightAt: (x: number, z: number) => number,
): PoiView[] {
  return pois.map((poi) => {
    const classic = POI_BY_ID[poi.id] ?? SECRET_BY_ID[poi.id] ?? poi;
    const group = poiStructure(classic);
    group.position.set(poi.x, heightAt(poi.x, poi.z), poi.z);
    // Secret sites are placed on the finished island: only their own turn applies.
    if (poi.secret) {
      group.rotation.y = -(poi.rot ?? 0);
    } else {
      group.rotation.y = (-parts.turn * Math.PI) / 2;
      if (parts.mirror) group.scale.x = -1;
    }
    const spots = classic.spots.map((spot, i) => {
      const v = spotModel(spot);
      const at = poi.spots[i] ?? spot;
      v.group.position.set(
        spot.dx,
        heightAt(poi.x + at.dx, poi.z + at.dz) - group.position.y,
        spot.dz,
      );
      group.add(v.group);
      return v;
    });
    return { poi, group, spots };
  });
}

/** The rescue helicopter. */
export function helicopter(): { group: THREE.Group; rotor: THREE.Object3D } {
  const group = new THREE.Group();
  group.add(
    mesh([
      sphere(1.3, 8, 6, 0xe0e4e8, { y: 1.5, sx: 1.6 }),
      box(4, 0.4, 0.4, 0xe0e4e8, { x: -3, y: 1.8 }),
      box(0.2, 1.2, 0.8, 0xd0453b, { x: -4.9, y: 2.2 }),
      box(1.0, 0.6, 0.05, 0x2a3a4a, { x: 1.2, y: 1.8, z: 1.0 }),
      box(3.4, 0.12, 0.12, 0x3a3a3a, { y: 0.15, z: 0.9 }),
      box(3.4, 0.12, 0.12, 0x3a3a3a, { y: 0.15, z: -0.9 }),
      box(4, 0.3, 0.05, 0xd0453b, { y: 1.6, z: 1.3 }),
    ]),
  );
  const rotor = new THREE.Group();
  rotor.position.y = 2.9;
  rotor.add(
    mesh([
      box(9, 0.06, 0.35, 0x2a2a2a),
      box(0.35, 0.06, 9, 0x2a2a2a),
      cyl(0.15, 0.15, 0.4, 6, 0x3a3a3a, { y: -0.2 }),
    ]),
  );
  group.add(rotor);
  return { group, rotor };
}

/**
 * What grows in a garden plot: nine plants in three rows (two big pumpkins), drawn by
 * crop (index in crops.ts: corn, potato, tomato, pumpkin, berry) and stage 0-3; wet soil
 * shows darker.
 */
export function cropModel(crop: number, stage: number, wet: boolean): THREE.Group {
  const g = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  if (wet) parts.push(box(1.72, 0.02, 1.72, 0x2e2018, { y: 0.125 }));
  const LEAF = 0x4f9a3a;
  const LEAF2 = 0x5fae44;
  const k = [0.45, 0.7, 0.9, 1][stage] ?? 1;
  const spots: [number, number][] = [];
  for (const z of [-0.55, 0, 0.55]) for (const x of [-0.55, 0, 0.55]) spots.push([x, z]);
  if (crop === 3 && stage >= 1) {
    // Pumpkins: sprawling vines and two fat fruit.
    for (const [x, z] of spots)
      parts.push(
        box(0.36 * k, 0.04, 0.3 * k, (x + z) % 2 ? LEAF : LEAF2, { x, y: 0.17, z, ry: x * 3 }),
      );
    if (stage >= 2) {
      const big = stage === 3;
      for (const [x, z] of [
        [-0.35, 0.3],
        [0.4, -0.3],
      ] as [number, number][])
        parts.push(
          sphere(big ? 0.32 : 0.16, 8, 6, big ? 0xe8822a : 0x7aa04a, {
            x,
            y: 0.15 + (big ? 0.2 : 0.1),
            z,
            sy: 0.72,
          }),
          cyl(0.03, 0.04, 0.12, 4, 0x5b3a22, { x, y: big ? 0.6 : 0.33, z }),
        );
    }
  } else {
    for (const [x, z] of spots) {
      if (stage === 0) {
        parts.push(cone(0.06, 0.16, 4, LEAF2, { x, y: 0.2, z }));
        continue;
      }
      switch (crop) {
        case 0: {
          // Corn: tall stalks, cobs and tassels when ripe.
          const h = [0, 0.55, 1.05, 1.4][stage] ?? 1.4;
          parts.push(cyl(0.03, 0.045, h, 4, 0x6aa040, { x, y: 0.12 + h / 2, z }));
          parts.push(box(0.04, 0.02, 0.4 * k, LEAF, { x, y: 0.12 + h * 0.55, z, ry: x * 5 + z }));
          if (stage === 3) {
            parts.push(
              cyl(0.06, 0.05, 0.28, 6, 0xf2c94a, { x: x + 0.07, y: 0.12 + h * 0.6, z, rz: -0.3 }),
            );
            parts.push(cone(0.06, 0.18, 4, 0xd8c070, { x, y: 0.12 + h + 0.08, z }));
          }
          break;
        }
        case 1:
          // Potatoes: leafy clumps, white flowers and a few tubers when ready.
          parts.push(
            ico(0.18 * k, 0, (x + z) % 2 ? LEAF : LEAF2, { x, y: 0.2 + 0.08 * k, z, sy: 0.7 }),
          );
          if (stage === 3) {
            parts.push(sphere(0.05, 4, 3, 0xf8f4e8, { x: x + 0.08, y: 0.42, z }));
            parts.push(dodeca(0.07, 0xb08a52, { x: x - 0.1, y: 0.15, z: z + 0.12 }));
          }
          break;
        case 2:
          // Tomatoes: staked plants, red fruit when ripe.
          parts.push(cyl(0.015, 0.015, 0.8 * k, 3, 0x8a6a3a, { x, y: 0.12 + 0.4 * k, z }));
          parts.push(ico(0.16 * k, 0, LEAF, { x, y: 0.12 + 0.45 * k, z, sy: 1.3 }));
          if (stage >= 2)
            for (const d of [-0.09, 0.09])
              parts.push(
                sphere(0.05, 5, 4, stage === 3 ? 0xe03a2a : 0x8ab84a, {
                  x: x + d,
                  y: 0.12 + 0.4 * k,
                  z: z + 0.08,
                }),
              );
          break;
        default:
          // Berry bushes: round, dotted blue when ripe.
          parts.push(ico(0.2 * k, 0, LEAF2, { x, y: 0.12 + 0.18 * k, z, sy: 0.85 }));
          if (stage === 3)
            for (const [dx, dy] of [
              [0.1, 0.25],
              [-0.1, 0.2],
              [0.02, 0.32],
            ] as [number, number][])
              parts.push(sphere(0.04, 4, 3, 0x4a3ab8, { x: x + dx, y: 0.12 + dy, z: z + 0.1 }));
      }
    }
  }
  if (parts.length) g.add(mesh(parts));
  return g;
}
