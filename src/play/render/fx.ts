// Particles (low-poly bits), ground rings (telegraphs, blasts), thrown bombs
// and floating damage numbers.

import * as THREE from 'three';
import { MAT } from './geo';

const CAP = 700;
const dummy = new THREE.Object3D();
const col = new THREE.Color();

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  grav: number;
  spin: number;
  color: number;
  glow: boolean;
}

interface Ring {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  grow: boolean;
  pulse: boolean;
}

interface Bomb {
  mesh: THREE.Mesh;
  fx: number;
  fz: number;
  fy: number;
  tx: number;
  tz: number;
  ty: number;
  t: number;
}

export interface FloatText {
  x: number;
  y: number;
  z: number;
  text: string;
  color: string;
  life: number;
}

export class Fx {
  private readonly lit: THREE.InstancedMesh;
  private readonly glow: THREE.InstancedMesh;
  private readonly parts: Particle[] = [];
  private readonly rings: Ring[] = [];
  private readonly bombs: Bomb[] = [];
  readonly texts: FloatText[] = [];
  /** Particle count scale (graphics quality). */
  density = 1;
  private readonly scene: THREE.Scene;
  private readonly ringGeo = new THREE.RingGeometry(0.85, 1, 28).rotateX(-Math.PI / 2);
  private readonly bombGeo = new THREE.IcosahedronGeometry(0.15, 0);
  private readonly bombMat = new THREE.MeshBasicMaterial({ color: 0x9adf4a });

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const geo = new THREE.TetrahedronGeometry(0.12, 0);
    const white = new Float32Array(geo.getAttribute('position').count * 3).fill(1);
    geo.setAttribute('color', new THREE.BufferAttribute(white, 3));
    this.lit = new THREE.InstancedMesh(geo, MAT.lit, CAP);
    this.glow = new THREE.InstancedMesh(geo, MAT.glowAdd, CAP);
    for (const m of [this.lit, this.glow]) {
      m.count = 0;
      m.frustumCulled = false;
      m.setColorAt(0, col.setRGB(1, 1, 1));
      scene.add(m);
    }
  }

  burst(
    x: number,
    y: number,
    z: number,
    n: number,
    colors: number[],
    opts: {
      speed?: number;
      up?: number;
      grav?: number;
      life?: number;
      size?: number;
      glow?: boolean;
    } = {},
  ): void {
    const count = n <= 2 ? n : Math.max(1, Math.round(n * this.density));
    for (let i = 0; i < count; i++) {
      if (this.parts.length >= CAP * 2) this.parts.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed ?? 3) * (0.4 + Math.random() * 0.8);
      const life = (opts.life ?? 0.8) * (0.6 + Math.random() * 0.6);
      this.parts.push({
        x: x + (Math.random() - 0.5) * 0.3,
        y: y + Math.random() * 0.3,
        z: z + (Math.random() - 0.5) * 0.3,
        vx: Math.cos(a) * sp,
        vy: (opts.up ?? 3) * (0.5 + Math.random()),
        vz: Math.sin(a) * sp,
        life,
        max: life,
        size: (opts.size ?? 1) * (0.6 + Math.random() * 0.8),
        grav: opts.grav ?? 9,
        spin: (Math.random() - 0.5) * 12,
        color: colors[Math.floor(Math.random() * colors.length)] as number,
        glow: opts.glow ?? false,
      });
    }
  }

  ring(
    x: number,
    y: number,
    z: number,
    r: number,
    color: number,
    life: number,
    opts: { grow?: boolean; pulse?: boolean } = {},
  ): void {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.position.set(x, y + 0.08, z);
    mesh.scale.setScalar(r);
    mesh.renderOrder = 2;
    this.scene.add(mesh);
    this.rings.push({
      mesh,
      life,
      max: life,
      grow: opts.grow ?? false,
      pulse: opts.pulse ?? false,
    });
  }

  throwBomb(fx: number, fy: number, fz: number, tx: number, ty: number, tz: number): void {
    const mesh = new THREE.Mesh(this.bombGeo, this.bombMat);
    this.scene.add(mesh);
    this.bombs.push({ mesh, fx, fy, fz, tx, ty, tz, t: 0 });
  }

  text(x: number, y: number, z: number, text: string, color: string): void {
    this.texts.push({ x, y, z, text, color, life: 1 });
    if (this.texts.length > 24) this.texts.shift();
  }

  update(dt: number): void {
    let nl = 0;
    let ng = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i] as Particle;
      p.life -= dt;
      if (p.life <= 0) {
        this.parts.splice(i, 1);
        continue;
      }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vx *= 0.97;
      p.vz *= 0.97;
      const k = p.life / p.max;
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.spin * p.life, p.spin * p.life * 0.7, 0);
      dummy.scale.setScalar(p.size * (p.glow ? 0.4 + k : 0.5 + k * 0.5));
      dummy.updateMatrix();
      col.setHex(p.color);
      if (p.glow && ng < CAP) {
        this.glow.setMatrixAt(ng, dummy.matrix);
        this.glow.setColorAt(ng, col);
        ng++;
      } else if (!p.glow && nl < CAP) {
        this.lit.setMatrixAt(nl, dummy.matrix);
        this.lit.setColorAt(nl, col);
        nl++;
      }
    }
    this.lit.count = nl;
    this.glow.count = ng;
    for (const m of [this.lit, this.glow]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i] as Ring;
      r.life -= dt;
      const mat = r.mesh.material as THREE.MeshBasicMaterial;
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        mat.dispose();
        this.rings.splice(i, 1);
        continue;
      }
      const k = r.life / r.max;
      mat.opacity = r.pulse ? 0.45 + Math.sin(r.life * 18) * 0.35 : 0.8 * k;
      if (r.grow) r.mesh.scale.multiplyScalar(1 + dt * 1.5);
    }
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i] as Bomb;
      b.t += dt / 0.55;
      if (b.t >= 1) {
        this.scene.remove(b.mesh);
        this.bombs.splice(i, 1);
        continue;
      }
      const t = b.t;
      b.mesh.position.set(
        b.fx + (b.tx - b.fx) * t,
        b.fy + (b.ty - b.fy) * t + Math.sin(t * Math.PI) * 3,
        b.fz + (b.tz - b.fz) * t,
      );
      b.mesh.rotation.x += dt * 10;
      this.burst(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z, 1, [0xffa53a, 0xd6ff6a], {
        speed: 0.3,
        up: 0.3,
        grav: 0,
        life: 0.3,
        size: 0.6,
        glow: true,
      });
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i] as FloatText;
      t.life -= dt;
      t.y += dt * 1.2;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }
}

export const FX_COLORS = {
  wood: [0x8a5f3a, 0x6b4a2a, 0xa07040],
  leaf: [0x4a9a3c, 0x5fae3c, 0x3a7a30],
  stone: [0x8a8c90, 0x6e7075, 0xa0a2a6],
  spark: [0xffe07a, 0xffffff],
  sap: [0xb6ff5a, 0x8adf3a, 0xd6ff6a],
  spore: [0x9a6ac8, 0xd6ff6a, 0x7a4aa8],
  fire: [0xff7a2a, 0xffc04a, 0xfff0a0],
  smoke: [0x3a3a3a, 0x555555],
  blood: [0xd04040, 0xa02828],
  heal: [0x6cff9f, 0xffffff],
  water: [0x6ad0ff, 0xffffff],
  gold: [0xffe07a, 0xfff6c0],
  dust: [0xb8a888, 0x9a8a6a],
  sand: [0xe8d8a8, 0xd8c890],
  metal: [0xb0b6bd, 0x6d737a, 0xe8ecef],
};
