// Chunked terrain meshes, the ocean and freshwater pools.

import * as THREE from 'three';
import { noise2 } from '../../game/noise';
import { hash01 } from '../../game/rng';
import { BIOME, CELL, CHUNK, CHUNKS, GRID, HALF, type Island } from '../../game/world';
import { climateLook } from './climate';
import { WIND } from './wind';

const PER = CHUNK / CELL;
/** The sea's grid (m): it moves with you in whole cells, so its waves never jump. */
const WATER_CELL = 6;
const DRY = new THREE.Color(0xb8c46a);

const BIOME_COLORS: Record<number, number[]> = {
  [BIOME.ocean]: [0xc9b98a],
  [BIOME.beach]: [0xe6d6a0, 0xe0cf96, 0xebdcaa],
  [BIOME.meadow]: [0x7cc24a, 0x72b443, 0x8cca52, 0x84bd48],
  [BIOME.jungle]: [0x468a35, 0x3f7f31, 0x529543],
  [BIOME.forest]: [0x51744a, 0x4a6c44, 0x5a7c52],
  [BIOME.highland]: [0x8f8e86, 0x86857d, 0x7a8a5a, 0x9a998f],
  [BIOME.bog]: [0x5d5470, 0x4f5a48, 0x564d66, 0x625a74],
};

const tmp = new THREE.Color();
const rockColor = new THREE.Color(0x77756e);
const deep = new THREE.Color(0x4f7f8f);

/** The ground colours of an island's climate. */
interface Ground {
  biomes: Partial<Record<number, number[]>>;
  wetSand: THREE.Color;
}

