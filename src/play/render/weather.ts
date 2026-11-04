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
const SPLASHES = 260;

/** A splash: a ring that spreads and fades where a drop lands (wider on water). */
const SPLASH_VERT = `
attribute float aLife;
varying float vLife;
varying vec2 vRing;
void main() {
  vLife = aLife;
  vRing = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const SPLASH_FRAG = `
uniform vec3 uColor;
varying float vLife;
varying vec2 vRing;
void main() {
  float r = length(vRing);
  float ring = smoothstep(0.55, 0.85, r) * (1.0 - smoothstep(0.85, 1.0, r));
  float a = ring * (1.0 - vLife) * 0.7;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}`;

/** Streaks of rain in a box that follows the camera's focus, and splashes where they land. */
export class Rain {
  private readonly mesh: THREE.InstancedMesh;
  private readonly at: Float32Array;
  private readonly len: Float32Array;
  private readonly cap: number;
  private max: number;
  private seed = 1;
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly splash: THREE.InstancedMesh;
  private readonly life: THREE.InstancedBufferAttribute;
  /** Each splash: x, y, z, age, how long it lasts, how wide it gets. */
  private readonly sp = new Float32Array(SPLASHES * 6);
  private next = 0;
  private readonly splashMat: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene, cap = 1600) {
    this.cap = cap;
    this.max = cap;
    const geo = new THREE.BoxGeometry(0.035, 1, 0.035);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xc4d8f0,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.userData['shade'] = 'none';
    this.at = new Float32Array(cap * 3);
    this.len = new Float32Array(cap);
    const tint = new THREE.Color();
    for (let i = 0; i < cap; i++) {
      this.at[i * 3] = (this.rand() - 0.5) * BOX;
      this.at[i * 3 + 1] = this.rand() * TOP;
      this.at[i * 3 + 2] = (this.rand() - 0.5) * BOX;
      this.len[i] = 0.7 + this.rand() * 0.9;
      this.mesh.setColorAt(i, tint.setScalar(0.65 + this.rand() * 0.35));
    }
    scene.add(this.mesh);

    const ring = new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
    this.splashMat = new THREE.ShaderMaterial({
      vertexShader: SPLASH_VERT,
      fragmentShader: SPLASH_FRAG,
      uniforms: { uColor: { value: new THREE.Color(0xdfeaff) } },
      transparent: true,
      depthWrite: false,
    });
    this.splash = new THREE.InstancedMesh(ring, this.splashMat, SPLASHES);
    this.life = new THREE.InstancedBufferAttribute(new Float32Array(SPLASHES).fill(1), 1);
    this.life.setUsage(THREE.DynamicDrawUsage);
    ring.setAttribute('aLife', this.life);
    this.splash.frustumCulled = false;
    this.splash.count = 0;
    this.splash.renderOrder = 2;
    this.splash.userData['shade'] = 'none';
    for (let i = 0; i < SPLASHES; i++) this.sp[i * 6 + 3] = 99;
    scene.add(this.splash);
  }

  /** Most drops shown at once (graphics quality). */
  setMax(n: number): void {
    this.max = Math.min(this.cap, n);
  }

  /** Splashes dim with the light (they aren't lit). */
  setLight(k: number): void {
    this.splashMat.uniforms['uColor']?.value.setRGB(0.55 + 0.4 * k, 0.6 + 0.4 * k, 0.68 + 0.32 * k);
  }

  private rand(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /**
   * `amount` 0..1 of the drops fall; `wind` (m/s) slants them; `groundAt` is the ground's
   * height (below 0: the sea, where drops leave wider rings on the water).
   */
  update(
    dt: number,
    focus: THREE.Vector3,
    ground: number,
    amount: number,
    wind: number,
    groundAt: (x: number, z: number) => number,
  ): void {
    const n = Math.floor(this.max * amount);
    this.mesh.count = n;
    // Drops that land this frame leave a splash now and then (more in a downpour).
    const splashOdds = Math.min(0.5, 0.15 + amount * 0.35);
    // The fall slants with the wind.
    this.q.setFromAxisAngle(this.v.set(0, 0, 1), -Math.atan2(wind, FALL));
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      let y = (this.at[k + 1] as number) - FALL * dt;
      let x = (this.at[k] as number) + wind * dt;
      if (y < 0) {
        if (this.rand() < splashOdds)
          this.addSplash(focus.x + x, focus.z + (this.at[k + 2] as number), groundAt);
        y += TOP;
        x = (this.rand() - 0.5) * BOX;
        this.at[k + 2] = (this.rand() - 0.5) * BOX;
      }
      if (x > BOX / 2) x -= BOX;
      if (x < -BOX / 2) x += BOX;
      this.at[k] = x;
      this.at[k + 1] = y;
      this.v.set(focus.x + x, ground + y, focus.z + (this.at[k + 2] as number));
      this.s.set(1, this.len[i] as number, 1);
      this.m4.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m4);
    }
    if (n) this.mesh.instanceMatrix.needsUpdate = true;
    this.updateSplashes(dt);
  }

  private addSplash(x: number, z: number, groundAt: (x: number, z: number) => number): void {
    const h = groundAt(x, z);
    const water = h < -0.05;
    const o = this.next * 6;
    this.next = (this.next + 1) % SPLASHES;
    this.sp[o] = x;
    this.sp[o + 1] = water ? 0.02 : h + 0.04;
    this.sp[o + 2] = z;
    this.sp[o + 3] = 0;
    this.sp[o + 4] = water ? 0.7 : 0.28;
    this.sp[o + 5] = water ? 0.55 : 0.22;
  }

  private updateSplashes(dt: number): void {
    let live = 0;
    for (let i = 0; i < SPLASHES; i++) {
      const o = i * 6;
      const age = (this.sp[o + 3] as number) + dt;
      this.sp[o + 3] = age;
      const t = age / (this.sp[o + 4] as number);
      if (t >= 1) continue;
      const r = (this.sp[o + 5] as number) * (0.25 + t * 0.75);
      this.v.set(this.sp[o] as number, this.sp[o + 1] as number, this.sp[o + 2] as number);
      this.m4.makeScale(r, 1, r).setPosition(this.v);
      this.splash.setMatrixAt(live, this.m4);
      this.life.setX(live, t);
      live++;
    }
    this.splash.count = live;
    if (live) {
      this.splash.instanceMatrix.needsUpdate = true;
      this.life.needsUpdate = true;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.removeFromParent();
    this.splash.geometry.dispose();
    this.splashMat.dispose();
    this.splash.removeFromParent();
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
