// The 3D scene: a tilted camera following the survivor over a low-poly
// island, lit by the time of day, fires and torches.

import * as THREE from 'three';
import { BUILDINGS, RAIN_MAX } from '../game/content/buildings';
import { ITEMS } from '../game/content/items';
import { MONSTERS } from '../game/content/monsters';
import { NODE } from '../game/content/nodes';
import { POD_FALL } from '../game/sim/events';
import { MOB_STATE } from '../game/sim/protocol';
import { NIGHT_END, NIGHT_START, daylight, lowTide } from '../game/sim/time';
import { circleHitsBox, colorFor, footprint } from '../game/sim/types';
import { BIOME, biomeAt, forNodesNear, heightAt, type Island } from '../game/world';
import type { Sound, Sfx } from './audio';
import {
  RUN,
  type ChatLine,
  type ClientFx,
  type GameClient,
  type MoveInput,
  type RoofView,
} from './client';
import { STAR_ICON, itemIconUrl } from './hud/itemIcons';
import { buzz } from './prefs';
import { Actor, setBlobShadows } from './render/actors';
import { Ambient } from './render/ambient';
import { climateLook } from './render/climate';
import { Fx, FX_COLORS } from './render/fx';
import { MAT } from './render/geo';
import { bagModel, crateModel, podModel } from './render/items';
import { NodeView } from './render/nodes';
import { nodeTint } from './render/props';
import { SunShadow, setupRenderer, shadeAll, toneMapped } from './render/light';
import { WIND } from './render/wind';
import { Rain, WEATHER_LOOK, lightningBolt } from './render/weather';
import {
  cameraRig,
  screenToWorld,
  type CameraRig,
  type CameraView,
  type GraphicsLevel,
} from './settings';
import {
  ROOF_E,
  ROOF_N,
  ROOF_S,
  ROOF_W,
  cropModel,
  buildPois,
  roofGeometry,
  buildingModel,
  helicopter,
  treasureMark,
  type BuildingView,
  type PoiView,
} from './render/structures';
import { Terrain } from './render/terrain';

const LIGHTS = 4;
const TREES: number[] = [NODE.palm, NODE.jungle, NODE.pine];
/** Seconds a felled tree takes to hit the ground. */
const FALL = 1.4;

const SKY_NIGHT = new THREE.Color(0x0a0f1e);
const SKY_BLOOM = new THREE.Color(0x1c0b22);
const HEMI_NIGHT = new THREE.Color(0x3a4c80);
const HEMI_BLOOM = new THREE.Color(0x5a3a6a);
const GROUND_NIGHT = new THREE.Color(0x1a1a2a);
/** Where the moon shines from (towards it). */
const MOON_DIR = new THREE.Vector3(-0.45, 1, 0.35).normalize();
const SUN_DAY = new THREE.Color(0xfff1dc);
const SUN_DUSK = new THREE.Color(0xff9a52);
const MOON = new THREE.Color(0x9db4ff);
const tmpColor = new THREE.Color();
const tmpColor2 = new THREE.Color();
const tmpV2 = new THREE.Vector2();
/** The build grid reaches this far (m) around the piece. */
const GRID_REACH = 9;
const tmpVec = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpM = new THREE.Matrix4();

/** A felled tree on its way down. */
interface Faller {
  mesh: THREE.Mesh;
  mat: THREE.MeshLambertMaterial;
  pos: THREE.Vector3;
  base: THREE.Quaternion;
  scale: THREE.Vector3;
  axis: THREE.Vector3;
  dx: number;
  dz: number;
  t: number;
  landed: boolean;
}

interface DropView {
  obj: THREE.Object3D;
  kind: 'bag' | 'crate' | 'pod';
  light?: THREE.Object3D;
}

interface Popup {
  y: number;
  text: string;
  icon: string;
  life: number;
}

interface Label {
  el: HTMLDivElement;
  used: boolean;
}

/** DOM labels over the canvas (names, health bars, damage numbers). */
/** Seconds a chat line shows over the speaker's head. */
const BUBBLE_SECONDS = 6;
/** The roof you're under (or building under): a faint outline, so you see inside. */
const ROOF_FADE = new THREE.MeshLambertMaterial({
  vertexColors: true,
  flatShading: true,
  transparent: true,
  opacity: 0.1,
  depthWrite: false,
});

interface RoofState {
  /** Which sides of each roof tile have a neighbour (ROOF_N…). */
  masks: Map<number, number>;
  /** Roof tiles drawn faint: the whole roof over you (and over the build cursor). */
  faded: Set<number>;
  /** The roof switch ('auto' outside build mode). */
  mode: RoofView;
}

class Labels {
  private readonly pool: Label[] = [];
  private n = 0;

  constructor(private readonly root: HTMLDivElement) {}

  begin(): void {
    this.n = 0;
  }

  add(
    x: number,
    y: number,
    text: string,
    cls: string,
    opacity = 1,
    width?: number,
    icon?: string,
  ): void {
    let l = this.pool[this.n];
    if (!l) {
      const el = document.createElement('div');
      this.root.appendChild(el);
      l = { el, used: true };
      this.pool.push(l);
    }
    this.n++;
    const el = l.el;
    if (el.className !== cls) el.className = cls;
    if (el.textContent !== text) el.textContent = text;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    el.style.opacity = String(opacity);
    if (width !== undefined) el.style.setProperty('--w', `${Math.round(width * 100)}%`);
    if (icon !== undefined) {
      const bg = `url("${icon}")`;
      if (el.style.getPropertyValue('--icon') !== bg) el.style.setProperty('--icon', bg);
    }
    el.style.display = '';
  }

