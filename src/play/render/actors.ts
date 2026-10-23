// Animated characters: survivors and the Bloom. Each is a small rig of
// pivots so walking, swinging and attacks can be animated procedurally.

import * as THREE from 'three';
import { MOB_STATE } from '../../game/sim/protocol';
import { MAT, box, cone, cyl, ico, mesh, sphere } from './geo';
import { heldModel } from './items';

export type ActorKind = 'player' | 'husk' | 'snapjaw' | 'puffer' | 'thornback' | 'mother' | 'crab';

const SHADOW_GEO = new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
const SHADOW_MAT = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
});

/** The round blob under everyone (off when the sun casts real shadows). */
export function setBlobShadows(on: boolean): void {
  SHADOW_MAT.visible = on;
}

function pivot(x: number, y: number, z: number, child?: THREE.Object3D): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (child) g.add(child);
  return g;
}

function hashStr(s: string): number {
  let h = 0;
  for (const ch of s) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export class Actor {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly parts: Record<string, THREE.Object3D> = {};
  readonly kind: ActorKind;
  private walk = 0;
  /** 0..1 progress of a swing/strike animation. */
  swing = 0;
  hurt = 0;
  dying = 0;
  heldId = '';
  private held: THREE.Object3D | null = null;
  private shadow: THREE.Mesh;
  private t = Math.random() * 10;

  constructor(kind: ActorKind, seedKey: string, color = 0xe8664a) {
    this.kind = kind;
    this.root.add(this.body);
    this.shadow = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
    this.shadow.position.y = 0.03;
    this.root.add(this.shadow);
    const v = hashStr(seedKey);
    switch (kind) {
      case 'player':
        this.buildHuman(color, 0x2d3a5a, 0xe0b48a, false, v);
        this.shadow.scale.setScalar(0.5);
        break;
      case 'husk': {
        const outfits = [0x4a4f5a, 0xe0773a, 0x23345e, 0x8a3d3d, 0x5c6b3a];
        this.buildHuman(outfits[v % outfits.length] as number, 0x2b2b30, 0x8fa080, true, v);
        this.shadow.scale.setScalar(0.5);
        break;
      }
      case 'snapjaw':
        this.buildSnapjaw();
        this.shadow.scale.setScalar(0.7);
        break;
      case 'puffer':
        this.buildPuffer();
        this.shadow.scale.setScalar(0.55);
        break;
      case 'thornback':
        this.buildThornback();
        this.shadow.scale.setScalar(0.9);
        break;
      case 'mother':
        this.buildMother();
        this.shadow.scale.setScalar(3.2);
        break;
      case 'crab':
        this.buildCrab();
        this.shadow.scale.setScalar(0.35);
        break;
    }
  }

  private buildHuman(shirt: number, pants: number, skin: number, husk: boolean, v: number): void {
    const hips = pivot(0, 0.9, 0);
    this.body.add(hips);
    const legGeo = () =>
      mesh([
        box(0.18, 0.85, 0.2, pants, { y: -0.42 }),
        box(0.2, 0.1, 0.28, 0x2a2420, { y: -0.85, z: 0.04 }),
      ]);
    const legL = pivot(-0.13, 0, 0, legGeo());
    const legR = pivot(0.13, 0, 0, legGeo());
    hips.add(legL, legR);
    const torso = new THREE.Group();
    torso.position.y = 0.9;
    this.body.add(torso);
    const torsoParts = [box(0.5, 0.62, 0.3, shirt, { y: 0.33 })];
    if (!husk)
      torsoParts.push(
        box(0.36, 0.42, 0.16, 0x6b4a2a, { y: 0.36, z: -0.22 }),
        box(0.4, 0.08, 0.2, 0x5a3c22, { y: 0.6, z: -0.22 }),
      );
    else {
      torsoParts.push(
        torus2(0.29, 0.05, 0x2c4f2a, { y: 0.2 }),
        torus2(0.27, 0.04, 0x1f3a24, { y: 0.45, rz: 0.4 }),
      );
      torsoParts.push(cone(0.12, 0.2, 5, 0xe85fa8, { x: 0.22, y: 0.68, z: -0.05, rz: -0.5 }));
      torsoParts.push(cone(0.1, 0.18, 5, 0xf07ab8, { x: 0.3, y: 0.7, z: 0.05, rz: -1.1 }));
      torsoParts.push(sphere(0.06, 4, 3, 0xd6ff6a, { x: 0.26, y: 0.72 }));
    }
    torso.add(mesh(torsoParts));
    const head = pivot(0, 0.72, 0);
    torso.add(head);
    const hair = husk ? 0x4a5a3a : ([0x3a2a1a, 0x1c1c1c, 0x8a5a2a, 0xd8c070][v % 4] ?? 0x3a2a1a);
    head.add(
      mesh([
        box(0.3, 0.32, 0.3, skin, { y: 0.16 }),
        box(0.32, 0.1, 0.32, hair, { y: 0.34 }),
        box(0.32, 0.18, 0.08, hair, { y: 0.24, z: -0.14 }),
      ]),
    );
    if (husk) {
      head.add(
        mesh(
          [
            box(0.06, 0.04, 0.02, 0xd6ff6a, { x: -0.07, y: 0.18, z: 0.16 }),
            box(0.06, 0.04, 0.02, 0xd6ff6a, { x: 0.07, y: 0.18, z: 0.16 }),
          ],
          MAT.glow,
        ),
      );
      head.add(
        mesh([cyl(0.025, 0.04, 0.5, 4, 0x2c4f2a, { x: 0.12, y: 0.35, z: -0.05, rz: -0.7 })]),
      );
    } else {
      head.add(
        mesh([
          box(0.05, 0.05, 0.02, 0x222222, { x: -0.07, y: 0.18, z: 0.16 }),
          box(0.05, 0.05, 0.02, 0x222222, { x: 0.07, y: 0.18, z: 0.16 }),
        ]),
      );
    }
    const armGeo = () =>
      mesh([
        box(0.14, 0.34, 0.16, shirt, { y: -0.15 }),
        box(0.12, 0.3, 0.14, skin, { y: -0.45 }),
        ...(husk ? [torus2(0.09, 0.03, 0x2c4f2a, { y: -0.3, rx: Math.PI / 2 })] : []),
      ]);
    const armL = pivot(-0.33, 0.58, 0, armGeo());
    const armR = pivot(0.33, 0.58, 0, armGeo());
    torso.add(armL, armR);
    const hand = pivot(0, -0.58, 0.04);
    armR.add(hand);
    Object.assign(this.parts, { hips, legL, legR, torso, head, armL, armR, hand });
    if (husk) {
      torso.rotation.x = 0.32;
      head.rotation.x = -0.2;
      head.rotation.z = 0.25;
    }
  }

  private buildSnapjaw(): void {
    const stem = new THREE.Group();
    this.body.add(stem);
    stem.add(
      mesh([
        cyl(0.12, 0.18, 1.4, 6, 0x3c7a2e, { y: 0.7 }),
        cone(0.5, 0.25, 5, 0x4f9a3a, { x: 0.4, y: 0.1, rz: -1.2 }),
        cone(0.5, 0.25, 5, 0x3f8a32, { x: -0.4, y: 0.1, rz: 1.2 }),
        cone(0.5, 0.25, 5, 0x4f9a3a, { z: 0.4, y: 0.1, rx: 1.2 }),
        cone(0.5, 0.25, 5, 0x3f8a32, { z: -0.4, y: 0.1, rx: -1.2 }),
      ]),
    );
    const head = pivot(0, 1.4, 0);
    stem.add(head);
    const teeth = (sign: number) =>
      Array.from({ length: 7 }, (_, k) => {
        const a = -Math.PI / 2 + (k / 6) * Math.PI;
        return cone(0.05, 0.16, 3, 0xf2efe0, {
          x: Math.sin(a) * 0.48,
          y: sign * 0.06,
          z: Math.cos(a) * 0.48 + 0.3,
          rx: sign > 0 ? Math.PI : 0,
        });
      });
    // Jaws hinge at the back of the head and open towards the front.
    const jawTop = pivot(
      0,
      0.05,
      -0.3,
      mesh([
        sphere(0.55, 7, 4, 0x6aa83a, { z: 0.3, sy: 0.5 }),
        sphere(0.5, 7, 3, 0xb0283a, { z: 0.3, y: -0.03, sy: 0.35 }),
        ...teeth(-1),
      ]),
    );
    const jawBot = pivot(
      0,
      -0.05,
      -0.3,
      mesh([
        sphere(0.55, 7, 4, 0x5a9832, { z: 0.3, sy: 0.45, rx: Math.PI }),
        sphere(0.5, 7, 3, 0x8a1e2c, { z: 0.3, y: 0.02, sy: 0.3, rx: Math.PI }),
        ...teeth(1),
      ]),
    );
    head.add(jawTop, jawBot);
    Object.assign(this.parts, { stem, head, jawTop, jawBot });
  }

  private buildPuffer(): void {
    const bulb = new THREE.Group();
    bulb.position.y = 1.1;
    this.body.add(bulb);
    const spots: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4;
      const yy = ((k % 5) - 2) * 0.16;
      const r = Math.sqrt(Math.max(0, 0.6 * 0.6 - yy * yy));
      spots.push(sphere(0.07, 4, 3, 0xd6ff6a, { x: Math.sin(a) * r, y: yy, z: Math.cos(a) * r }));
    }
    bulb.add(mesh([ico(0.6, 1, 0x7a4aa8), ico(0.25, 0, 0x9a6ac8, { y: 0.45 })]));
    bulb.add(mesh(spots, MAT.glow));
    const tendrils: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      tendrils.push(
        cone(0.06, 0.8, 4, 0x5a3a80, {
          x: Math.sin(a) * 0.35,
          y: -0.75,
          z: Math.cos(a) * 0.35,
          rx: Math.PI,
        }),
      );
    }
    bulb.add(mesh(tendrils));
    Object.assign(this.parts, { bulb });
  }

  private buildThornback(): void {
    const torso = pivot(0, 0.75, 0);
    this.body.add(torso);
    const spikes: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 7; k++) {
      spikes.push(cone(0.1, 0.45, 4, 0x7a2a2a, { y: 0.32, z: 0.6 - k * 0.2, rx: -0.4 }));
      spikes.push(cone(0.07, 0.3, 4, 0x6a2424, { x: 0.25, y: 0.2, z: 0.5 - k * 0.2, rz: -0.9 }));
      spikes.push(cone(0.07, 0.3, 4, 0x6a2424, { x: -0.25, y: 0.2, z: 0.5 - k * 0.2, rz: 0.9 }));
    }
    torso.add(mesh([ico(0.5, 0, 0x2b4a2a, { sz: 1.9, sy: 0.75 }), ...spikes]));
    const head = pivot(0, 0.1, 0.85);
    torso.add(head);
    head.add(
      mesh([
        cone(0.28, 0.7, 5, 0x24402a, { z: 0.25, rx: Math.PI / 2 }),
        cone(0.05, 0.3, 4, 0xe8e0c0, { x: 0.12, y: -0.12, z: 0.35, rx: 2 }),
        cone(0.05, 0.3, 4, 0xe8e0c0, { x: -0.12, y: -0.12, z: 0.35, rx: 2 }),
      ]),
    );
    head.add(
      mesh(
        [
          box(0.07, 0.05, 0.05, 0xff4040, { x: 0.12, y: 0.1, z: 0.25 }),
          box(0.07, 0.05, 0.05, 0xff4040, { x: -0.12, y: 0.1, z: 0.25 }),
        ],
        MAT.glow,
      ),
    );
    const leg = () => mesh([cyl(0.06, 0.09, 0.8, 5, 0x1f3a24, { y: -0.4 })]);
    const legs = [
      pivot(0.28, 0.75, 0.5, leg()),
      pivot(-0.28, 0.75, 0.5, leg()),
      pivot(0.28, 0.75, -0.5, leg()),
      pivot(-0.28, 0.75, -0.5, leg()),
    ];
    this.body.add(...legs);
    Object.assign(this.parts, { torso, head, l0: legs[0], l1: legs[1], l2: legs[2], l3: legs[3] });
  }

  private buildMother(): void {
    const base = new THREE.Group();
    this.body.add(base);
    const roots: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      roots.push(
        cyl(0.25, 0.45, 4, 6, 0x3a2a2a, {
          x: Math.sin(a) * 2.2,
          y: 0.25,
          z: Math.cos(a) * 2.2,
          rx: Math.cos(a) * 1.4,
          rz: -Math.sin(a) * 1.4,
        }),
      );
    }
    base.add(mesh([cyl(1.4, 2.0, 1.6, 9, 0x4a2a3a, { y: 0.8 }), ...roots]));
    const petals = new THREE.Group();
    petals.position.y = 1.7;
    base.add(petals);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const pv = pivot(Math.sin(a) * 1.0, 0, Math.cos(a) * 1.0);
      pv.rotation.y = a;
      pv.add(mesh([cone(1.0, 3.0, 5, k % 2 ? 0xc0407e : 0x9a2f6a, { y: 1.4, z: 0.2, sz: 0.35 })]));
      pv.rotation.x = 0.9;
      petals.add(pv);
      this.parts[`petal${k}`] = pv;
    }
    const maw: THREE.BufferGeometry[] = [cyl(0.9, 1.2, 1.2, 9, 0x5a1020, { y: 2.1 })];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      maw.push(
        cone(0.09, 0.4, 3, 0xf2efe0, {
          x: Math.sin(a) * 0.8,
          y: 2.75,
          z: Math.cos(a) * 0.8,
          rx: Math.cos(a) * -0.5,
          rz: Math.sin(a) * 0.5,
        }),
      );
    }
    base.add(mesh(maw));
    const core = mesh([sphere(0.55, 8, 6, 0xff6aa0, { y: 2.5 })], MAT.glow);
    base.add(core);
    const tentacles: THREE.Group[] = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.3;
      const tg = pivot(Math.sin(a) * 1.6, 1.2, Math.cos(a) * 1.6);
      tg.rotation.y = a;
      tg.add(
        mesh([
          cyl(0.12, 0.3, 3.4, 6, 0x2c4f2a, { y: 1.7 }),
          cone(0.18, 0.6, 5, 0xe85fa8, { y: 3.6 }),
        ]),
      );
      tg.rotation.x = 0.6;
      base.add(tg);
      tentacles.push(tg);
      this.parts[`t${k}`] = tg;
    }
    Object.assign(this.parts, { base, petals, core });
  }

  private buildCrab(): void {
    const shell = new THREE.Group();
    shell.position.y = 0.2;
    this.body.add(shell);
    shell.add(
      mesh([
        sphere(0.3, 6, 4, 0xd2642c, { sy: 0.45, sz: 0.8 }),
        box(0.16, 0.12, 0.12, 0xe07a3a, { x: 0.35, y: 0, z: 0.22, ry: 0.4 }),
        box(0.16, 0.12, 0.12, 0xe07a3a, { x: -0.35, y: 0, z: 0.22, ry: -0.4 }),
        cyl(0.02, 0.02, 0.18, 3, 0x222222, { x: 0.08, y: 0.15, z: 0.15 }),
        cyl(0.02, 0.02, 0.18, 3, 0x222222, { x: -0.08, y: 0.15, z: 0.15 }),
        ...[-1, 1].flatMap((s) =>
          [0, 1, 2].map((k) =>
            box(0.3, 0.03, 0.03, 0xb8521f, {
              x: s * 0.3,
              y: -0.08,
              z: -0.1 + k * 0.1,
              rz: s * 0.4,
            }),
          ),
        ),
      ]),
    );
    Object.assign(this.parts, { shell });
  }

  setHeld(itemId: string): void {
    if (itemId === this.heldId) return;
    this.heldId = itemId;
    const hand = this.parts['hand'];
    const head = this.parts['head'];
    if (!hand) return;
    this.held?.parent?.remove(this.held);
    this.held = itemId ? heldModel(itemId) : null;
    if (!this.held) return;
    // A petal mask is worn, not carried.
    if (itemId === 'petal_mask' && head) {
      this.held.rotation.set(0, 0, 0);
      this.held.position.set(0, 0.2, 0.17);
      head.add(this.held);
    } else {
      hand.add(this.held);
    }
  }

  /** speed: m/s moved; state: MOB_STATE code (players: 0 idle / 1 walk / 2 run). */
  update(dt: number, speed: number, state: number): void {
    this.t += dt;
    this.hurt = Math.max(0, this.hurt - dt);
    const moving = speed > 0.15;
    if (moving) this.walk += dt * Math.min(12, 3 + speed * 2.2);
    const s = Math.sin(this.walk);
    const p = this.parts;
    const pulse = this.hurt > 0 ? 1 + this.hurt * 0.5 : 1;
    this.body.scale.setScalar(pulse);
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 3);
    let bob = 0;
    switch (this.kind) {
      case 'player':
      case 'husk': {
        const husk = this.kind === 'husk';
        const amp = moving ? (husk ? 0.45 : 0.7) : 0;
        if (p['legL']) p['legL'].rotation.x = s * amp;
        if (p['legR']) p['legR'].rotation.x = -s * amp;
        bob = moving ? Math.abs(Math.cos(this.walk)) * 0.06 : Math.sin(this.t * 2) * 0.01;
        const armBase = husk ? -1.25 + Math.sin(this.t * 3) * 0.08 : 0;
        if (p['armL']) p['armL'].rotation.x = armBase + (husk ? 0 : -s * amp * 0.8);
        let armR = armBase + (husk ? 0 : s * amp * 0.8);
        if (this.heldId && !husk) armR = -0.35 + s * amp * 0.3;
        if (this.swing > 0) {
          const k = 1 - this.swing;
          armR = k < 0.35 ? -2.6 * (k / 0.35) : -2.6 + 3.2 * ((k - 0.35) / 0.65);
        }
        if (husk && state === MOB_STATE.windup) {
          armR = -2.2;
          if (p['armL']) p['armL'].rotation.x = -2.2;
        }
        if (husk && state === MOB_STATE.strike) {
          armR = -0.4;
          if (p['armL']) p['armL'].rotation.x = -0.4;
        }
        if (p['armR']) p['armR'].rotation.x = armR;
        if (husk && p['torso']) p['torso'].rotation.z = Math.sin(this.walk * 0.5) * 0.15;
        break;
      }
      case 'snapjaw': {
        if (p['stem']) {
          p['stem'].rotation.z = Math.sin(this.t * 1.3) * 0.08;
          p['stem'].rotation.x =
            state === MOB_STATE.windup
              ? -0.35
              : state === MOB_STATE.strike
                ? 0.45
                : Math.sin(this.t * 0.9) * 0.05;
        }
        const open =
          state === MOB_STATE.windup
            ? 0.9
            : state === MOB_STATE.strike
              ? 0.05
              : 0.35 + Math.sin(this.t * 2) * 0.1;
        if (p['jawTop']) p['jawTop'].rotation.x = -open;
        if (p['jawBot']) p['jawBot'].rotation.x = open * 0.6;
        break;
      }
      case 'puffer': {
        const bulb = p['bulb'];
        if (bulb) {
          bulb.position.y = 1.1 + Math.sin(this.t * 2.5) * 0.15;
          const k =
            state === MOB_STATE.windup
              ? 1.15 + Math.sin(this.t * 30) * 0.12
              : 1 + Math.sin(this.t * 3) * 0.04;
          bulb.scale.setScalar(k);
          bulb.rotation.y += dt * 0.6;
        }
        break;
      }
      case 'thornback': {
        const amp = moving ? 0.7 : 0;
        const f = s * amp;
        if (p['l0']) p['l0'].rotation.x = f;
        if (p['l3']) p['l3'].rotation.x = f;
        if (p['l1']) p['l1'].rotation.x = -f;
        if (p['l2']) p['l2'].rotation.x = -f;
        if (p['torso']) p['torso'].position.y = 0.75 + Math.abs(Math.cos(this.walk)) * 0.08;
        if (p['head'])
          p['head'].rotation.x =
            state === MOB_STATE.windup ? -0.5 : state === MOB_STATE.strike ? 0.4 : 0;
        break;
      }
      case 'mother': {
        const open = state === MOB_STATE.windup ? 0.35 : 0.9 + Math.sin(this.t * 0.8) * 0.08;
        for (let k = 0; k < 8; k++) {
          const pv = p[`petal${k}`];
          if (pv) pv.rotation.x = open + Math.sin(this.t * 1.2 + k) * 0.05;
        }
        for (let k = 0; k < 5; k++) {
          const tg = p[`t${k}`];
          if (!tg) continue;
          tg.rotation.x =
            state === MOB_STATE.windup
              ? -0.4
              : state === MOB_STATE.strike
                ? 1.4
                : 0.6 + Math.sin(this.t * 1.5 + k * 1.3) * 0.25;
          tg.rotation.z = Math.sin(this.t * 1.1 + k) * 0.2;
        }
        if (p['core']) p['core'].scale.setScalar(1 + Math.sin(this.t * 4) * 0.08);
        break;
      }
      case 'crab': {
        if (p['shell']) {
          p['shell'].position.y = 0.2 + (moving ? Math.abs(s) * 0.04 : 0);
          p['shell'].rotation.z = moving ? s * 0.12 : 0;
        }
        break;
      }
    }
    // Rising out of / sinking into the soil.
    if (state === MOB_STATE.emerge) {
      if (!this.emerging) {
        this.emerging = true;
        this.sinkY = -1.6;
      }
      this.sinkY = Math.min(0, this.sinkY + dt * 1.3);
    } else if (state === MOB_STATE.burrow) {
      this.sinkY = Math.max(-1.9, this.sinkY - dt * 1.3);
    } else {
      this.sinkY = Math.min(0, this.sinkY + dt * 2);
    }
    this.body.position.y = bob + this.sinkY;
    if (this.dying > 0) {
      this.dying += dt;
      this.body.rotation.x = -Math.min(1.4, this.dying * 2.5);
      this.body.position.y = bob - Math.max(0, this.dying - 0.5) * 1.2;
    }
  }

  private sinkY = 0;
  private emerging = false;
}

function torus2(
  r: number,
  tube: number,
  color: number,
  p: { x?: number; y?: number; z?: number; rx?: number; rz?: number },
) {
  const g = new THREE.TorusGeometry(r, tube, 4, 10).toNonIndexed();
  g.rotateX(Math.PI / 2 + (p.rx ?? 0));
  if (p.rz) g.rotateZ(p.rz);
  g.translate(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const n = g.getAttribute('position').count;
  const c = new THREE.Color(color);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}
