// What the weather looks like: rain streaks falling around the camera and lightning
// bolts. The view blends the sky, sun and fog itself (view.ts updateLighting).

import * as THREE from 'three';
import type { WeatherKind } from '../../game/sim/weather';

/** How each weather looks: clouds dim the sun, rain falls, fog closes in (0..1 each). */
export const WEATHER_LOOK: Record<WeatherKind, { cloud: number; rain: number; fog: number }> = {
  clear: { cloud: 0, rain: 0, fog: 0 },
  cloudy: { cloud: 0.6, rain: 0, fog: 0.1 },
  rain: { cloud: 0.85, rain: 0.6, fog: 0.3 },
  storm: { cloud: 1, rain: 1, fog: 0.45 },
  fog: { cloud: 0.45, rain: 0, fog: 1 },
};

const BOX = 46;
const TOP = 24;
const FALL = 22;

/** Streaks of rain in a box that follows the camera's focus. */
export class Rain {
  private readonly mesh: THREE.InstancedMesh;
  private readonly at: Float32Array;
  private readonly cap: number;
  private max: number;
  private seed = 1;
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);

  constructor(scene: THREE.Scene, cap = 1600) {
    this.cap = cap;
    this.max = cap;
    const geo = new THREE.BoxGeometry(0.05, 1.1, 0.05);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xb8d0ec,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.userData['shade'] = 'none';
    this.at = new Float32Array(cap * 3);
    for (let i = 0; i < cap; i++) {
      this.at[i * 3] = (this.rand() - 0.5) * BOX;
      this.at[i * 3 + 1] = this.rand() * TOP;
      this.at[i * 3 + 2] = (this.rand() - 0.5) * BOX;
    }
    scene.add(this.mesh);
  }

  /** Most drops shown at once (graphics quality). */
  setMax(n: number): void {
    this.max = Math.min(this.cap, n);
  }

  private rand(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** `amount` 0..1 of the drops fall; `wind` slants them (storms). */
  update(dt: number, focus: THREE.Vector3, ground: number, amount: number, wind: number): void {
    const n = Math.floor(this.max * amount);
    this.mesh.count = n;
    if (n === 0) return;
    // A slanted fall in storms.
    this.q.setFromAxisAngle(this.v.set(0, 0, 1), -wind * 0.035);
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      let y = (this.at[k + 1] as number) - FALL * dt;
      let x = (this.at[k] as number) + wind * dt;
      if (y < 0) {
        y += TOP;
        x = (this.rand() - 0.5) * BOX;
        this.at[k + 2] = (this.rand() - 0.5) * BOX;
      }
      if (x > BOX / 2) x -= BOX;
      this.at[k] = x;
      this.at[k + 1] = y;
      this.v.set(focus.x + x, ground + y, focus.z + (this.at[k + 2] as number));
      this.m4.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m4);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.removeFromParent();
  }
}

/** A jagged bolt from the clouds down to (x, y, z), gone in a blink. */
export function lightningBolt(x: number, y: number, z: number, seed: number): THREE.LineSegments {
  const pts: number[] = [];
  let px = x;
  let pz = z;
  let py = y + 42;
  let s = seed >>> 0 || 1;
  const r = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296 - 0.5;
  };
  while (py > y) {
    const ny = Math.max(y, py - 3 - Math.abs(r()) * 4);
    const nx = ny === y ? x : px + r() * 4;
    const nz = ny === y ? z : pz + r() * 4;
    pts.push(px, py, pz, nx, ny, nz);
    px = nx;
    py = ny;
    pz = nz;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const line = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: 0xeef4ff, transparent: true, fog: false }),
  );
  line.frustumCulled = false;
  return line;
}
