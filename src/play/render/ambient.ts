// Life around the survivor, drawn only on this device: grass that sways and
// parts as you walk through it, birds that peck on the ground and scatter when
// you come close (or something big happens), flocks passing over, butterflies by
// day, fireflies at night, and pink spores drifting on Bloom nights.

import * as THREE from 'three';
import { POIS } from '../../game/content/pois';
import { hash01 } from '../../game/rng';
import {
  BIOME,
  CHUNK,
  CHUNKS,
  HALF,
  biomeAt,
  heightAt,
  hitCollider,
  poolNear,
  type Island,
} from '../../game/world';
import { WIND } from './wind';

interface GrassKind {
  density: number;
  colors: number[];
  h: [number, number];
}

const GRASS: Partial<Record<number, GrassKind>> = {
  [BIOME.meadow]: { density: 1, colors: [0x6fb045, 0x82c24f, 0x5e9d3a], h: [0.35, 0.7] },
  [BIOME.jungle]: { density: 0.8, colors: [0x2f7a35, 0x3d8c3f, 0x4a9b45], h: [0.45, 0.95] },
  [BIOME.forest]: { density: 0.45, colors: [0x4c7a3e, 0x5b8a46], h: [0.3, 0.55] },
  [BIOME.highland]: { density: 0.35, colors: [0xa3a35a, 0x8f9a52], h: [0.25, 0.45] },
  [BIOME.bog]: { density: 0.9, colors: [0x5f7a3a, 0x6f8a3e, 0x7a6a3a], h: [0.55, 1.05] },
  [BIOME.beach]: { density: 0.06, colors: [0x9fb060, 0xb0b870], h: [0.3, 0.5] },
};

const tmp = new THREE.Color();
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v3 = new THREE.Vector3();
const s3 = new THREE.Vector3();

