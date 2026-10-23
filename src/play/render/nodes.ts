// Harvestable nodes drawn as one InstancedMesh per type, refilled when the
// player moves to another chunk or a node is harvested/regrows.

import * as THREE from 'three';
import { NODE, NODES } from '../../game/content/nodes';
import { CHUNK, CHUNKS, HALF, forNodesNear, heightAt, type Island } from '../../game/world';
import { MAT } from './geo';
import { nodeGeometries, nodeScale, nodeTint } from './props';
import { windy } from './wind';

const CAP = 2600;
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const v3 = new THREE.Vector3();
const s3 = new THREE.Vector3();
const color = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const TREES: number[] = [NODE.palm, NODE.jungle, NODE.pine];
const FADE_CAP = 48;
const FADE_BASE = new THREE.MeshLambertMaterial({
  vertexColors: true,
  flatShading: true,
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
});
/** How much each kind of plant sways in the wind. */
const SWAY: Partial<Record<number, number>> = {
  [NODE.palm]: 0.005,
  [NODE.jungle]: 0.003,
  [NODE.pine]: 0.0035,
  [NODE.bush]: 0.05,
  [NODE.berry]: 0.05,
  [NODE.vines]: 0.02,
};

export class NodeView {
  private readonly island: Island;
  private readonly meshes: THREE.InstancedMesh[] = [];
  /** node id → [type, instance index] for the current fill. */
  private readonly slots = new Map<number, [number, number]>();
  private centre = -1;
  private dirty = true;
  private readonly shakes = new Map<number, number>();
  /** Heights cached per node (terrain lookups are not free). */
  private readonly y: Float32Array;
  /** See-through copies of trees standing between the camera and the survivor. */
  private readonly fadeMeshes: THREE.InstancedMesh[] = [];
  private faded = new Set<number>();
  private fadeKey = '';