export class Terrain {
  private readonly island: Island;
  private readonly group = new THREE.Group();
  private readonly chunks = new Map<number, THREE.Mesh>();
  private readonly material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  });
  readonly water: THREE.Mesh;
  private readonly waterMat: THREE.MeshPhongMaterial;
  private readonly poolMat: THREE.MeshPhongMaterial;
  private queue: number[] = [];
  private readonly ground: Ground;
  private readonly sea: number;

  constructor(island: Island, scene: THREE.Scene) {
    this.island = island;
    const look = climateLook(island.spec.climate);
    this.ground = {
      biomes: { ...BIOME_COLORS, ...look.ground },
      wetSand: new THREE.Color(look.wetSand ?? 0xc9b98a),
    };
    this.sea = look.sea ?? 0x2f8fc0;
    scene.add(this.group);
    this.waterMat = new THREE.MeshPhongMaterial({
      color: this.sea,
      transparent: true,
      opacity: 0.8,
      shininess: 90,
      specular: 0xbfe4f6,
      flatShading: true,
    });
    // Low swells, faceted so they catch the sun.
    this.waterMat.onBeforeCompile = (shader) => {
      shader.uniforms['uWindTime'] = WIND;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
  vec4 seaAt = modelMatrix * vec4(position, 1.0);
  transformed.y += sin(seaAt.x * 0.33 + uWindTime * 1.2) * 0.07
    + sin(seaAt.z * 0.27 + seaAt.x * 0.11 - uWindTime * 0.9) * 0.06;`,
        );
    };
    const cells = Math.round(420 / WATER_CELL);
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(cells * WATER_CELL, cells * WATER_CELL, cells, cells).rotateX(
        -Math.PI / 2,
      ),
      this.waterMat,
    );
    this.water.position.y = -0.02;
    this.water.renderOrder = 1;
    this.water.userData['shade'] = 'receive';
    scene.add(this.water);
    this.poolMat = new THREE.MeshPhongMaterial({
      color: 0x5ab0d8,
      transparent: true,
      opacity: 0.85,
      shininess: 80,
    });
    for (const p of island.pools) {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(p.r + 0.6, 14).rotateX(-Math.PI / 2),
        this.poolMat,
      );
      disc.position.set(p.x, p.y, p.z);
      disc.renderOrder = 1;
      disc.userData['shade'] = 'receive';
      scene.add(disc);
    }
  }

  setWaterTint(day: number, bloom: boolean): void {
    const c = this.waterMat.color;
    c.setHex(this.sea).lerp(tmp.setHex(bloom ? 0x2a1830 : 0x0d2236), 1 - day);
    this.poolMat.color.setHex(0x5ab0d8).lerp(tmp.setHex(0x16304a), 1 - day);
  }

  /** Keeps chunks within `radius` of (x, z) built; builds a couple per call. */
  update(x: number, z: number, radius: number): void {
    this.water.position.x = Math.round(x / WATER_CELL) * WATER_CELL;
    this.water.position.z = Math.round(z / WATER_CELL) * WATER_CELL;
    const cx = Math.floor((x + HALF) / CHUNK);
    const cz = Math.floor((z + HALF) / CHUNK);
    const want = new Set<number>();
    for (let j = cz - radius; j <= cz + radius; j++) {
      for (let i = cx - radius; i <= cx + radius; i++) {
        if (i < 0 || j < 0 || i >= CHUNKS || j >= CHUNKS) continue;
        want.add(j * CHUNKS + i);
      }
    }
    for (const [c, m] of this.chunks) {
      if (!want.has(c)) {
        const ci = c % CHUNKS;
        const cj = Math.floor(c / CHUNKS);
        if (Math.abs(ci - cx) > radius + 1 || Math.abs(cj - cz) > radius + 1) {
          this.group.remove(m);
          m.geometry.dispose();
          this.chunks.delete(c);
        }
      }
    }
    this.queue = [...want].filter((c) => !this.chunks.has(c));
    // Nearest first.
    this.queue.sort((a, b) => dist2(a, cx, cz) - dist2(b, cx, cz));
    for (let k = 0; k < 3 && this.queue.length; k++) {
      const c = this.queue.shift() as number;
      const m = this.buildChunk(c);
      this.chunks.set(c, m);
      this.group.add(m);
    }
  }

  /** Builds every chunk within radius at once (loading screen). */
  prime(x: number, z: number, radius: number): void {
    for (let k = 0; k < 40; k++) this.update(x, z, radius);
  }

  private buildChunk(c: number): THREE.Mesh {
    const island = this.island;
    const ci = c % CHUNKS;
    const cj = Math.floor(c / CHUNKS);
    const n1 = GRID + 1;
    const pos = new Float32Array(PER * PER * 6 * 3);
    const col = new Float32Array(PER * PER * 6 * 3);
    let o = 0;
    const hAt = (i: number, j: number) =>
      island.heights[Math.min(GRID, j) * n1 + Math.min(GRID, i)] as number;
    for (let j = 0; j < PER; j++) {
      for (let i = 0; i < PER; i++) {
        const gi = ci * PER + i;
        const gj = cj * PER + j;
        const x0 = gi * CELL - HALF;
        const z0 = gj * CELL - HALF;
        const h00 = hAt(gi, gj);
        const h10 = hAt(gi + 1, gj);
        const h01 = hAt(gi, gj + 1);
        const h11 = hAt(gi + 1, gj + 1);
        const biome = island.biomes[
          Math.min(GRID - 1, gj) * GRID + Math.min(GRID - 1, gi)
        ] as number;
        const tris: [number, number, number][][] = [
          [
            [x0, h00, z0],
            [x0, h01, z0 + CELL],
            [x0 + CELL, h10, z0],
          ],
          [
            [x0 + CELL, h10, z0],
            [x0, h01, z0 + CELL],
            [x0 + CELL, h11, z0 + CELL],
          ],
        ];
        for (let t = 0; t < 2; t++) {
          const tri = tris[t] as [number, number, number][];
          const hAvg = ((tri[0]?.[1] ?? 0) + (tri[1]?.[1] ?? 0) + (tri[2]?.[1] ?? 0)) / 3;
          const slope = Math.max(Math.abs(h00 - h11), Math.abs(h10 - h01)) / CELL;
          const patch = noise2(gi * 0.09, gj * 0.09, island.seed + 33);
          const r = hash01(gi * 2 + t, gj, island.seed + 9);
          colorFor(this.ground, biome, hAvg, slope, r, patch, tmp);
          // Sun-dried patches in the meadows.
          if (biome === BIOME.meadow) {
            const dry = noise2(gi * 0.03, gj * 0.03, island.seed + 71);
            if (dry > 0.6) tmp.lerp(DRY, Math.min(0.5, (dry - 0.6) * 1.6));
          }
          for (const v of tri) {
            pos[o] = v[0];
            pos[o + 1] = v[1];
            pos[o + 2] = v[2];
            col[o] = tmp.r;
            col[o + 1] = tmp.g;
            col[o + 2] = tmp.b;
            o += 3;
          }
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.userData['shade'] = 'receive';
    return mesh;
  }
}

const blend = new THREE.Color();

/** Ground colour: soft patches of the biome's shades (noise), a touch of per-face jitter. */
function colorFor(
  ground: Ground,
  biome: number,
  h: number,
  slope: number,
  r: number,
  patch: number,
  out: THREE.Color,
): void {
  if (h < 0) {
    out.copy(ground.wetSand).lerp(deep, Math.min(1, -h / 4));
    return;
  }
  const list = ground.biomes[biome] ?? [0x888888];
  const f = Math.max(0, Math.min(0.999, patch)) * (list.length - 1);
  const i = Math.floor(f);
  out.setHex(list[i] as number).lerp(blend.setHex((list[i + 1] ?? list[i]) as number), f - i);
  if (h < 0.6 && biome !== BIOME.bog) out.lerp(ground.wetSand, 0.6);
  if (slope > 0.7) out.lerp(rockColor, Math.min(1, (slope - 0.7) * 1.5));
  out.multiplyScalar(0.95 + r * 0.1);
}

function dist2(c: number, cx: number, cz: number): number {
  const i = c % CHUNKS;
  const j = Math.floor(c / CHUNKS);
  return (i - cx) * (i - cx) + (j - cz) * (j - cz);
}