function grassMaterial(player: { value: THREE.Vector3 }): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms['uWindTime'] = WIND;
    shader.uniforms['uPlayer'] = player;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aTip;\nuniform float uWindTime;\nuniform vec3 uPlayer;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  float gp = uWindTime * 2.1 + position.x * 0.35 + position.z * 0.3;
  transformed.x += (sin(gp) * 0.6 + sin(gp * 2.7 + 1.3) * 0.25) * aTip * 0.13;
  transformed.z += cos(gp * 0.9) * 0.08 * aTip;
  vec2 away = position.xz - uPlayer.xz;
  float dd = length(away);
  float push = (1.0 - smoothstep(0.2, 1.5, dd)) * aTip;
  transformed.xz += away / max(dd, 0.001) * push * 0.4;
  transformed.y -= push * 0.25;`,
      );
    // Both faces lit like the top (two-sided blades would go black from behind).
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      '#include <normal_fragment_begin>\n  normal = normalize(vNormal);',
    );
  };
  return m;
}

/** One 32 m chunk of grass as a single mesh (blades in world coordinates). */
function buildGrass(
  island: Island,
  c: number,
  perChunk: number,
  mat: THREE.Material,
): THREE.Mesh | null {
  const cx = c % CHUNKS;
  const cz = Math.floor(c / CHUNKS);
  const x0 = cx * CHUNK - HALF;
  const z0 = cz * CHUNK - HALF;
  const pos: number[] = [];
  const col: number[] = [];
  const tip: number[] = [];
  const seed = island.seed + 977;
  for (let k = 0; k < perChunk; k++) {
    const x = x0 + hash01(c, k, seed) * CHUNK;
    const z = z0 + hash01(k, c, seed + 1) * CHUNK;
    const kind = GRASS[biomeAt(island, x, z)];
    if (!kind || hash01(k, c, seed + 2) > kind.density) continue;
    const y = heightAt(island, x, z);
    if (y < 0.25 || poolNear(island, x, z, 0.5) || hitCollider(island, x, z, 0.3)) continue;
    if (POIS.some((p) => Math.hypot(p.x - x, p.z - z) < p.flat * 0.85)) continue;
    const blades = 3 + Math.floor(hash01(c, k, seed + 3) * 3);
    const color = kind.colors[Math.floor(hash01(k, c, seed + 4) * kind.colors.length)] as number;
    for (let b = 0; b < blades; b++) {
      const a = hash01(k * 7 + b, c, seed + 5) * Math.PI * 2;
      const r = hash01(c, k * 7 + b, seed + 6) * 0.25;
      const bx = x + Math.sin(a) * r;
      const bz = z + Math.cos(a) * r;
      const h = kind.h[0] + hash01(k, b + c, seed + 7) * (kind.h[1] - kind.h[0]);
      const lean = 0.08 + hash01(b, k + c, seed + 8) * 0.18;
      const wa = a + Math.PI / 2;
      const w = 0.05 + hash01(c + b, k, seed + 9) * 0.04;
      const by = y - 0.02;
      // Two base corners and a leaning tip.
      pos.push(bx - Math.sin(wa) * w, by, bz - Math.cos(wa) * w);
      pos.push(bx + Math.sin(wa) * w, by, bz + Math.cos(wa) * w);
      pos.push(bx + Math.sin(a) * lean, by + h, bz + Math.cos(a) * lean);
      tmp.setHex(color);
      const dark = 0.62;
      const lite = 1.12 + hash01(b, c, seed + 10) * 0.15;
      col.push(tmp.r * dark, tmp.g * dark, tmp.b * dark);
      col.push(tmp.r * dark, tmp.g * dark, tmp.b * dark);
      col.push(tmp.r * lite, tmp.g * lite, tmp.b * lite);
      tip.push(0, 0, 1);
    }
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aTip', new THREE.Float32BufferAttribute(tip, 1));
  const normals = new Float32Array(pos.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.matrixAutoUpdate = false;
  return mesh;
}

// ---------------------------------------------------------------------------
// Critters.

interface Bird {
  ox: number;
  oz: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ry: number;
  phase: number;
  peck: number;
}

interface Flock {
  birds: Bird[];
  x: number;
  z: number;
  flying: boolean;
  /** Seconds left in the air before it's gone. */
  t: number;
  gull: boolean;
}

interface Bug {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  phase: number;
  color: number;
  life: number;
}

const BIRD_CAP = 64;
const BUG_CAP = 48;

function wingGeo(side: 1 | -1): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0,
        0,
        0.07,
        side * 0.32,
        0,
        -0.02,
        0,
        0,
        -0.09,
        0,
        0,
        0.07,
        0,
        0,
        -0.09,
        side * 0.32,
        0,
        -0.02,
      ],
      3,
    ),
  );
  g.computeVertexNormals();
  return g;
}

export class Ambient {
  private readonly island: Island;
  private readonly scene: THREE.Scene;
  private readonly grassMat: THREE.MeshLambertMaterial;
  private readonly player = { value: new THREE.Vector3() };
  private readonly grass = new Map<number, THREE.Mesh | null>();
  private perChunk = 0;
  private enabled = true;
  private readonly bodies: THREE.InstancedMesh;
  private readonly wingsL: THREE.InstancedMesh;
  private readonly wingsR: THREE.InstancedMesh;
  private readonly bugWings: THREE.InstancedMesh;
  private readonly glows: THREE.InstancedMesh;
  private flocks: Flock[] = [];
  private bugs: Bug[] = [];
  private lights: Bug[] = [];
  private spawnAcc = 0;
  private overAcc = 20;

  constructor(island: Island, scene: THREE.Scene) {
    this.island = island;
    this.scene = scene;
    this.grassMat = grassMaterial(this.player);
    const lit = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    this.bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.08, 0.22), lit, BIRD_CAP);
    this.wingsL = new THREE.InstancedMesh(wingGeo(-1), lit, BIRD_CAP);
    this.wingsR = new THREE.InstancedMesh(wingGeo(1), lit, BIRD_CAP);
    const bug = new THREE.BufferGeometry();
    bug.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [0, 0, 0, -0.12, 0, 0.07, -0.1, 0, -0.08, 0, 0, 0, 0.1, 0, -0.08, 0.12, 0, 0.07],
        3,
      ),
    );
    bug.computeVertexNormals();
    this.bugWings = new THREE.InstancedMesh(
      bug,
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      BUG_CAP,
    );
    this.glows = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.06, 0),
      new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      BUG_CAP,
    );
    for (const m of [this.bodies, this.wingsL, this.wingsR, this.bugWings, this.glows]) {
      m.count = 0;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, tmp.setRGB(1, 1, 1));
      scene.add(m);
    }
  }

  /** Grass tufts per chunk (0 = none) and whether any of this is drawn. */
  configure(perChunk: number, enabled: boolean): void {
    this.enabled = enabled;
    const want = enabled ? perChunk : 0;
    if (want !== this.perChunk) {
      this.perChunk = want;
      for (const m of this.grass.values()) this.dropGrass(m);
      this.grass.clear();
    }
    if (!enabled) {
      this.flocks = [];
      this.bugs = [];
      this.lights = [];
    }
  }

  private dropGrass(m: THREE.Mesh | null): void {
    if (!m) return;
    this.scene.remove(m);
    m.geometry.dispose();
  }

  /** Something loud happened here: birds nearby take off. */
  scare(x: number, z: number, r: number): void {
    for (const f of this.flocks) {
      if (!f.flying && Math.hypot(f.x - x, f.z - z) < r) this.takeOff(f, x, z);
    }
  }

  private takeOff(f: Flock, fromX: number, fromZ: number): void {
    f.flying = true;
    f.t = 9;
    const dx = f.x - fromX;
    const dz = f.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    for (const b of f.birds) {
      const spread = (Math.random() - 0.5) * 0.9;
      const a = Math.atan2(dx / d, dz / d) + spread;
      const sp = 5 + Math.random() * 3;
      b.vx = Math.sin(a) * sp;
      b.vz = Math.cos(a) * sp;
      b.vy = 2.5 + Math.random() * 2;
      b.ry = a;
    }
  }

  update(
    dt: number,
    t: number,
    px: number,
    pz: number,
    day: number,
    bloom: boolean,
    danger: { x: number; z: number }[],
  ): void {
    this.player.value.set(px, heightAt(this.island, px, pz), pz);
    this.updateGrass(px, pz);
    if (!this.enabled) {
      for (const m of [this.bodies, this.wingsL, this.wingsR, this.bugWings, this.glows])
        m.count = 0;
      return;
    }
    this.spawnAcc += dt;
    if (this.spawnAcc > 1) {
      this.spawnAcc = 0;
      this.spawn(px, pz, day, bloom);
    }
    this.overAcc -= dt;
    if (this.overAcc <= 0) {
      this.overAcc = 25 + Math.random() * 35;
      if (day > 0.6) this.overfly(px, pz);
    }
    this.updateBirds(dt, t, px, pz, danger);
    this.updateBugs(dt, t, px, pz, day, bloom);
  }

  private updateGrass(px: number, pz: number): void {
    const cx = Math.floor((px + HALF) / CHUNK);
    const cz = Math.floor((pz + HALF) / CHUNK);
    const want = new Set<number>();
    if (this.perChunk > 0) {
      for (let j = cz - 1; j <= cz + 1; j++)
        for (let i = cx - 1; i <= cx + 1; i++)
          if (i >= 0 && j >= 0 && i < CHUNKS && j < CHUNKS) want.add(j * CHUNKS + i);
    }
    for (const [c, m] of this.grass) {
      if (want.has(c)) continue;
      this.dropGrass(m);
      this.grass.delete(c);
    }
    // One new chunk per frame at most, nearest first, so walking never stutters.
    let best = -1;
    let bd = Infinity;
    for (const c of want) {
      if (this.grass.has(c)) continue;
      const d = Math.abs((c % CHUNKS) - cx) + Math.abs(Math.floor(c / CHUNKS) - cz);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    if (best >= 0) {
      const m = buildGrass(this.island, best, this.perChunk, this.grassMat);
      if (m) this.scene.add(m);
      this.grass.set(best, m);
    }
  }

  private spawn(px: number, pz: number, day: number, bloom: boolean): void {
    // Birds on the ground ahead, by day.
    this.flocks = this.flocks.filter((f) =>
      f.flying ? f.t > 0 : Math.hypot(f.x - px, f.z - pz) < 60,
    );
    const perched = this.flocks.filter((f) => !f.flying).length;
    if (day > 0.6 && perched < 2 && this.birdCount() < BIRD_CAP - 8 && Math.random() < 0.3) {
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 16;
      const x = px + Math.sin(a) * r;
      const z = pz + Math.cos(a) * r;
      const biome = biomeAt(this.island, x, z);
      const h = heightAt(this.island, x, z);
      if (
        h > 0.2 &&
        (biome === BIOME.meadow || biome === BIOME.beach || biome === BIOME.highland) &&
        !hitCollider(this.island, x, z, 1)
      ) {
        const n = 3 + Math.floor(Math.random() * 5);
        const birds: Bird[] = [];
        for (let i = 0; i < n; i++) {
          const ox = (Math.random() - 0.5) * 3;
          const oz = (Math.random() - 0.5) * 3;
          birds.push({
            ox,
            oz,
            x: x + ox,
            y: heightAt(this.island, x + ox, z + oz),
            z: z + oz,
            vx: 0,
            vy: 0,
            vz: 0,
            ry: Math.random() * Math.PI * 2,
            phase: Math.random() * 10,
            peck: Math.random() * 3,
          });
        }
        this.flocks.push({ birds, x, z, flying: false, t: 0, gull: biome === BIOME.beach });
      }
    }
    // Butterflies by day, fireflies (or Bloom spores) by night.
    this.bugs = this.bugs.filter((b) => b.life > 0 && Math.hypot(b.x - px, b.z - pz) < 30);
    this.lights = this.lights.filter((b) => b.life > 0 && Math.hypot(b.x - px, b.z - pz) < 30);
    if (day > 0.5 && this.bugs.length < 10) {
      for (let k = 0; k < 2; k++) {
        const x = px + (Math.random() - 0.5) * 36;
        const z = pz + (Math.random() - 0.5) * 36;
        const biome = biomeAt(this.island, x, z);
        if (biome !== BIOME.meadow && biome !== BIOME.jungle && biome !== BIOME.forest) continue;
        if (heightAt(this.island, x, z) < 0.3) continue;
        const colors = [0xffd84a, 0xffffff, 0xff9a3a, 0x6ac8ff, 0xd88aff];
        this.bugs.push({
          x,
          y: 0.6 + Math.random() * 0.8,
          z,
          vx: 0,
          vz: 0,
          phase: Math.random() * 10,
          color: colors[Math.floor(Math.random() * colors.length)] as number,
          life: 20 + Math.random() * 20,
        });
      }
    }
    if (day < 0.4 && this.lights.length < (bloom ? 40 : 26)) {
      for (let k = 0; k < 3; k++) {
        const x = px + (Math.random() - 0.5) * 40;
        const z = pz + (Math.random() - 0.5) * 40;
        if (heightAt(this.island, x, z) < 0.1 && !bloom) continue;
        const biome = biomeAt(this.island, x, z);
        if (!bloom && biome === BIOME.beach) continue;
        this.lights.push({
          x,
          y: 0.5 + Math.random() * 1.6,
          z,
          vx: (Math.random() - 0.5) * 0.4,
          vz: (Math.random() - 0.5) * 0.4,
          phase: Math.random() * 10,
          color: bloom ? 0xff5ab0 : 0xd8ff6a,
          life: 15 + Math.random() * 15,
        });
      }
    }
  }

  /** A flock passing high over the island. */
  private overfly(px: number, pz: number): void {
    if (this.birdCount() > BIRD_CAP - 10) return;
    const a = Math.random() * Math.PI * 2;
    const sx = px - Math.sin(a) * 45;
    const sz = pz - Math.cos(a) * 45;
    const n = 5 + Math.floor(Math.random() * 5);
    const birds: Bird[] = [];
    for (let i = 0; i < n; i++) {
      // A loose V.
      const side = i % 2 ? 1 : -1;
      const row = Math.ceil(i / 2);
      const ox = Math.cos(a) * side * row * 1.2;
      const oz = -Math.sin(a) * side * row * 1.2;
      birds.push({
        ox,
        oz,
        x: sx + ox - Math.sin(a) * row,
        y: 13 + Math.random() * 2,
        z: sz + oz - Math.cos(a) * row,
        vx: Math.sin(a) * 7,
        vy: 0,
        vz: Math.cos(a) * 7,
        ry: a,
        phase: Math.random() * 10,
        peck: 0,
      });
    }
    this.flocks.push({ birds, x: sx, z: sz, flying: true, t: 14, gull: false });
  }

  private birdCount(): number {
    let n = 0;
    for (const f of this.flocks) n += f.birds.length;
    return n;
  }

  private updateBirds(
    dt: number,
    t: number,
    px: number,
    pz: number,
    danger: { x: number; z: number }[],
  ): void {
    let n = 0;
    for (const f of this.flocks) {
      if (!f.flying) {
        if (Math.hypot(f.x - px, f.z - pz) < 8) this.takeOff(f, px, pz);
        else
          for (const d of danger)
            if (Math.hypot(f.x - d.x, f.z - d.z) < 7) {
              this.takeOff(f, d.x, d.z);
              break;
            }
      } else {
        f.t -= dt;
      }
      for (const b of f.birds) {
        if (n >= BIRD_CAP) break;
        let flap = 0;
        let tilt = 0;
        if (f.flying) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.z += b.vz * dt;
          b.vy = Math.max(0.2, b.vy - dt * 0.6);
          flap = Math.sin(t * 22 + b.phase) * 0.9;
          tilt = -0.2;
        } else {
          // Hop and peck now and then.
          b.peck -= dt;
          if (b.peck < 0) {
            b.peck = 1 + Math.random() * 3;
            b.ry += (Math.random() - 0.5) * 2;
          }
          tilt = b.peck < 0.25 ? 0.6 : 0;
          flap = 0.25;
        }
        e.set(tilt, b.ry, 0, 'YXZ');
        q.setFromEuler(e);
        const s = f.gull ? 1.9 : 1.4;
        m4.compose(v3.set(b.x, b.y + 0.06, b.z), q, s3.set(s, s, s));
        this.bodies.setMatrixAt(n, m4);
        const c = f.gull ? 0xf2f2ee : 0x7a6550;
        this.bodies.setColorAt(n, tmp.setHex(c));
        for (const [mesh, sign] of [
          [this.wingsL, 1],
          [this.wingsR, -1],
        ] as const) {
          e.set(tilt, b.ry, sign * flap, 'YXZ');
          q.setFromEuler(e);
          m4.compose(v3.set(b.x, b.y + 0.09, b.z), q, s3.set(s, s, s));
          mesh.setMatrixAt(n, m4);
          mesh.setColorAt(n, tmp.setHex(f.gull ? 0xd8d8d2 : 0x5e4c3c));
        }
        n++;
      }
    }
    for (const m of [this.bodies, this.wingsL, this.wingsR]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  private updateBugs(dt: number, t: number, px: number, pz: number, day: number, bloom: boolean) {
    let n = 0;
    for (const b of this.bugs) {
      b.life -= dt * (day > 0.5 ? 1 : 4);
      // Butterflies flutter about and keep away from your feet.
      b.vx += (Math.random() - 0.5) * dt * 6;
      b.vz += (Math.random() - 0.5) * dt * 6;
      const dx = b.x - px;
      const dz = b.z - pz;
      const d = Math.hypot(dx, dz);
      if (d < 2.5) {
        b.vx += (dx / (d || 1)) * dt * 8;
        b.vz += (dz / (d || 1)) * dt * 8;
      }
      b.vx *= 0.96;
      b.vz *= 0.96;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      const ground = heightAt(this.island, b.x, b.z);
      const y = ground + b.y + Math.sin(t * 3 + b.phase) * 0.25;
      if (n >= BUG_CAP) continue;
      const flap = 0.25 + Math.abs(Math.sin(t * 16 + b.phase)) * 0.75;
      e.set(0, Math.atan2(b.vx, b.vz), 0);
      q.setFromEuler(e);
      m4.compose(v3.set(b.x, y, b.z), q, s3.set(flap * 1.6, 1.6, 1.6));
      this.bugWings.setMatrixAt(n, m4);
      this.bugWings.setColorAt(n, tmp.setHex(b.color));
      n++;
    }
    this.bugWings.count = n;
    this.bugWings.instanceMatrix.needsUpdate = true;
    if (this.bugWings.instanceColor) this.bugWings.instanceColor.needsUpdate = true;
    n = 0;
    for (const b of this.lights) {
      b.life -= dt * (day < 0.5 ? 1 : 5);
      b.vx += (Math.random() - 0.5) * dt * 0.8;
      b.vz += (Math.random() - 0.5) * dt * 0.8;
      b.vx *= 0.98;
      b.vz *= 0.98;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      if (n >= BUG_CAP) continue;
      const ground = Math.max(0, heightAt(this.island, b.x, b.z));
      const blink = bloom ? 0.8 : Math.max(0, Math.sin(t * 1.7 + b.phase));
      const fade = Math.min(1, b.life / 3);
      const k = (0.35 + blink * 0.9) * fade;
      m4.compose(
        v3.set(b.x, ground + b.y + Math.sin(t * 0.9 + b.phase) * 0.3, b.z),
        q.identity(),
        s3.setScalar(bloom ? 2.6 : 1.9),
      );
      this.glows.setMatrixAt(n, m4);
      this.glows.setColorAt(n, tmp.setHex(b.color).multiplyScalar(k));
      n++;
    }
    this.glows.count = n;
    this.glows.instanceMatrix.needsUpdate = true;
    if (this.glows.instanceColor) this.glows.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    for (const m of this.grass.values()) this.dropGrass(m);
    this.grass.clear();
  }
}