  constructor(
    island: Island,
    scene: THREE.Scene,
    private readonly isGone: (id: number) => boolean,
  ) {
    this.island = island;
    this.y = new Float32Array(island.nodeCount).fill(Number.NaN);
    nodeGeometries().forEach((geo, type) => {
      const sway = SWAY[type];
      const m = new THREE.InstancedMesh(geo, sway ? windy(MAT.lit, sway) : MAT.lit, CAP);
      m.count = 0;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, color.setRGB(1, 1, 1));
      this.meshes[type] = m;
      scene.add(m);
      if (TREES.includes(type)) {
        const f = new THREE.InstancedMesh(geo, windy(FADE_BASE, sway ?? 0), FADE_CAP);
        f.count = 0;
        f.frustumCulled = false;
        f.renderOrder = 2;
        f.setColorAt(0, color.setRGB(1, 1, 1));
        this.fadeMeshes[type] = f;
        scene.add(f);
      }
    });
  }

  markDirty(): void {
    this.dirty = true;
  }

  /** A hit: the node wobbles for a moment. */
  shake(id: number): void {
    this.shakes.set(id, 0.35);
  }

  update(x: number, z: number, radius: number, dt: number): void {
    const cx = Math.floor((x + HALF) / CHUNK);
    const cz = Math.floor((z + HALF) / CHUNK);
    const centre = cz * CHUNKS + cx;
    let refilled = false;
    if (centre !== this.centre || this.dirty) {
      this.centre = centre;
      this.dirty = false;
      this.fill(cx, cz, radius);
      refilled = true;
    }
    this.updateFade(x, z, refilled);
    for (const [id, t] of this.shakes) {
      if (this.faded.has(id)) {
        this.shakes.delete(id);
        continue;
      }
      const left = t - dt;
      const slot = this.slots.get(id);
      if (!slot) {
        this.shakes.delete(id);
        continue;
      }
      if (left <= 0) this.shakes.delete(id);
      else this.shakes.set(id, left);
      const [type, idx] = slot;
      const mesh = this.meshes[type];
      if (!mesh) continue;
      this.matrixFor(id, type, Math.max(0, left) * Math.sin(left * 60) * 0.25);
      mesh.setMatrixAt(idx, m4);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private nodeY(id: number): number {
    let y = this.y[id] as number;
    if (Number.isNaN(y)) {
      y = heightAt(this.island, this.island.nodeX[id] as number, this.island.nodeZ[id] as number);
      this.y[id] = y;
    }
    return y;
  }

  private matrixFor(id: number, type: number, tilt: number): void {
    const v = this.island.nodeVar[id] as number;
    q.setFromAxisAngle(up, (v / 255) * Math.PI * 2);
    if (tilt) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt));
    const s = nodeScale(type, v);
    m4.compose(
      v3.set(this.island.nodeX[id] as number, this.nodeY(id), this.island.nodeZ[id] as number),
      q,
      s3.set(s, s, s),
    );
  }

  private fill(cx: number, cz: number, radius: number): void {
    this.slots.clear();
    const counts = new Array<number>(this.meshes.length).fill(0);
    for (let j = cz - radius; j <= cz + radius; j++) {
      for (let i = cx - radius; i <= cx + radius; i++) {
        if (i < 0 || j < 0 || i >= CHUNKS || j >= CHUNKS) continue;
        const c = j * CHUNKS + i;
        const end = this.island.chunkStart[c + 1] as number;
        for (let id = this.island.chunkStart[c] as number; id < end; id++) {
          if (this.isGone(id)) continue;
          const type = this.island.nodeType[id] as number;
          const mesh = this.meshes[type];
          if (!mesh) continue;
          const idx = counts[type] as number;
          if (idx >= CAP) continue;
          this.matrixFor(id, type, 0);
          mesh.setMatrixAt(idx, m4);
          mesh.setColorAt(idx, nodeTint(type, this.island.nodeVar[id] as number, color));
          this.slots.set(id, [type, idx]);
          counts[type] = idx + 1;
        }
      }
    }
    this.meshes.forEach((mesh, type) => {
      mesh.count = counts[type] ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }

  /** Trees between the camera (south, above) and the survivor turn see-through. */
  private updateFade(x: number, z: number, force: boolean): void {
    const key = `${Math.round(x * 2)}|${Math.round(z * 2)}`;
    if (!force && key === this.fadeKey) return;
    this.fadeKey = key;
    const want = new Set<number>();
    forNodesNear(this.island, x, z + 3.5, 7.5, (id) => {
      const type = this.island.nodeType[id] as number;
      if (!TREES.includes(type) || !this.slots.has(id)) return;
      const dx = (this.island.nodeX[id] as number) - x;
      const dz = (this.island.nodeZ[id] as number) - z;
      if (dz > -2.5 && dz < 9.5 && Math.abs(dx) < 3.4) want.add(id);
    });
    for (const id of this.faded) {
      if (want.has(id)) continue;
      const slot = this.slots.get(id);
      if (!slot) continue;
      const [type, idx] = slot;
      this.matrixFor(id, type, 0);
      this.meshes[type]?.setMatrixAt(idx, m4);
    }
    const counts: number[] = [];
    for (const id of want) {
      const [type, idx] = this.slots.get(id) as [number, number];
      const main = this.meshes[type];
      main?.setMatrixAt(idx, ZERO);
      const f = this.fadeMeshes[type];
      const n = counts[type] ?? 0;
      if (!f || n >= FADE_CAP) continue;
      this.matrixFor(id, type, 0);
      f.setMatrixAt(n, m4);
      f.setColorAt(n, nodeTint(type, this.island.nodeVar[id] as number, color));
      counts[type] = n + 1;
    }
    this.faded = want;
    for (const type of TREES) {
      const main = this.meshes[type];
      if (main) main.instanceMatrix.needsUpdate = true;
      const f = this.fadeMeshes[type];
      if (!f) continue;
      f.count = counts[type] ?? 0;
      f.instanceMatrix.needsUpdate = true;
      if (f.instanceColor) f.instanceColor.needsUpdate = true;
    }
  }

  geometry(type: number): THREE.BufferGeometry | null {
    return this.meshes[type]?.geometry ?? null;
  }

  /** Where a node stands and how it's turned and sized (for a falling tree). */
  pose(id: number, out: THREE.Matrix4): THREE.Matrix4 {
    this.matrixFor(id, this.island.nodeType[id] as number, 0);
    return out.copy(m4);
  }

  /** Is this node currently drawn (inside the fill radius)? */
  has(id: number): boolean {
    return this.slots.has(id);
  }

  name(id: number): string {
    return NODES[this.island.nodeType[id] as number]?.name ?? '';
  }
}