  end(): void {
    for (let i = this.n; i < this.pool.length; i++)
      (this.pool[i] as Label).el.style.display = 'none';
  }
}

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(48, 1, 0.5, 400);
  private readonly client: GameClient;
  private readonly island: Island;
  private readonly sound: Sound;
  private readonly sun = new THREE.DirectionalLight(0xffffff, 2);
  private readonly hemi = new THREE.HemisphereLight(0xd8eeff, 0x6a7a4a, 1.2);
  private readonly fog = new THREE.Fog(0x9fd3ea, 50, 120);
  private readonly terrain: Terrain;
  private readonly nodes: NodeView;
  private readonly fx: Fx;
  private me: Actor;
  private readonly others = new Map<string, Actor>();
  private readonly mobs = new Map<number, Actor>();
  private readonly builds = new Map<number, { view: BuildingView; kind: string }>();
  private readonly dropMeshes = new Map<number, DropView>();
  private readonly pois: PoiView[];
  /** Treasure X marks on the ground (map number → model). */
  private readonly marks = new Map<number, THREE.Object3D>();
  private readonly heli: { group: THREE.Group; rotor: THREE.Object3D };
  private heliY = 60;
  private ghost: { kind: string; group: THREE.Group } | null = null;
  private readonly ghostOk = new THREE.MeshBasicMaterial({
    color: 0x6cff9f,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  private readonly ghostBad = new THREE.MeshBasicMaterial({
    color: 0xff5a5a,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  private readonly ring: THREE.Mesh;
  /** A red box around the piece the take-down tool has picked. */
  private readonly doomBox: THREE.BoxHelper;
  private doomId: number | null = null;
  private readonly lights: THREE.PointLight[] = [];
  private readonly labels: Labels;
  private readonly focus = new THREE.Vector3();
  private shake = 0;
  private t = 0;
  private emberAcc = 0;
  zoom = 1;
  private terrainRadius = 3;
  private nodeRadius = 2;
  private fogMul = 1;
  // Build mode's grid.
  private grid: THREE.LineSegments | null = null;
  private gridKey = '';
  private gridShow = true;
  private readonly raycaster = new THREE.Raycaster();
  // The island's climate: daylight colours and how misty it is.
  private readonly skyDay: THREE.Color;
  private readonly skyDusk: THREE.Color;
  private readonly hemiDay: THREE.Color;
  private readonly groundDay: THREE.Color;
  private readonly climateFog: number;
  /** The camera's distance from what it looks at (fog starts from there). */
  private fogFrom = 32;
  private shakeOn = true;
  private numbers = true;
  private w = 1;
  private h = 1;
  private readonly ambient: Ambient;
  private readonly fallers: Faller[] = [];
  private readonly falling: { group: THREE.Group; x: number; z: number; y: number; t: number }[] =
    [];
  private readonly popups: Popup[] = [];
  private readonly lead = new THREE.Vector3();
  private camDist = 1.3;
  private rig: CameraRig = cameraRig('iso');
  private hitStop = 0;
  private stepAcc = 0;
  private smokeAcc = 0;
  /** How close the Bloom is, 0..1 (music, camera). */
  danger = 0;
  private readonly dangerSpots: { x: number; z: number }[] = [];
  private readonly sunShadow: SunShadow;
  private readonly sunDir = new THREE.Vector3();
  private shadeAcc = 0;
  private readonly rain: Rain;
  /** The weather as it looks now, blending towards the sky the authority sends. */
  private readonly sky = { cloud: 0, rain: 0, fog: 0 };
  /** Lightning: a flash that fades, and bolts on screen. */
  private flash = 0;
  private readonly bolts: { line: THREE.LineSegments; life: number }[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    overlay: HTMLDivElement,
    client: GameClient,
    sound: Sound,
  ) {
    this.client = client;
    this.island = client.island as Island;
    this.sound = sound;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    setupRenderer(this.renderer);
    this.sunShadow = new SunShadow(this.sun);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x9fd3ea);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    for (let i = 0; i < LIGHTS; i++) {
      const l = new THREE.PointLight(0xffa04a, 0, 14, 1.2);
      this.lights.push(l);
      this.scene.add(l);
    }
    this.terrain = new Terrain(this.island, this.scene);
    this.ambient = new Ambient(this.island, this.scene);
    this.nodes = new NodeView(this.island, this.scene, (id) => client.nodeGone(id));
    this.fx = new Fx(this.scene);
    this.rain = new Rain(this.scene);
    const look = climateLook(this.island.spec.climate);
    this.skyDay = new THREE.Color(look.skyDay ?? 0x9fd3ea);
    this.skyDusk = new THREE.Color(look.skyDusk ?? 0xe39a6a);
    this.hemiDay = new THREE.Color(look.hemiDay ?? 0xd8eeff);
    this.groundDay = new THREE.Color(look.groundDay ?? 0x6a7a4a);
    this.climateFog = look.fog ?? 1;
    this.pois = buildPois(this.island.pois, this.island.spec, (x, z) =>
      heightAt(this.island, x, z),
    );
    for (const p of this.pois) this.scene.add(p.group);
    this.heli = helicopter();
    this.heli.group.visible = false;
    this.scene.add(this.heli.group);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    );
    this.ring.renderOrder = 3;
    this.scene.add(this.ring);
    this.doomBox = new THREE.BoxHelper(new THREE.Object3D(), 0xff5a5a);
    const boxMat = this.doomBox.material as THREE.LineBasicMaterial;
    boxMat.depthTest = false;
    boxMat.transparent = true;
    this.doomBox.renderOrder = 4;
    this.doomBox.visible = false;
    this.scene.add(this.doomBox);
    this.labels = new Labels(overlay);
    this.me = this.newPlayer(client.you);
    this.terrain.prime(client.x, client.z, this.terrainRadius);
    this.focus.set(client.x, heightAt(this.island, client.x, client.z), client.z);
    this.syncWorld();
    client.onFx((e) => this.onFx(e));
  }

  private newPlayer(id: string): Actor {
    const info = this.client.players.find((p) => p.id === id);
    const a = new Actor('player', id, info?.color ?? colorFor(id));
    this.scene.add(a.root);
    return a;
  }

  /** Rebuilds buildings and drops from the client's mirror (after a snapshot). */
  private syncWorld(): void {
    for (const [id, b] of this.builds) {
      this.scene.remove(b.view.group);
      this.builds.delete(id);
    }
    for (const [id, m] of this.dropMeshes) {
      this.scene.remove(m.obj);
      this.dropMeshes.delete(id);
    }
    for (const b of this.client.buildings.values()) this.addBuilding(b.id, b.kind, b.x, b.z, b.rot);
    for (const d of this.client.drops.values()) this.addDrop(d.id, d.x, d.z, d.kind);
    for (const a of this.mobs.values()) this.scene.remove(a.root);
    this.mobs.clear();
    this.nodes.markDirty();
  }

  private addBuilding(id: number, kind: string, x: number, z: number, rot: number): void {
    const view = buildingModel(kind);
    view.group.position.set(x, heightAt(this.island, x, z), z);
    view.group.rotation.y = rot * (Math.PI / 2);
    this.scene.add(view.group);
    this.builds.set(id, { view, kind });
  }

  private addDrop(id: number, x: number, z: number, kind?: 'crate' | 'pod'): void {
    let view: DropView;
    if (kind === 'crate') view = { obj: crateModel(), kind };
    else if (kind === 'pod') {
      const pod = podModel();
      view = { obj: pod.group, kind, light: pod.light };
    } else view = { obj: bagModel(), kind: 'bag' };
    view.obj.position.set(x, heightAt(this.island, x, z) - (kind === 'crate' ? 0.15 : 0), z);
    if (kind) view.obj.rotation.y = id * 1.7;
    this.scene.add(view.obj);
    this.dropMeshes.set(id, view);
  }

  /** Player settings: camera, effects and graphics quality. */
  configure(o: {
    view: CameraView;
    zoom: number;
    shake: boolean;
    numbers: boolean;
    gfx: GraphicsLevel;
    life: boolean;
    grid?: boolean;
  }): void {
    this.rig = cameraRig(o.view);
    this.gridShow = o.grid ?? true;
    this.zoom = o.zoom;
    this.shakeOn = o.shake;
    this.numbers = o.numbers;
    this.fogMul = o.gfx.fog;
    this.terrainRadius = o.gfx.terrain;
    if (this.nodeRadius !== o.gfx.nodes) {
      this.nodeRadius = o.gfx.nodes;
      this.nodes.markDirty();
    }
    this.fx.density = o.gfx.particles;
    this.rain.setMax(Math.round(1500 * o.gfx.particles));
    this.sunShadow.setSize(o.gfx.shadows);
    setBlobShadows(o.gfx.shadows === 0);
    const pr = Math.min(window.devicePixelRatio || 1, o.gfx.pixelRatio);
    if (this.renderer.getPixelRatio() !== pr) {
      this.renderer.setPixelRatio(pr);
      this.resize(this.w, this.h);
    }
    this.ambient.configure(o.gfx.grass, o.life);
  }

  /** The stick or keys (screen directions) as a direction on the island. */
  toWorld(m: MoveInput): MoveInput {
    const w = screenToWorld(m.x, m.z, this.rig.yaw);
    return { x: w.x, z: w.z, sprint: m.sprint };
  }

  private kick(amount: number): void {
    if (this.shakeOn) this.shake = Math.max(this.shake, amount);
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  private dist(x: number, z: number): number {
    return Math.hypot(x - this.client.x, z - this.client.z);
  }

  private sfx(name: Sfx, x: number, z: number): void {
    this.sound.play(name, this.dist(x, z));
  }

  private y(x: number, z: number): number {
    return Math.max(heightAt(this.island, x, z), -0.6);
  }

  private onFx(e: ClientFx): void {
    switch (e.type) {
      case 'reset':
        this.syncWorld();
        return;
      case 'node':
        this.nodes.markDirty();
        if (e.fell) this.felled(e.id);
        return;
      case 'gain': {
        const name = ITEMS[e.id]?.name ?? e.id;
        const last = this.popups[this.popups.length - 1];
        const y = last && last.life > 1.2 ? last.y + 0.9 : 2.5;
        this.popups.push({ y, text: `+${e.n} ${name}`, icon: itemIconUrl(e.id), life: 1.6 });
        if (this.popups.length > 6) this.popups.shift();
        return;
      }
      case 'xp': {
        const last = this.popups[this.popups.length - 1];
        const y = last && last.life > 1.2 ? last.y + 0.9 : 2.5;
        this.popups.push({ y, text: `+${e.n} XP`, icon: STAR_ICON, life: 1.4 });
        if (this.popups.length > 6) this.popups.shift();
        return;
      }
      case 'swing': {
        const a = e.id === this.client.you ? this.me : this.others.get(e.id);
        if (a) a.swing = 1;
        if (e.id === this.client.you) this.sound.play('swing', 0);
        return;
      }
      case 'build': {
        const old = this.builds.get(e.b.id);
        if (!old) this.addBuilding(e.b.id, e.b.kind, e.b.x, e.b.z, e.b.rot);
        return;
      }
      case 'unbuild': {
        const b = this.builds.get(e.id);
        if (b) {
          this.scene.remove(b.view.group);
          this.builds.delete(e.id);
        }
        return;
      }
      case 'drop':
        if (!this.dropMeshes.has(e.d.id)) this.addDrop(e.d.id, e.d.x, e.d.z, e.d.kind);
        return;
      case 'undrop': {
        const m = this.dropMeshes.get(e.id);
        if (m) {
          this.scene.remove(m.obj);
          this.dropMeshes.delete(e.id);
        }
        return;
      }
      case 'event':
        if (e.e === 'dead') {
          this.me.dying = 0.01;
          this.sound.play('dead');
          buzz('error');
        } else if (e.e === 'respawn') {
          this.scene.remove(this.me.root);
          this.me = this.newPlayer(this.client.you);
        } else if (e.e === 'night' || e.e === 'bloom' || e.e === 'dawn' || e.e === 'win') {
          this.sound.play(e.e);
        }
        return;
      case 'fx':
        this.fxBurst(e);
    }
  }

  private fxBurst(e: Extract<ClientFx, { type: 'fx' }>): void {
    const { x, z } = e;
    const y = this.y(x, z);
    const mine = e.by === this.client.you;
    switch (e.k) {
      case 'chop':
        this.fx.burst(x, y + 1.2, z, 8, FX_COLORS.wood, { speed: 3 });
        this.fx.burst(x, y + 2.5, z, 5, FX_COLORS.leaf, { speed: 2, up: 1, grav: 3 });
        this.shakeNodeAt(x, z);
        this.sfx('chop', x, z);
        break;
      case 'mine':
        this.fx.burst(x, y + 0.7, z, 8, FX_COLORS.stone, { speed: 3 });
        this.fx.burst(x, y + 0.8, z, 4, FX_COLORS.spark, { speed: 4, glow: true, life: 0.3 });
        this.shakeNodeAt(x, z);
        this.sfx('mine', x, z);
        break;
      case 'gather':
        this.fx.burst(x, y + 0.5, z, 7, FX_COLORS.leaf, { speed: 2, up: 2 });
        this.shakeNodeAt(x, z);
        this.sfx('gather', x, z);
        break;
      case 'hit':
        this.fx.burst(x, y + 1.2, z, 10, FX_COLORS.blood, { speed: 3 });
        if (e.n) this.fx.text(x, y + 2.2, z, `-${e.n}`, mine ? '#ff5a5a' : '#ffb0b0');
        if (mine) {
          this.kick(0.35);
          buzz('medium');
          const a = this.me;
          a.hurt = 0.3;
        } else if (e.by) {
          const a = this.others.get(e.by);
          if (a) a.hurt = 0.3;
        }
        this.sfx('hit', x, z);
        break;
      case 'swing':
        if (!e.by) this.sfx('swing', x, z);
        break;
      case 'mobhit': {
        this.fx.burst(x, y + 1, z, 10, FX_COLORS.sap, { speed: 3, glow: true, life: 0.6 });
        if (e.n)
          this.fx.text(
            x,
            y + 2.4,
            z,
            String(e.n),
            e.by === this.client.you ? '#fff27a' : '#ffffff',
          );
        const m = this.nearestMob(x, z);
        if (m) m.hurt = 0.25;
        if (mine) {
          // A beat of hit-stop and a nudge make a hit land.
          this.hitStop = 0.06;
          this.kick(0.1);
          buzz('light');
        }
        this.sfx('mobhit', x, z);
        break;
      }
      case 'death':
        this.fx.burst(x, y + 1, z, 22, FX_COLORS.spore, { speed: 4, up: 4, glow: true, life: 1.1 });
        this.fx.burst(x, y + 0.5, z, 10, FX_COLORS.dust, { speed: 2, up: 1 });
        this.ambient.scare(x, z, 20);
        this.sfx('death', x, z);
        break;
      case 'burst':
        this.fx.ring(x, y, z, e.r ?? 3, 0x9adf4a, 0.8, { grow: true });
        this.fx.burst(x, y + 1, z, 30, FX_COLORS.spore, {
          speed: 5,
          up: 2,
          grav: 1,
          glow: true,
          life: 1.4,
        });
        this.sfx('burst', x, z);
        break;
      case 'spore':
        this.fx.ring(x, y, z, e.r ?? 4.5, 0xb6ff5a, 0.9, { grow: true });
        this.fx.burst(x, y + 0.6, z, 40, FX_COLORS.spore, {
          speed: 5,
          up: 2,
          grav: 0.5,
          glow: true,
          life: 1.6,
          size: 1.4,
        });
        this.sfx('burst', x, z);
        break;
      case 'boom':
        this.fx.ring(x, y, z, e.r ?? 3.5, 0xff8a3a, 0.6, { grow: true });
        this.fx.burst(x, y + 0.5, z, 34, FX_COLORS.fire, {
          speed: 6,
          up: 5,
          glow: true,
          life: 0.9,
        });
        this.fx.burst(x, y + 0.5, z, 12, FX_COLORS.smoke, {
          speed: 2,
          up: 2,
          grav: -1,
          life: 1.6,
          size: 2,
        });
        this.kick(Math.max(0, 0.5 - this.dist(x, z) / 40));
        if (this.dist(x, z) < 15) buzz('heavy');
        this.ambient.scare(x, z, 30);
        this.sfx('boom', x, z);
        break;
      case 'slam':
        this.fx.ring(x, y, z, e.r ?? 3.2, 0xd8a070, 0.7, { grow: true });
        this.fx.burst(x, y + 0.3, z, 30, FX_COLORS.dust, { speed: 6, up: 3, life: 1 });
        this.kick(Math.max(0, 0.7 - this.dist(x, z) / 30));
        if (this.dist(x, z) < 12) buzz('heavy');
        this.ambient.scare(x, z, 30);
        this.sfx('slam', x, z);
        break;
      case 'slamwarn':
        this.fx.ring(x, y, z, e.r ?? 3.2, 0xff3a3a, 1.3, { pulse: true });
        this.sfx('slamwarn', x, z);
        break;
      case 'bite':
        this.fx.burst(x, y + 1, z, 6, FX_COLORS.sap, { speed: 2 });
        this.sfx('bite', x, z);
        break;
      case 'build':
        this.fx.burst(x, y + 0.3, z, 10, FX_COLORS.dust, { speed: 2, up: 2 });
        this.sfx('build', x, z);
        break;
      case 'break':
        this.fx.burst(x, y + 0.8, z, 18, FX_COLORS.wood, { speed: 4, up: 3 });
        this.sfx('break', x, z);
        break;
      case 'eat':
        this.fx.burst(x, y + 1.4, z, 6, FX_COLORS.wood, { speed: 1, up: 1 });
        this.sfx('eat', x, z);
        break;
      case 'drink':
        this.fx.burst(x, y + 1.2, z, 8, FX_COLORS.water, { speed: 1.5, up: 2 });
        this.sfx('drink', x, z);
        break;
      case 'heal':
        this.fx.burst(x, y + 1, z, 12, FX_COLORS.heal, {
          speed: 1,
          up: 2,
          grav: -1,
          glow: true,
          life: 1,
        });
        this.sfx('heal', x, z);
        break;
      case 'craft':
        this.fx.burst(x, y + 1.2, z, 10, FX_COLORS.gold, {
          speed: 1.5,
          up: 2,
          grav: 0,
          glow: true,
          life: 0.7,
        });
        this.sfx('craft', x, z);
        if (mine) buzz('success');
        break;
      case 'deny':
        if (mine) this.sound.play('deny');
        break;
      case 'unlock':
        this.fx.burst(x, y + 1.2, z, 16, FX_COLORS.gold, { speed: 2, up: 3, glow: true });
        this.sfx('unlock', x, z);
        break;
      case 'pickup':
        this.fx.burst(x, y + 0.5, z, 8, FX_COLORS.gold, {
          speed: 1.5,
          up: 2.5,
          grav: 2,
          glow: true,
          life: 0.6,
        });
        this.sfx('pickup', x, z);
        break;
      case 'levelup':
        this.fx.burst(x, y + 1.2, z, 30, FX_COLORS.gold, {
          speed: 3,
          up: 5,
          glow: true,
          life: 1.2,
        });
        this.fx.ring(x, y, z, 2.5, 0xffd34a, 0.9, { grow: true });
        this.sfx('unlock', x, z);
        if (mine) buzz('success');
        break;
      case 'lightning': {
        const line = lightningBolt(x, y, z, Math.floor(x * 31 + z * 17));
        this.scene.add(line);
        this.bolts.push({ line, life: 0.3 });
        this.flash = 1;
        this.fx.burst(x, y + 0.3, z, 14, FX_COLORS.spark, {
          speed: 4,
          up: 3,
          glow: true,
          life: 0.5,
        });
        this.fx.ring(x, y, z, 3, 0xeef4ff, 0.5, { grow: true });
        const d = this.dist(x, z);
        this.sound.play('crack', d / 3);
        this.sound.playLater('thunder', 0.3 + d / 120, d / 8);
        this.kick(Math.max(0, 0.5 - d / 80));
        break;
      }
      case 'podfall': {
        const group = podModel().group;
        group.position.set(x + 14, y + 60, z - 10);
        group.rotation.set(0.5, 0, -0.35);
        this.scene.add(group);
        this.falling.push({ group, x, z, y, t: 0 });
        // Heard from far away: it's meant to draw you (and everything else) in.
        this.sound.play('podfall', this.dist(x, z) / 5);
        break;
      }
      case 'land': {
        const d = this.dist(x, z);
        this.fx.ring(x, y, z, e.r ?? 4, 0xffd08a, 0.8, { grow: true });
        this.fx.burst(x, y + 0.4, z, 40, FX_COLORS.dust, { speed: 7, up: 4, life: 1.2 });
        this.fx.burst(x, y + 0.6, z, 20, FX_COLORS.fire, { speed: 5, up: 4, glow: true });
        this.kick(Math.max(0, 0.8 - d / 45));
        if (d < 30) buzz('heavy');
        this.ambient.scare(x, z, 45);
        this.sound.play('boom', d / 3);
        break;
      }
      case 'dig':
        this.fx.burst(x, y + 0.2, z, 12, FX_COLORS.sand, { speed: 2.5, up: 3.5, life: 0.7 });
        this.sfx('dig', x, z);
        if (mine) buzz('light');
        break;
      case 'shot': {
        const from =
          e.by === this.client.you
            ? { x: this.client.x, z: this.client.z }
            : this.client.others.get(e.by ?? '');
        if (from) {
          this.fx.shoot(
            from.x,
            this.y(from.x, from.z) + 1.3,
            from.z,
            x,
            y + 0.9,
            z,
            e.n ?? 36,
            e.r ?? 0,
          );
          this.sfx('shoot', from.x, from.z);
          this.ambient.scare(from.x, from.z, 10);
        }
        break;
      }
      case 'throw': {
        const from =
          e.by === this.client.you
            ? { x: this.client.x, z: this.client.z }
            : this.client.others.get(e.by ?? '');
        if (from) {
          this.fx.throwBomb(from.x, this.y(from.x, from.z) + 1.5, from.z, x, y + 0.2, z);
          this.sfx('throw', from.x, from.z);
        }
        break;
      }
    }
  }

  /** A node was used up: trees topple, rocks crumble, bushes burst. */
  private felled(id: number): void {
    const island = this.island;
    const type = island.nodeType[id] as number;
    const x = island.nodeX[id] as number;
    const z = island.nodeZ[id] as number;
    const d = this.dist(x, z);
    if (d > 70) return;
    const y = this.y(x, z);
    if (type === NODE.rock || type === NODE.scrap) {
      const colors = type === NODE.rock ? FX_COLORS.stone : FX_COLORS.metal;
      this.fx.burst(x, y + 0.6, z, 24, colors, { speed: 5, up: 4, size: 1.6 });
      this.fx.burst(x, y + 0.3, z, 14, FX_COLORS.dust, { speed: 3, up: 2, life: 1 });
      this.kick(Math.max(0, 0.18 - d / 60));
      this.sfx('break', x, z);
      return;
    }
    if (type === NODE.bush || type === NODE.berry || type === NODE.vines) {
      this.fx.burst(x, y + 0.6, z, 16, FX_COLORS.leaf, { speed: 3, up: 3 });
      return;
    }
    if (!TREES.includes(type)) return;
    const geo = this.nodes.geometry(type);
    if (!geo) return;
    const mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
      transparent: true,
      color: nodeTint(type, island.nodeVar[id] as number, new THREE.Color()),
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false;
    const pos = new THREE.Vector3();
    const base = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    this.nodes.pose(id, tmpM).decompose(pos, base, scale);
    // It falls away from you when you felled it, any old way otherwise.
    let dx = x - this.client.x;
    let dz = z - this.client.z;
    let len = Math.hypot(dx, dz);
    if (len > 8 || len < 0.01) {
      const a = Math.random() * Math.PI * 2;
      dx = Math.sin(a);
      dz = Math.cos(a);
      len = 1;
    }
    dx /= len;
    dz /= len;
    const axis = new THREE.Vector3(dz, 0, -dx);
    mesh.matrix.compose(pos, base, scale);
    this.scene.add(mesh);
    this.fallers.push({ mesh, mat, pos, base, scale, axis, dx, dz, t: 0, landed: false });
    this.fx.burst(x, y + 3, z, 10, FX_COLORS.leaf, { speed: 2, up: 1, grav: 2, life: 1.4 });
    this.sfx('creak', x, z);
  }

  private updateFallers(dt: number): void {
    for (let i = this.fallers.length - 1; i >= 0; i--) {
      const f = this.fallers[i] as Faller;
      f.t += dt;
      const k = Math.min(1, f.t / FALL);
      tmpQ.setFromAxisAngle(f.axis, (Math.PI / 2 - 0.1) * k * k).multiply(f.base);
      if (k >= 1 && !f.landed) {
        f.landed = true;
        const d = this.dist(f.pos.x, f.pos.z);
        const reach = 5 * f.scale.y;
        for (let s = 1; s <= 3; s++) {
          const px = f.pos.x + (f.dx * (reach * s)) / 3;
          const pz = f.pos.z + (f.dz * (reach * s)) / 3;
          this.fx.burst(px, this.y(px, pz) + 0.3, pz, 8, FX_COLORS.dust, { speed: 3, up: 2 });
        }
        const tx = f.pos.x + f.dx * reach;
        const tz = f.pos.z + f.dz * reach;
        this.fx.burst(tx, this.y(tx, tz) + 0.8, tz, 18, FX_COLORS.leaf, { speed: 4, up: 3 });
        this.kick(Math.max(0, 0.28 - d / 50));
        if (d < 10) buzz('light');
        this.ambient.scare(f.pos.x, f.pos.z, 25);
        this.sound.play('thud', d);
      }
      if (f.landed) {
        const after = f.t - FALL;
        if (after > 1) {
          f.mat.opacity = Math.max(0, 1 - (after - 1));
          f.pos.y -= dt * 0.4;
        }
        if (after > 2) {
          this.scene.remove(f.mesh);
          f.mat.dispose();
          this.fallers.splice(i, 1);
          continue;
        }
      }
      f.mesh.matrix.compose(f.pos, tmpQ, f.scale);
    }
  }

  private updateFalling(dt: number): void {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const p = this.falling[i] as (typeof this.falling)[number];
      p.t += dt;
      const k = Math.min(1, p.t / POD_FALL);
      const e = k * k;
      p.group.position.set(p.x + 14 * (1 - e), p.y + 60 * (1 - e), p.z - 10 * (1 - e));
      const g = p.group.position;
      this.fx.burst(g.x, g.y + 1, g.z, 2, FX_COLORS.fire, {
        speed: 0.6,
        up: 0.5,
        grav: 0,
        glow: true,
        life: 0.5,
      });
      this.fx.burst(g.x, g.y + 1.5, g.z, 1, FX_COLORS.smoke, {
        speed: 0.4,
        up: 0.3,
        grav: 0,
        life: 2.2,
        size: 2.5,
      });
      if (k >= 1) {
        this.scene.remove(p.group);
        this.falling.splice(i, 1);
      }
    }
  }

  private shakeNodeAt(x: number, z: number): void {
    let best = -1;
    let bd = Infinity;
    forNodesNear(this.island, x, z, 1.5, (id, d2) => {
      if (d2 < bd) {
        bd = d2;
        best = id;
      }
    });
    if (best >= 0) this.nodes.shake(best);
  }

  private nearestMob(x: number, z: number): Actor | null {
    let best: Actor | null = null;
    let bd = 2.5;
    for (const [id, a] of this.mobs) {
      const m = this.client.mobs.get(id);
      if (!m) continue;
      const d = Math.hypot(m.x - x, m.z - z);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  // -------------------------------------------------------------------------
  // Per frame.

  update(dt: number): void {
    this.t += dt;
    WIND.value = this.t;
    // New models (monsters, buildings, held items) cast and catch shadows.
    this.shadeAcc -= dt;
    if (this.shadeAcc <= 0) {
      this.shadeAcc = 0.5;
      shadeAll(this.scene);
    }
    const c = this.client;
    const island = this.island;
    // Hit-stop: the fighters freeze for a beat when a blow lands.
    const adt = this.hitStop > 0 ? dt * 0.1 : dt;
    this.hitStop -= dt;
    // Survivors.
    const meVisible = !!c.me && !c.me.escaped && (c.me.alive || this.me.dying > 0);
    this.me.root.visible = meVisible;
    this.me.root.position.set(c.x, this.y(c.x, c.z), c.z);
    this.me.root.rotation.y = c.ry;
    this.me.setHeld(c.heldSlot()?.id ?? '');
    this.me.update(adt, c.speed, c.mv);
    if (meVisible && c.speed > 0.5) this.footsteps(dt, c.x, c.z, c.mv === 2);
    for (const [id, a] of this.others) {
      if (!c.others.has(id)) {
        this.scene.remove(a.root);
        this.others.delete(id);
      }
    }
    for (const o of c.others.values()) {
      let a = this.others.get(o.id);
      if (!a) {
        a = this.newPlayer(o.id);
        this.others.set(o.id, a);
      }
      a.root.visible = o.alive;
      a.root.position.set(o.x, this.y(o.x, o.z), o.z);
      a.root.rotation.y = o.ry;
      a.setHeld(o.held);
      a.update(adt, o.speed, o.mv);
    }
    // Monsters.
    for (const [id, a] of this.mobs) {
      if (!c.mobs.has(id)) {
        this.scene.remove(a.root);
        this.mobs.delete(id);
      }
    }
    this.emberAcc += dt;
    const embers = this.emberAcc > 0.12;
    if (embers) this.emberAcc = 0;
    for (const m of c.mobs.values()) {
      let a = this.mobs.get(m.id);
      if (!a) {
        a = new Actor(m.kind, String(m.id));
        this.scene.add(a.root);
        this.mobs.set(m.id, a);
      }
      if (m.dying > 0 && a.dying === 0) a.dying = 0.01;
      a.root.position.set(m.x, this.y(m.x, m.z), m.z);
      a.root.rotation.y = m.ry;
      a.update(adt, m.speed, m.state);
      if (m.state === MOB_STATE.strike && a.swing <= 0) a.swing = 1;
      if (m.burning && embers && m.dying === 0) {
        this.fx.burst(m.x, a.root.position.y + 1, m.z, 2, FX_COLORS.fire, {
          speed: 0.6,
          up: 2.5,
          grav: -1,
          glow: true,
          life: 0.6,
        });
      }
    }
    // Buildings: flames, doors, water.
    const time = c.now();
    const roofs = this.roofState();
    for (const [id, b] of this.builds) {
      const net = c.buildings.get(id);
      if (!net) continue;
      const v = b.view;
      if (v.flame) {
        const lit = b.kind === 'torch_post' || c.fuel(net) > 0;
        v.flame.visible = lit;
        if (lit) {
          const k = 1 + Math.sin(this.t * 13 + id) * 0.08 + Math.sin(this.t * 7.3 + id * 2) * 0.06;
          v.flame.scale.set(k, k * (1 + Math.sin(this.t * 9 + id) * 0.1), k);
        }
      }
      if (v.door)
        v.door.rotation.y += ((net.v === 1 ? -1.45 : 0) - v.door.rotation.y) * Math.min(1, dt * 8);
      if (v.door2)
        v.door2.rotation.y += ((net.v === 1 ? 1.45 : 0) - v.door2.rotation.y) * Math.min(1, dt * 8);
      if (v.jaws) {
        // Open while armed, snapped shut while re-arming.
        const shut = (net.v ?? 0) > 0;
        v.jaws.forEach((j, k) => {
          const want = shut ? 0 : (k === 0 ? -1 : 1) * 1.1;
          j.rotation.x += (want - j.rotation.x) * Math.min(1, dt * (shut ? 30 : 4));
        });
      }
      if (v.heart) v.heart.scale.setScalar(1 + Math.max(0, Math.sin(this.t * 5)) * 0.18);
      if (v.water) {
        const k = (net.v ?? 0) / RAIN_MAX;
        v.water.visible = k > 0;
        v.water.position.y = 0.1 + k * 0.35;
      }
      // Garden plots: the crop, rebuilt when it grows or the soil dries.
      if (v.crop) {
        const key = net.crop ? `${net.crop[0]}|${net.crop[1]}|${net.crop[2]}` : '';
        if (v.crop.userData['key'] !== key) {
          v.crop.userData['key'] = key;
          for (const ch of [...v.crop.children]) {
            v.crop.remove(ch);
            ch.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
          }
          if (net.crop) v.crop.add(cropModel(net.crop[0], net.crop[1], net.crop[2] === 1));
        }
      }
      if (v.roof) this.showRoof(v.roof as THREE.Mesh, id, net, roofs);
    }
    this.smokeAcc += dt;
    const smoke = this.smokeAcc > 0.22;
    if (smoke) this.smokeAcc = 0;
    for (const [id, m] of this.dropMeshes) {
      const d = c.drops.get(id);
      if (!d) continue;
      if (m.kind === 'bag') {
        m.obj.rotation.y = this.t * 0.8 + id;
        m.obj.position.y = heightAt(island, d.x, d.z) + Math.sin(this.t * 2 + id) * 0.05;
      } else if (m.kind === 'pod') {
        if (m.light) m.light.visible = Math.sin(this.t * 5 + id) > -0.2;
        // A column of smoke that shows where it came down from far away.
        if (smoke && this.dist(d.x, d.z) < 110)
          this.fx.burst(d.x, m.obj.position.y + 2, d.z, 1, FX_COLORS.smoke, {
            speed: 0.3,
            up: 2.2,
            grav: -0.4,
            life: 4,
            size: 3,
          });
      }
    }
    this.updateFallers(dt);
    this.updateFalling(dt);
    this.updateDanger();
    this.updatePois(dt);
    this.updateTreasure();
    this.updateGhost();
    this.updateGrid();
    this.updateRing();
    this.updateLighting(dt, time);
    // Camera: a little ahead (away from the camera, and where you're heading), so the
    // survivor sits below the HUD's top rows; sprinting and a fight pull it back a touch.
    const rig = this.rig;
    const toCamX = Math.sin(rig.yaw);
    const toCamZ = Math.cos(rig.yaw);
    const run = Math.min(1, c.speed / RUN);
    const ease = 1 - Math.exp(-dt * 2.5);
    this.lead.x += ((c.speed > 0 ? Math.sin(c.ry) : 0) * 2.4 * run - this.lead.x) * ease;
    this.lead.z += ((c.speed > 0 ? Math.cos(c.ry) : 0) * 2.4 * run - this.lead.z) * ease;
    // Build mode: the survivor stands still and the camera looks where you move it.
    const lx = c.build ? c.x + c.buildLook.x : c.x;
    const lz = c.build ? c.z + c.buildLook.z : c.z;
    const target = tmpVec.set(
      lx + this.lead.x - toCamX * rig.ahead,
      this.y(lx, lz) + 0.8,
      lz + this.lead.z - toCamZ * rig.ahead,
    );
    this.focus.lerp(target, 1 - Math.exp(-dt * 8));
    const portrait = this.camera.aspect < 1;
    const want =
      (portrait ? 1.3 : 1.05) *
      this.zoom *
      (1 + (c.mv === 2 ? 0.06 : 0) + this.danger * 0.08 + (c.build ? 0.22 : 0));
    this.camDist += (want - this.camDist) * (1 - Math.exp(-dt * 2));
    const dist = rig.dist * this.camDist;
    const flat = Math.cos(rig.pitch) * dist;
    this.camera.position.set(
      this.focus.x + toCamX * flat,
      this.focus.y + Math.sin(rig.pitch) * dist,
      this.focus.z + toCamZ * flat,
    );
    if (this.camera.fov !== rig.fov) {
      this.camera.fov = rig.fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.lookAt(this.focus);
    this.updateAnchor(toCamX, toCamZ);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.6;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.lookAt(this.focus);
    }
    this.fogFrom = dist;
    this.terrain.update(c.x, c.z, this.terrainRadius);
    this.nodes.update(c.x, c.z, this.nodeRadius, dt, { x: toCamX, z: toCamZ });
    const day = daylight(c.info().phase);
    this.ambient.update(dt, this.t, c.x, c.z, day, c.info().bloom, this.dangerSpots);
    this.fx.update(dt);
    this.updateWeather(dt);
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i] as Popup;
      p.life -= dt;
      p.y += dt * 0.7;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
    this.updateLabels();
  }

  /**
   * Where the survivor's head is on screen when they stand still (the bag window pops up
   * beside it). It only moves when the camera or the screen changes.
   */
  private updateAnchor(toCamX: number, toCamZ: number): void {
    this.camera.updateMatrixWorld();
    const r = this.rig;
    tmpVec
      .set(this.focus.x + toCamX * r.ahead, this.focus.y + 1, this.focus.z + toCamZ * r.ahead)
      .project(this.camera);
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    const x = Math.round((tmpVec.x * 0.5 + 0.5) * w);
    const y = Math.round((-tmpVec.y * 0.5 + 0.5) * h);
    const a = this.client.anchor;
    if (Math.abs(a.x - x) > 2 || Math.abs(a.y - y) > 2 || a.w !== w || a.h !== h) {
      this.client.anchor = { x, y, w, h };
      this.client.touch();
    }
  }

  /** Dust (or splashes) at the survivor's feet. */
  private footsteps(dt: number, x: number, z: number, sprint: boolean): void {
    this.stepAcc += dt * (sprint ? 1.7 : 1);
    if (this.stepAcc < 0.3) return;
    this.stepAcc = 0;
    const h = heightAt(this.island, x, z);
    if (h < 0.05) {
      this.fx.burst(x, Math.max(h, -0.5) + 0.1, z, 3, FX_COLORS.water, {
        speed: 1.4,
        up: 2.2,
        life: 0.5,
      });
      return;
    }
    const biome = biomeAt(this.island, x, z);
    const colors = biome === BIOME.beach ? FX_COLORS.sand : FX_COLORS.dust;
    this.fx.burst(x, h + 0.08, z, sprint ? 2 : 1, colors, {
      speed: 0.6,
      up: 0.8,
      grav: 2,
      life: 0.45,
      size: 0.8,
    });
  }

  /** How close the Bloom is (drums in the music, birds take off, the camera pulls back). */
  private updateDanger(): void {
    const c = this.client;
    let n = 0;
    this.dangerSpots.length = 0;
    for (const m of c.mobs.values()) {
      if (m.dying > 0 || !MONSTERS[m.kind].hostile) continue;
      const d = Math.hypot(m.x - c.x, m.z - c.z);
      if (d < 30) this.dangerSpots.push({ x: m.x, z: m.z });
      if (m.kind === 'mother' && d < 45) n += 3;
      else if (d < 18) {
        const active =
          m.state === MOB_STATE.run || m.state === MOB_STATE.windup || m.state === MOB_STATE.strike;
        n += active ? 1 : 0.35;
      }
    }
    this.danger = c.me?.alive ? Math.min(1, n / 3) : 0;
  }

  private roofKey = '';
  private roofMasks = new Map<number, number>();
  private roofLinks = new Map<number, number[]>();
  private roofFaded = new Set<number>();

  /** Roof tiles: who touches whom (for eaves and for lifting the roof you're under). */
  private roofState(): RoofState {
    const c = this.client;
    const tiles = [...c.buildings.values()].filter((b) => BUILDINGS[b.kind]?.layer === 'roof');
    const key = tiles.map((b) => `${b.id}:${b.x}:${b.z}`).join('|');
    if (key !== this.roofKey) {
      this.roofKey = key;
      this.roofMasks = new Map();
      this.roofLinks = new Map();
      for (const a of tiles) {
        const fa = footprint(a.kind, a.x, a.z, a.rot);
        let mask = 0;
        const links: number[] = [];
        for (const b of tiles) {
          if (a === b) continue;
          const fb = footprint(b.kind, b.x, b.z, b.rot);
          const spanX = Math.min(fa.maxX, fb.maxX) - Math.max(fa.minX, fb.minX);
          const spanZ = Math.min(fa.maxZ, fb.maxZ) - Math.max(fa.minZ, fb.minZ);
          if (spanX > 0.5 && Math.abs(fb.maxZ - fa.minZ) < 0.15) mask |= ROOF_N;
          else if (spanX > 0.5 && Math.abs(fb.minZ - fa.maxZ) < 0.15) mask |= ROOF_S;
          else if (spanZ > 0.5 && Math.abs(fb.minX - fa.maxX) < 0.15) mask |= ROOF_E;
          else if (spanZ > 0.5 && Math.abs(fb.maxX - fa.minX) < 0.15) mask |= ROOF_W;
          else continue;
          links.push(b.id);
        }
        this.roofMasks.set(a.id, mask);
        this.roofLinks.set(a.id, links);
      }
    }
    // Auto: the whole roof over you (and, building, over the cursor) fades; every tile
    // joined to the one above you goes with it.
    const mode: RoofView = c.build ? c.roofView : 'auto';
    const faded = new Set<number>();
    if (mode === 'auto') {
      const spots = [{ x: c.x, z: c.z }];
      const at = c.buildAt();
      if (at) spots.push(at);
      for (const p of spots) {
        const start = tiles.find((b) =>
          circleHitsBox(p.x, p.z, 0.4, footprint(b.kind, b.x, b.z, b.rot)),
        );
        const queue = start ? [start.id] : [];
        while (queue.length) {
          const id = queue.pop() as number;
          if (faded.has(id)) continue;
          faded.add(id);
          for (const n of this.roofLinks.get(id) ?? []) if (!faded.has(n)) queue.push(n);
        }
      }
    }
    this.roofFaded = faded;
    return { masks: this.roofMasks, faded, mode };
  }

  private showRoof(roof: THREE.Mesh, id: number, net: { kind: string; rot: number }, s: RoofState) {
    const mask = s.masks.get(id) ?? 0;
    if (roof.userData['mask'] !== mask) {
      roof.userData['mask'] = mask;
      roof.geometry = roofGeometry(net.kind, mask);
    }
    // Shaped in world directions: undo the piece's own turn.
    roof.rotation.y = -net.rot * (Math.PI / 2);
    roof.visible = s.mode !== 'off';
    const fade = s.faded.has(id);
    const mat = fade ? ROOF_FADE : MAT.lit;
    if (roof.material !== mat) roof.material = mat;
    // A faint roof doesn't darken the room under it.
    roof.castShadow = !fade;
  }

  /** The bunker door swings open; the wreck's breach floods with the tide. */
  private updateSecret(p: PoiView, dt: number): void {
    const c = this.client;
    const door = p.group.getObjectByName('door');
    if (door) {
      const want = c.flags.has('bunker_open') ? -1.9 : 0;
      door.rotation.y += (want - door.rotation.y) * Math.min(1, dt * 2);
    }
    const flood = p.group.getObjectByName('flood');
    if (flood) flood.visible = !lowTide(c.time);
  }

  /** Treasure maps' X on the ground, until it's dug up. */
  private updateTreasure(): void {
    const want = new Set<number>();
    for (const t of this.client.treasureMarks()) {
      want.add(t.n);
      if (this.marks.has(t.n)) continue;
      const m = treasureMark();
      m.position.set(t.x, this.y(t.x, t.z), t.z);
      m.rotation.y = t.n;
      this.scene.add(m);
      this.marks.set(t.n, m);
    }
    for (const [n, m] of this.marks) {
      if (want.has(n)) continue;
      this.scene.remove(m);
      this.marks.delete(n);
    }
  }

  private updatePois(dt: number): void {
    const c = this.client;
    for (const p of this.pois) {
      const near = Math.abs(p.poi.x - c.x) < 140 && Math.abs(p.poi.z - c.z) < 140;
      p.group.visible = near;
      if (!near) continue;
      if (p.poi.secret) this.updateSecret(p, dt);
      for (const s of p.spots) {
        const spot = s.spot;
        // Inside the bunker: there once the door is open.
        s.group.visible = !spot.after || c.flags.has(spot.after);
        let gone = false;
        if (spot.kind === 'loot') gone = c.flags.has(`loot:${spot.id}`);
        if (spot.kind === 'antenna') gone = c.flags.has('antenna_taken');
        if (s.item) s.item.visible = !gone;
        const open = spot.kind === 'lock' && c.flags.has(`${spot.lock ?? 'cargo'}_open`);
        if (s.halo) {
          const done =
            gone ||
            open ||
            (spot.kind === 'generator' && c.flags.has('bunker_power')) ||
            ((spot.kind === 'note' || spot.kind === 'tag') && c.notes.has(spot.id));
          s.halo.visible = !done || spot.kind === 'beacon';
          s.halo.scale.setScalar(1 + Math.sin(this.t * 3) * 0.08);
        }
        if (s.light) {
          if (spot.kind === 'lock')
            (s.light.material as THREE.MeshBasicMaterial).color.setHex(open ? 0x40ff60 : 0xff3030);
          if (spot.kind === 'generator')
            (s.light.material as THREE.MeshBasicMaterial).color.setHex(
              c.flags.has('bunker_power') ? 0x40ff60 : 0xff3030,
            );
          if (spot.kind === 'beacon')
            s.light.visible = c.rescue.phase === 'calling' ? Math.sin(this.t * 8) > 0 : true;
        }
      }
    }
    // The helicopter comes in during the last seconds of the call and waits.
    const r = c.rescue;
    const tower = this.island.poiById['tower'];
    const pad = tower?.spots.find((s) => s.kind === 'heli');
    if (!tower || !pad) return;
    const hx = tower.x + pad.dx;
    const hz = tower.z + pad.dz;
    let want: number | null = null;
    const left = c.rescueLeft();
    if (r.phase === 'landed') want = 0;
    else if (r.phase === 'calling' && left < 20) want = (left / 20) * 50;
    if (want === null) {
      if (this.heli.group.visible) {
        this.heliY += dt * 12;
        if (this.heliY > 70) this.heli.group.visible = false;
      }
    } else {
      if (!this.heli.group.visible) this.heliY = 60;
      this.heli.group.visible = true;
      this.heliY += (want - this.heliY) * Math.min(1, dt * 1.5);
    }
    this.heli.group.position.set(hx, heightAt(this.island, hx, hz) + this.heliY, hz);
    this.heli.rotor.rotation.y += dt * 25;
  }

  private updateGhost(): void {
    const g = this.client.ghost;
    if (!g) {
      if (this.ghost) {
        this.scene.remove(this.ghost.group);
        this.ghost = null;
      }
      return;
    }
    if (!this.ghost || this.ghost.kind !== g.kind) {
      if (this.ghost) this.scene.remove(this.ghost.group);
      const view = buildingModel(g.kind);
      this.ghost = { kind: g.kind, group: view.group };
      this.scene.add(view.group);
    }
    const mat = g.problem ? this.ghostBad : this.ghostOk;
    this.ghost.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = mat;
    });
    this.ghost.group.position.set(g.x, heightAt(this.island, g.x, g.z) + 0.02, g.z);
    this.ghost.group.rotation.y = g.rot * (Math.PI / 2);
  }

  /** Build mode's grid: lines on the ground around the piece, following the slopes. */
  private updateGrid(): void {
    const c = this.client;
    if (!c.build || !this.gridShow) {
      if (this.grid) this.grid.visible = false;
      return;
    }
    const g = c.buildPrefs.grid;
    const at = c.ghost ?? { x: c.x, z: c.z };
    const cx = Math.round(at.x / g) * g;
    const cz = Math.round(at.z / g) * g;
    const key = `${cx}|${cz}|${g}`;
    if (!this.grid) {
      this.grid = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
        }),
      );
      this.grid.renderOrder = 2;
      this.grid.frustumCulled = false;
      this.scene.add(this.grid);
    }
    this.grid.visible = true;
    if (key === this.gridKey) return;
    this.gridKey = key;
    const n = Math.round(GRID_REACH / g);
    const pts: number[] = [];
    const y = (x: number, z: number) => Math.max(heightAt(this.island, x, z), 0) + 0.07;
    for (let k = -n; k <= n; k++) {
      for (let s = -GRID_REACH; s < GRID_REACH; s += 1) {
        const lx = cx + k * g;
        const lz = cz + k * g;
        pts.push(lx, y(lx, cz + s), cz + s, lx, y(lx, cz + s + 1), cz + s + 1);
        pts.push(cx + s, y(cx + s, lz), lz, cx + s + 1, y(cx + s + 1, lz), lz);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.grid.geometry.dispose();
    this.grid.geometry = geo;
  }

  /** A spot on screen (px in the canvas) on the ground of the island. */
  groundAt(px: number, py: number): { x: number; z: number } | null {
    if (!this.w || !this.h) return null;
    tmpV2.set((px / this.w) * 2 - 1, -(py / this.h) * 2 + 1);
    this.raycaster.setFromCamera(tmpV2, this.camera);
    const { origin: o, direction: d } = this.raycaster.ray;
    if (d.y > -0.01) return null;
    let y = this.y(this.client.x, this.client.z);
    let x = o.x;
    let z = o.z;
    for (let i = 0; i < 4; i++) {
      const t = (y - o.y) / d.y;
      x = o.x + d.x * t;
      z = o.z + d.z * t;
      y = Math.max(heightAt(this.island, x, z), 0);
    }
    return { x, z };
  }

  /**
   * The built piece under a spot on screen (px in the canvas): what you see there, nearest
   * first, so a tap on a wall picks the wall and not the ground behind it. Roofs only count
   * with the roof switch on.
   */
  pickBuilding(px: number, py: number): number | null {
    if (!this.w || !this.h) return null;
    tmpV2.set((px / this.w) * 2 - 1, -(py / this.h) * 2 + 1);
    this.raycaster.setFromCamera(tmpV2, this.camera);
    const roofs = this.client.roofView === 'on';
    const shown = (o: THREE.Object3D | null): boolean => {
      for (let p = o; p; p = p.parent) if (!p.visible) return false;
      return true;
    };
    let best: number | null = null;
    let bestD = Infinity;
    for (const [id, b] of this.builds) {
      const g = b.view.group;
      if (!g.visible) continue;
      for (const hit of this.raycaster.intersectObject(g, true)) {
        if (hit.distance >= bestD) break;
        if (!shown(hit.object)) continue;
        if (hit.object === b.view.roof && (!roofs || this.roofFaded.has(id))) continue;
        bestD = hit.distance;
        best = id;
        break;
      }
    }
    return best;
  }

  private updateRing(): void {
    const t = this.client.target;
    // The remove tool points at a piece: a red ring under it.
    const rm = this.client.build?.remove;
    const doomed = rm !== null && rm !== undefined ? this.client.buildings.get(rm) : undefined;
    const doomView = doomed ? this.builds.get(rm as number)?.view : undefined;
    if (doomView) {
      if (this.doomId !== rm) {
        this.doomId = rm as number;
        // The roof mesh is shaped in world directions, so the box fits it too.
        this.doomBox.setFromObject(doomView.group);
      }
      this.doomBox.visible = true;
    } else {
      this.doomId = null;
      this.doomBox.visible = false;
    }
    if (doomed) {
      this.ring.visible = true;
      this.ring.position.set(doomed.x, this.y(doomed.x, doomed.z) + 0.06, doomed.z);
      this.ring.scale.setScalar(1.4 * (1 + Math.sin(this.t * 6) * 0.05));
      (this.ring.material as THREE.MeshBasicMaterial).color.setHex(0xff5a5a);
      return;
    }
    if (!t || this.client.ghost) {
      this.ring.visible = false;
      return;
    }
    this.ring.visible = true;
    let r = 0.8;
    if (t.kind === 'mob') {
      const m = this.client.mobs.get(Number(t.id));
      if (m) {
        r = m.kind === 'mother' ? 3 : 0.9;
        this.ring.position.set(m.x, this.y(m.x, m.z) + 0.06, m.z);
      }
    } else {
      if (t.kind === 'node') {
        const type = this.island.nodeType[Number(t.id)] as number;
        r = type === NODE.rock || type === NODE.jungle || type === NODE.vines ? 1.4 : 0.9;
      }
      if (t.kind === 'build') r = 1.3;
      this.ring.position.set(t.x, this.y(t.x, t.z) + 0.06, t.z);
    }
    this.ring.scale.setScalar(r * (1 + Math.sin(this.t * 6) * 0.05));
    (this.ring.material as THREE.MeshBasicMaterial).color.setHex(t.hostile ? 0xff5a5a : 0xffffff);
  }

  private updateLighting(dt: number, time: number): void {
    const c = this.client;
    const info = c.info();
    const day = daylight(info.phase);
    const bloom = info.bloom;
    // Dusk/dawn warmth peaks while daylight is half up.
    const warm = Math.max(0, 1 - Math.abs(day - 0.5) * 2.2);
    const sky = tmpColor.copy(bloom ? SKY_BLOOM : SKY_NIGHT).lerp(this.skyDay, day);
    sky.lerp(this.skyDusk, warm * 0.6 * (1 - this.sky.cloud));
    // Clouds turn the sky grey; lightning lights it up.
    sky.lerp(tmpColor2.setHex(0x7d8794).multiplyScalar(0.25 + day * 0.75), this.sky.cloud * 0.65);
    sky.lerp(tmpColor2.setHex(0xdde6ff), this.flash * 0.6);
    this.fog.color.copy(sky);
    toneMapped(sky, this.scene.background as THREE.Color);
    const fog = this.fogMul * this.climateFog;
    // Rain and fog close the view in.
    const closer = 1 - this.sky.rain * 0.3 - this.sky.fog * 0.55;
    this.fog.near = this.fogFrom + (-14 + day * 40) * fog * closer;
    this.fog.far = this.fogFrom + (30 + day * 70) * fog * closer;
    this.hemi.color.copy(bloom ? HEMI_BLOOM : HEMI_NIGHT).lerp(this.hemiDay, day);
    this.hemi.groundColor.copy(GROUND_NIGHT).lerp(this.groundDay, day);
    this.hemi.intensity = (0.6 + day * 0.75) * (1 - this.sky.cloud * 0.15) + this.flash * 2.5;
    // The sun crosses from east to west, low and warm at dawn and dusk (long shadows); by
    // night a pale moon stands high in the south-west.
    const arc = (info.phase - NIGHT_END + 0.04) / (NIGHT_START - NIGHT_END + 0.08);
    const a = Math.min(1, Math.max(0, arc)) * Math.PI;
    const sunDir = tmpVec.set(Math.cos(a) * 0.95, 0.3 + Math.sin(a) * 1.05, 0.5).normalize();
    this.sunDir.copy(MOON_DIR).lerp(sunDir, day).normalize();
    this.sun.intensity = (0.4 + day * 2.5) * (1 - this.sky.cloud * 0.75);
    this.sun.color
      .copy(MOON)
      .lerp(SUN_DAY, day)
      .lerp(SUN_DUSK, warm * 0.75);
    // The shadow box sits a little past what the camera looks at (more ground shows there).
    const far = 6 * this.camDist;
    this.sunShadow.follow(
      this.focus.x - Math.sin(this.rig.yaw) * far,
      this.focus.y,
      this.focus.z - Math.cos(this.rig.yaw) * far,
      this.sunDir,
    );
    this.terrain.setWaterTint(day, bloom);
    this.sound.setMood(1 - day, bloom, this.danger, c.rescue.phase === 'calling');
    // Fire light: the nearest fires and torches get the four point lights.
    const sources: { x: number; z: number; y: number; r: number; d: number; color?: number }[] = [];
    for (const b of c.buildings.values()) {
      const light = BUILDINGS[b.kind]?.light;
      if (!light) continue;
      if (b.kind === 'campfire' && c.fuel(b) <= 0) continue;
      sources.push({
        x: b.x,
        z: b.z,
        y: b.kind === 'torch_post' ? 2.2 : b.kind === 'heart_lantern' ? 1.9 : 1,
        r: light,
        d: this.dist(b.x, b.z),
        ...(b.kind === 'heart_lantern' ? { color: 0xff7ab8 } : {}),
      });
    }
    const torch = ITEMS['torch']?.light ?? 8;
    if (c.me?.alive && c.heldSlot()?.id === 'torch')
      sources.push({ x: c.x, z: c.z, y: 2, r: torch, d: 0 });
    for (const o of c.others.values()) {
      if (o.alive && o.held === 'torch')
        sources.push({ x: o.x, z: o.z, y: 2, r: torch, d: this.dist(o.x, o.z) });
    }
    sources.sort((a, b) => a.d - b.d);
    const night = 1 - day;
    this.lights.forEach((l, i) => {
      const s = sources[i];
      if (!s || s.d > 60) {
        l.intensity = 0;
        return;
      }
      l.color.setHex(s.color ?? 0xffa04a);
      l.position.set(s.x, this.y(s.x, s.z) + s.y, s.z);
      l.distance = s.r * 2;
      const flicker = 1 + Math.sin(this.t * 11 + i * 3) * 0.06 + Math.sin(this.t * 17 + i) * 0.04;
      l.intensity = (6 + night * 18) * flicker;
    });
    void dt;
    void time;
  }

  private updateLabels(): void {
    const c = this.client;
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    const project = (x: number, y: number, z: number): { x: number; y: number } | null => {
      tmpVec.set(x, y, z).project(this.camera);
      if (tmpVec.z > 1 || tmpVec.x < -1.2 || tmpVec.x > 1.2 || tmpVec.y < -1.2 || tmpVec.y > 1.2)
        return null;
      return { x: (tmpVec.x * 0.5 + 0.5) * w, y: (-tmpVec.y * 0.5 + 0.5) * h };
    };
    this.labels.begin();
    for (const o of c.others.values()) {
      if (!o.alive) continue;
      const p = project(o.x, this.y(o.x, o.z) + 2.3, o.z);
      const info = c.players.find((q) => q.id === o.id);
      if (p && info) this.labels.add(p.x, p.y, info.name, 'tag-name');
    }
    // Animals that trust someone wear their name.
    for (const [id, pet] of c.pets) {
      const m = c.mobs.get(id);
      if (!m || m.dying > 0) continue;
      const p = project(m.x, this.y(m.x, m.z) + 1.4, m.z);
      const icon = MONSTERS[m.kind].animal?.icon ?? '';
      if (p)
        this.labels.add(p.x, p.y, `${icon} ${pet.name}${pet.ready ? ' ✨' : ''}`, 'tag-name pet');
    }
    for (const m of c.mobs.values()) {
      if (m.dying > 0 || m.hp >= 100 || !MONSTERS[m.kind].hostile || m.kind === 'mother') continue;
      const p = project(m.x, this.y(m.x, m.z) + (m.kind === 'thornback' ? 2 : 2.3), m.z);
      if (p) this.labels.add(p.x, p.y, '', 'tag-hp', 1, m.hp / 100);
    }
    if (this.numbers)
      for (const t of this.fx.texts) {
        const p = project(t.x, t.y, t.z);
        if (p)
          this.labels.add(
            p.x,
            p.y,
            t.text,
            t.color === '#ff5a5a' || t.color === '#ffb0b0' ? 'tag-dmg hurt' : 'tag-dmg',
            Math.min(1, t.life * 2),
          );
      }
    const base = this.y(c.x, c.z);
    // Chat bubbles: each speaker's newest line, for a few seconds.
    const said = new Map<string, ChatLine>();
    for (const l of c.recentChat()) said.set(l.from, l);
    for (const l of said.values()) {
      const age = c.chatAge(l);
      if (age > BUBBLE_SECONDS) continue;
      const o = l.mine ? null : c.others.get(l.from);
      if (!l.mine && !o?.alive) continue;
      const x = o ? o.x : c.x;
      const z = o ? o.z : c.z;
      const p = project(x, this.y(x, z) + 2.3, z);
      const text = l.text.length > 64 ? `${l.text.slice(0, 62)}…` : l.text;
      if (p)
        this.labels.add(
          p.x,
          p.y,
          text,
          o ? 'tag-say' : 'tag-say me',
          Math.min(1, BUBBLE_SECONDS - age),
        );
    }
    for (const g of this.popups) {
      const p = project(c.x, base + g.y, c.z);
      if (p)
        this.labels.add(p.x, p.y, g.text, 'tag-gain', Math.min(1, g.life * 2), undefined, g.icon);
    }
    this.labels.end();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Rain falling around the camera, the sky blending to the weather, lightning fading. */
  private updateWeather(dt: number): void {
    const want = WEATHER_LOOK[this.client.weather];
    const k = Math.min(1, dt * 0.35);
    this.sky.cloud += (want.cloud - this.sky.cloud) * k;
    this.sky.rain += (want.rain - this.sky.rain) * k;
    this.sky.fog += (want.fog - this.sky.fog) * k;
    const storm = this.client.weather === 'storm';
    const ground = this.y(this.focus.x, this.focus.z);
    this.rain.update(dt, this.focus, ground, this.sky.rain, storm ? 7 : 2);
    this.sound.setRain(this.sky.rain);
    this.flash = Math.max(0, this.flash - dt * 4);
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i] as (typeof this.bolts)[number];
      b.life -= dt;
      (b.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, b.life * 4);
      if (b.life <= 0) {
        this.scene.remove(b.line);
        b.line.geometry.dispose();
        (b.line.material as THREE.Material).dispose();
        this.bolts.splice(i, 1);
      }
    }
  }

  dispose(): void {
    this.rain.dispose();
    this.ambient.dispose();
    this.renderer.dispose();
  }
}
