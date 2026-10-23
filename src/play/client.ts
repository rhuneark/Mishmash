// A player's view of the island: a mirror of what the authority sends, plus
// the local survivor (moved here, reported to the authority) and what the
// action button would do right now.

import { BUILDINGS, CAMPFIRE_FUEL_MAX, STATION_RANGE } from '../game/content/buildings';
import { ITEMS, type ItemDef, type ToolKind } from '../game/content/items';
import { MONSTERS, type MonsterKind } from '../game/content/monsters';
import { NODES } from '../game/content/nodes';
import { POIS, type PoiDef, type Spot } from '../game/content/pois';
import { RECIPES, type Station } from '../game/content/recipes';
import { currentObjective, type Objective } from '../game/objectives';
import { HOTBAR, bestSlot, hasAll, jobScore } from '../game/sim/inventory';
import { placementProblem, snapPlacement } from '../game/sim/place';
import {
  MOB_KINDS,
  MOB_STATE,
  PartBuffer,
  type BuildingNet,
  type C2S,
  type DropNet,
  type FxKind,
  type MeNet,
  type PlayerInfo,
  type RescueNet,
  type S2C,
  type Slot,
  type Snapshot,
  type UseKind,
} from '../game/sim/protocol';
import { MONSTER_RADIUS } from '../game/sim/sim';
import { dayInfo, type DayInfo } from '../game/sim/time';
import { footprint, pushOutOfBox } from '../game/sim/types';
import { DEEP, HALF, forNodesNear, heightAt, poolNear, type Island } from '../game/world';
import type { Link } from './link';

export const WALK = 4.2;
export const RUN = 6.8;
const RADIUS = 0.4;
const STAMINA_DRAIN = 16;
const STAMINA_REGEN = 14;
const POS_EVERY = 0.1;
/** A little short of the authority's reach, so lag doesn't turn a tap into nothing. */
const NODE_REACH = 2.7;
const SPOT_REACH = 3.6;
const BUILD_REACH = 3.8;
const DROP_REACH = 3;
const GHOST_AHEAD = 2.6;
const TOAST_SECONDS = 3.6;
/** Auto tool: seconds after the last swing before switching back. */
const AUTO_BACK = 1.8;

export interface Other {
  id: string;
  x: number;
  z: number;
  ry: number;
  tx: number;
  tz: number;
  tr: number;
  mv: number;
  hp: number;
  held: string;
  alive: boolean;
  speed: number;
}

export interface MobMirror {
  id: number;
  kind: MonsterKind;
  x: number;
  z: number;
  ry: number;
  tx: number;
  tz: number;
  tr: number;
  state: number;
  hp: number;
  burning: boolean;
  speed: number;
  /** Seconds left of the death animation once it's gone (0 = alive). */
  dying: number;
  seen: number;
}

export interface Target {
  kind: UseKind;
  id: number | string;
  x: number;
  z: number;
  verb: string;
  name: string;
  hostile: boolean;
  /** Opens a panel instead of sending 'use'. */
  panel?: Panel;
  /** A building that can be taken down. */
  building?: number;
}

export type Panel = 'bag' | 'craft' | 'storage' | 'keypad' | 'journal' | 'map' | 'menu' | 'note';

/** Pages of the pause menu. */
export type MenuPage = 'main' | 'settings' | 'friends' | 'howto';

export interface Toast {
  id: number;
  text: string;
  until: number;
}

export interface Banner {
  id: number;
  text: string;
  kind: 'dusk' | 'night' | 'bloom' | 'dawn' | 'info';
}

export type ClientFx =
  | { type: 'fx'; k: FxKind; x: number; z: number; by?: string; n?: number; r?: number }
  | { type: 'node'; id: number; gone: boolean; fell: boolean }
  /** Items that just landed in your bag (picked up, crafted, taken). */
  | { type: 'gain'; id: string; n: number }
  | { type: 'swing'; id: string }
  | { type: 'build'; b: BuildingNet; fresh: boolean }
  | { type: 'unbuild'; id: number }
  | { type: 'drop'; d: DropNet }
  | { type: 'undrop'; id: number }
  | { type: 'event'; e: string }
  | { type: 'reset' };

export interface MoveInput {
  /** -1..1 screen right. */
  x: number;
  /** -1..1 screen down (south, +z). */
  z: number;
  sprint: boolean;
}

export interface Built extends BuildingNet {
  /** Island time this update arrived (campfire fuel counts down from it). */
  at: number;
}

export class GameClient {
  readonly link: Link;
  readonly name: string;
  island: Island | null = null;
  seed = 0;
  you = '';
  phase: 'connecting' | 'building' | 'ready' = 'connecting';
  waitText = 'Connecting…';
  status: 'ok' | 'reconnecting' | 'lost' = 'ok';

  // Mirror of the island.
  time = 0;
  private timeAt = 0;
  readonly nodes = new Map<number, { hp: number; until: number }>();
  readonly buildings = new Map<number, Built>();
  readonly drops = new Map<number, DropNet>();
  flags = new Set<string>();
  notes = new Set<string>();
  players: PlayerInfo[] = [];
  rescue: RescueNet = { phase: 'none', left: 0 };
  private rescueAt = 0;
  me: MeNet | null = null;
  readonly others = new Map<string, Other>();
  readonly mobs = new Map<number, MobMirror>();

  // The local survivor.
  x = 0;
  z = 0;
  ry = Math.PI;
  speed = 0;
  mv = 0;
  stamina = 100;
  private tired = false;
  private resync = true;
  private posAcc = 0;
  private lastSent = '';
  private nextUse = 0;
  private clock = 0;

  // What the action button does.
  target: Target | null = null;
  ghost: { kind: string; x: number; z: number; rot: number; problem: string | null } | null = null;
  private ghostTurn = 0;

  // UI state.
  panel: Panel | null = null;
  /** The quick bag/craft panel (doesn't stop you moving). */
  quickOpen = false;
  quickTab: 'bag' | 'craft' = 'bag';
  menuPage: MenuPage = 'main';
  /** Where the survivor stands on screen (px; the view keeps it up to date). */
  anchor = { x: 0, y: 0, w: 0, h: 0 };
  /** Auto tool / weapon (Menu › Settings › Gameplay). */
  auto = { tool: true, weapon: true, back: true };
  /** What an automatic switch replaced, to switch back to. */
  private autoSwap: {
    /** The slot you held before. */
    prev: number;
    /** Bag slot the tool came from (swapped into your hand), or null (a hotbar slot). */
    bag: number | null;
    tool: string;
    until: number;
  } | null = null;
  storageId: number | null = null;
  noteId: string | null = null;
  /** Where closing a note returns to (the journal, or the game). */
  noteBack: Panel | null = null;
  toasts: Toast[] = [];
  banner: Banner | null = null;
  private bannerUntil = 0;
  won = false;
  hurtFlash = 0;
  private uid = 1;

  private readonly welcome = new PartBuffer();
  private pending: S2C[] = [];
  private readonly fxListeners: ((e: ClientFx) => void)[] = [];
  private readonly listeners = new Set<() => void>();
  version = 0;
  private changed = false;

  constructor(
    link: Link,
    name: string,
    private readonly islandFor: (seed: number) => Island,
  ) {
    this.link = link;
    this.name = name;
    link.onMessage((msg) => this.receive(msg));
    link.onStatus((s) => {
      this.status = s;
      this.touch();
    });
  }

  start(): void {
    this.link.send({ type: 'hello', name: this.name });
  }

  // -------------------------------------------------------------------------
  // Change notification (React reads through useSyncExternalStore).

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getVersion = (): number => this.version;

  touch(): void {
    this.changed = true;
  }

  /** Called once per frame: tells React about changes since the last frame. */
  flushChanges(): void {
    if (!this.changed) return;
    this.changed = false;
    this.version++;
    for (const cb of this.listeners) cb();
  }

  onFx(cb: (e: ClientFx) => void): void {
    this.fxListeners.push(cb);
  }

  private emit(e: ClientFx): void {
    for (const cb of this.fxListeners) cb(e);
  }

  send(msg: C2S): void {
    this.link.send(msg);
  }

  // -------------------------------------------------------------------------
  // Messages from the authority.

  private receive(msg: S2C): void {
    if (msg.type === 'welcome') {
      const whole = this.welcome.add(msg.part, msg.parts, msg.data);
      if (whole === null) return;
      let snap: Snapshot;
      try {
        snap = JSON.parse(whole) as Snapshot;
      } catch {
        return;
      }
      this.you = msg.you;
      if (this.island && this.island.seed === snap.seed) {
        this.applySnapshot(snap);
        return;
      }
      // Building a new island takes a moment: show the loading screen first.
      this.phase = 'building';
      this.waitText = 'Building the island…';
      this.touch();
      this.flushChanges();
      setTimeout(() => {
        this.island = this.islandFor(snap.seed);
        this.applySnapshot(snap);
        const queued = this.pending;
        this.pending = [];
        for (const m of queued) this.receive(m);
      }, 60);
      return;
    }
    if (!this.island) {
      if (msg.type === 'wait') {
        this.waitText = msg.text;
        this.touch();
      } else {
        this.pending.push(msg);
      }
      return;
    }
    switch (msg.type) {
      case 'wait':
        this.waitText = msg.text;
        break;
      case 'tick':
        this.onTick(msg.t, msg.p, msg.m);
        return;
      case 'me': {
        const before = this.me;
        if (before && msg.me.hp < before.hp - 0.5 && msg.me.alive) this.hurtFlash = 1;
        if (before?.alive && msg.me.alive) this.gains(before.inv, msg.me.inv);
        this.me = msg.me;
        break;
      }
      case 'players':
        this.players = msg.list;
        for (const id of [...this.others.keys()])
          if (!msg.list.some((p) => p.id === id)) this.others.delete(id);
        break;
      case 'node': {
        const was = this.nodes.get(msg.id);
        const fell = msg.gone === 1 && !(was && was.until !== 0);
        if (msg.gone) this.nodes.set(msg.id, { hp: 0, until: 1 });
        else if (NODES[this.island.nodeType[msg.id] as number]?.hp === msg.hp)
          this.nodes.delete(msg.id);
        else this.nodes.set(msg.id, { hp: msg.hp, until: 0 });
        this.emit({ type: 'node', id: msg.id, gone: msg.gone === 1, fell });
        this.ghost = null;
        break;
      }
      case 'build': {
        const fresh = !this.buildings.has(msg.b.id);
        this.buildings.set(msg.b.id, { ...msg.b, at: this.time });
        this.emit({ type: 'build', b: msg.b, fresh });
        this.ghost = null;
        break;
      }
      case 'unbuild':
        this.buildings.delete(msg.id);
        if (this.storageId === msg.id) {
          this.storageId = null;
          if (this.panel === 'storage') this.panel = null;
        }
        this.emit({ type: 'unbuild', id: msg.id });
        this.ghost = null;
        break;
      case 'drop':
        this.drops.set(msg.d.id, msg.d);
        this.emit({ type: 'drop', d: msg.d });
        break;
      case 'undrop':
        this.drops.delete(msg.id);
        this.emit({ type: 'undrop', id: msg.id });
        break;
      case 'fx':
        this.onFxMsg(msg);
        return;
      case 'toast':
        this.toast(msg.text);
        break;
      case 'progress':
        this.flags = new Set(msg.flags);
        this.notes = new Set(msg.notes);
        break;
      case 'event':
        this.onEvent(msg.e, msg.text, msg.id);
        break;
      case 'rescue':
        this.rescue = msg.r;
        this.rescueAt = this.time;
        break;
      case 'save':
        return;
    }
    this.touch();
  }

  private applySnapshot(s: Snapshot): void {
    this.seed = s.seed;
    this.setTime(s.time);
    this.nodes.clear();
    for (const [id, hp, until] of s.nodes) this.nodes.set(id, { hp, until });
    this.buildings.clear();
    for (const b of s.buildings) this.buildings.set(b.id, { ...b, at: s.time });
    this.drops.clear();
    for (const d of s.drops) this.drops.set(d.id, d);
    this.flags = new Set(s.flags);
    this.notes = new Set(s.notes);
    this.players = s.players;
    this.rescue = s.rescue;
    this.rescueAt = s.time;
    this.others.clear();
    this.mobs.clear();
    this.resync = true;
    this.phase = 'ready';
    this.emit({ type: 'reset' });
    this.touch();
  }

  /** "+3 Wood": what's new in the bag (moving things around changes nothing). */
  private gains(before: (Slot | null)[], after: (Slot | null)[]): void {
    const total = (inv: (Slot | null)[]) => {
      const m = new Map<string, number>();
      for (const s of inv) if (s) m.set(s.id, (m.get(s.id) ?? 0) + s.n);
      return m;
    };
    const a = total(before);
    for (const [id, n] of total(after)) {
      const more = n - (a.get(id) ?? 0);
      if (more > 0) this.emit({ type: 'gain', id, n: more });
    }
  }

  private setTime(t: number): void {
    this.time = t;
    this.timeAt = this.clock;
  }

  /** Island time now (smoothed between ticks). */
  now(): number {
    return this.time + Math.min(0.5, this.clock - this.timeAt);
  }

  private onTick(
    t: number,
    players: Extract<S2C, { type: 'tick' }>['p'],
    mobs: Extract<S2C, { type: 'tick' }>['m'],
  ): void {
    this.setTime(t);
    const seen = new Set<string>();
    for (const [id, x, z, ry, mv, hp, held, alive] of players) {
      if (id === this.you) {
        const far = Math.hypot(x - this.x, z - this.z) > 8;
        if (this.resync || far || !this.me?.alive) {
          this.x = x;
          this.z = z;
          if (this.resync) this.ry = ry;
          this.resync = false;
        }
        continue;
      }
      seen.add(id);
      const o = this.others.get(id);
      if (o) {
        o.tx = x;
        o.tz = z;
        o.tr = ry;
        o.mv = mv;
        o.hp = hp;
        o.held = held;
        if (!o.alive && alive) {
          o.x = x;
          o.z = z;
        }
        o.alive = alive === 1;
      } else {
        this.others.set(id, {
          id,
          x,
          z,
          ry,
          tx: x,
          tz: z,
          tr: ry,
          mv,
          hp,
          held,
          alive: alive === 1,
          speed: 0,
        });
      }
    }
    for (const id of [...this.others.keys()]) if (!seen.has(id)) this.others.delete(id);
    const live = new Set<number>();
    for (const [id, kindIdx, x, z, ry, state, hp, burning] of mobs) {
      live.add(id);
      const m = this.mobs.get(id);
      if (m) {
        m.tx = x;
        m.tz = z;
        m.tr = ry;
        m.state = state;
        m.hp = hp;
        m.burning = burning === 1;
        m.seen = this.clock;
      } else {
        const kind = MOB_KINDS[kindIdx] ?? 'husk';
        this.mobs.set(id, {
          id,
          kind,
          x,
          z,
          ry,
          tx: x,
          tz: z,
          tr: ry,
          state,
          hp,
          burning: burning === 1,
          speed: 0,
          dying: 0,
          seen: this.clock,
        });
      }
    }
    for (const [id, m] of this.mobs) {
      if (live.has(id) || m.dying > 0) continue;
      this.mobs.delete(id);
    }
  }

  private onFxMsg(msg: Extract<S2C, { type: 'fx' }>): void {
    if (msg.k === 'death') {
      // The mob closest to the spot plays its death.
      let best: MobMirror | null = null;
      let bd = 2.5;
      for (const m of this.mobs.values()) {
        const d = Math.hypot(m.x - msg.x, m.z - msg.z);
        if (d < bd && m.dying === 0) {
          bd = d;
          best = m;
        }
      }
      if (best) {
        best.dying = 1.4;
        best.state = MOB_STATE.dying;
      }
    }
    if (
      (msg.k === 'chop' || msg.k === 'mine' || msg.k === 'gather' || msg.k === 'swing') &&
      msg.by &&
      msg.by !== this.you
    ) {
      this.emit({ type: 'swing', id: msg.by });
    }
    this.emit(msg);
  }

  private onEvent(e: Extract<S2C, { type: 'event' }>['e'], text?: string, id?: string): void {
    switch (e) {
      case 'note':
        if (id) {
          this.noteId = id;
          this.noteBack = null;
          this.panel = 'note';
        }
        return;
      case 'dead':
        this.panel = null;
        this.autoSwap = null;
        this.emit({ type: 'event', e });
        return;
      case 'respawn':
        this.resync = true;
        this.emit({ type: 'event', e });
        return;
      case 'win':
        this.won = true;
        this.panel = null;
        this.emit({ type: 'event', e });
        return;
      default:
        if (text) this.showBanner(text, e);
        this.emit({ type: 'event', e });
    }
  }

  showBanner(text: string, kind: Banner['kind']): void {
    this.banner = { id: this.uid++, text, kind };
    this.bannerUntil = this.clock + 5.5;
    this.touch();
  }

  toast(text: string): void {
    this.toasts = [
      ...this.toasts.slice(-3),
      { id: this.uid++, text, until: this.clock + TOAST_SECONDS },
    ];
    this.touch();
  }

  // -------------------------------------------------------------------------
  // Per frame.

  update(dt: number, input: MoveInput, useHeld: boolean): void {
    this.clock += dt;
    if (this.toasts.length && (this.toasts[0] as Toast).until < this.clock) {
      this.toasts = this.toasts.filter((t) => t.until >= this.clock);
      this.touch();
    }
    if (this.banner && this.clock > this.bannerUntil) {
      this.banner = null;
      this.touch();
    }
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
    const island = this.island;
    if (this.phase !== 'ready' || !island) return;
    this.smoothOthers(dt);
    const alive = !!this.me?.alive && !this.me.escaped;
    const moving = alive && !this.panelBlocksMove() && (input.x !== 0 || input.z !== 0);
    let speed = 0;
    if (moving) {
      const len = Math.min(1, Math.hypot(input.x, input.z));
      const sprint = input.sprint && !this.tired && len > 0.5;
      speed = (sprint ? RUN : WALK) * len;
      if (heightAt(island, this.x, this.z) < 0.05) speed *= 0.6;
      if (sprint) {
        this.stamina = Math.max(0, this.stamina - STAMINA_DRAIN * dt);
        if (this.stamina === 0) this.tired = true;
      }
      this.mv = sprint ? 2 : 1;
      const dir = Math.atan2(input.x, input.z);
      this.ry = turnTowards(this.ry, dir, dt * 14);
      const mag = Math.hypot(input.x, input.z);
      this.moveBy((input.x / mag) * speed * dt, (input.z / mag) * speed * dt);
    } else {
      this.mv = 0;
    }
    if (!(moving && input.sprint && !this.tired)) {
      this.stamina = Math.min(100, this.stamina + STAMINA_REGEN * dt);
      if (this.tired && this.stamina > 35) this.tired = false;
    }
    this.speed = speed;
    this.posAcc += dt;
    if (this.posAcc >= POS_EVERY && alive) {
      this.posAcc = 0;
      const key = `${this.x.toFixed(2)}|${this.z.toFixed(2)}|${this.ry.toFixed(2)}|${this.mv}`;
      if (key !== this.lastSent) {
        this.lastSent = key;
        this.send({
          type: 'pos',
          x: round2(this.x),
          z: round2(this.z),
          ry: round2(this.ry),
          mv: this.mv,
        });
      }
    }
    this.updateGhost();
    const before = this.target;
    this.target = alive ? this.findTarget() : null;
    if (!sameTarget(before, this.target)) this.touch();
    if (
      useHeld &&
      alive &&
      this.clock >= this.nextUse &&
      this.target &&
      (this.target.kind === 'mob' || this.target.kind === 'node')
    ) {
      this.use();
    }
    if (this.autoSwap && this.clock > this.autoSwap.until && !useHeld) {
      if (this.auto.back) this.autoRestore();
      else this.autoSwap = null;
    }
    // Crafting stations come and go as you walk: the craft lists depend on them.
    this.stationAcc += dt;
    if (this.stationAcc > 0.25) {
      this.stationAcc = 0;
      const st = this.stations();
      const key = `${st.fire ? 1 : 0}${st.bench ? 1 : 0}${st.mash ? 1 : 0}`;
      if (key !== this.stationKey) {
        this.stationKey = key;
        this.touch();
      }
    }
    // The clock on the HUD changes every in-game ten minutes.
    // ...and every second while the rescue clock runs.
    const busy = this.rescue.phase === 'calling' || this.rescue.phase === 'landed';
    const minute = busy ? Math.floor(this.now()) : Math.floor(this.now() / 4.1667);
    if (minute !== this.lastMinute) {
      this.lastMinute = minute;
      this.touch();
    }
  }

  private lastMinute = -1;
  private stationAcc = 0;
  private stationKey = '';

  private panelBlocksMove(): boolean {
    return this.panel !== null && this.panel !== 'map';
  }

  private smoothOthers(dt: number): void {
    const k = 1 - Math.exp(-dt * 10);
    for (const o of this.others.values()) {
      const px = o.x;
      const pz = o.z;
      o.x += (o.tx - o.x) * k;
      o.z += (o.tz - o.z) * k;
      o.ry = turnTowards(o.ry, o.tr, dt * 12);
      o.speed = Math.hypot(o.x - px, o.z - pz) / Math.max(dt, 1e-4);
    }
    for (const [id, m] of this.mobs) {
      if (m.dying > 0) {
        m.dying -= dt;
        if (m.dying <= 0) this.mobs.delete(id);
        continue;
      }
      const px = m.x;
      const pz = m.z;
      m.x += (m.tx - m.x) * k;
      m.z += (m.tz - m.z) * k;
      m.ry = turnTowards(m.ry, m.tr, dt * 10);
      m.speed = Math.hypot(m.x - px, m.z - pz) / Math.max(dt, 1e-4);
    }
  }

  // -------------------------------------------------------------------------
  // Movement and collision.

  private moveBy(dx: number, dz: number): void {
    const island = this.island as Island;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3));
    for (let s = 0; s < steps; s++) {
      let nx = this.x + dx / steps;
      let nz = this.z + dz / steps;
      // Deep water: slide along the shore instead of walking in.
      if (heightAt(island, nx, nz) < DEEP) {
        if (heightAt(island, nx, this.z) >= DEEP) nz = this.z;
        else if (heightAt(island, this.x, nz) >= DEEP) nx = this.x;
        else return;
      }
      const p = this.collide(nx, nz);
      this.x = Math.max(-HALF + 3, Math.min(HALF - 3, p.x));
      this.z = Math.max(-HALF + 3, Math.min(HALF - 3, p.z));
    }
  }

  private collide(x: number, z: number): { x: number; z: number } {
    const island = this.island as Island;
    forNodesNear(island, x, z, 2.2, (id) => {
      if (this.nodeGone(id)) return;
      const r = NODES[island.nodeType[id] as number]?.radius ?? 0;
      if (r <= 0) return;
      const nx = island.nodeX[id] as number;
      const nz = island.nodeZ[id] as number;
      const dx = x - nx;
      const dz = z - nz;
      const d = Math.hypot(dx, dz);
      const min = r + RADIUS;
      if (d < min) {
        if (d < 1e-4) {
          x = nx + min;
        } else {
          x = nx + (dx / d) * min;
          z = nz + (dz / d) * min;
        }
      }
    });
    for (const col of island.colliders) {
      const dx = x - col.x;
      const dz = z - col.z;
      const reach = col.hw + col.hd + RADIUS + 1;
      if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
      // Into the box's frame, push out as an axis-aligned box, and back.
      const lx = dx * col.c + dz * col.s;
      const lz = -dx * col.s + dz * col.c;
      const out = pushOutOfBox(lx, lz, RADIUS, {
        minX: -col.hw,
        maxX: col.hw,
        minZ: -col.hd,
        maxZ: col.hd,
      });
      if (out) {
        x = col.x + out.x * col.c - out.z * col.s;
        z = col.z + out.x * col.s + out.z * col.c;
      }
    }
    for (const b of this.buildings.values()) {
      if (Math.abs(b.x - x) > 3 || Math.abs(b.z - z) > 3) continue;
      if (!blocks(b)) continue;
      const out = pushOutOfBox(x, z, RADIUS, footprint(b.kind, b.x, b.z, b.rot));
      if (out) {
        x = out.x;
        z = out.z;
      }
    }
    return { x, z };
  }

  nodeGone(id: number): boolean {
    const s = this.nodes.get(id);
    return !!s && s.until !== 0;
  }

  // -------------------------------------------------------------------------
  // What the action button does.

  heldSlot(): Slot | null {
    return this.me?.inv[this.me.held] ?? null;
  }

  heldItem(): ItemDef | undefined {
    const s = this.heldSlot();
    return s ? ITEMS[s.id] : undefined;
  }

  carrying(): Set<string> {
    const set = new Set<string>();
    for (const s of this.me?.inv ?? []) if (s) set.add(s.id);
    return set;
  }

  count(id: string): number {
    let n = 0;
    for (const s of this.me?.inv ?? []) if (s?.id === id) n += s.n;
    return n;
  }

  private updateGhost(): void {
    const held = this.heldItem();
    const kind = held?.place;
    if (!kind || !this.me?.alive || !this.island) {
      this.ghost = null;
      return;
    }
    const fx = Math.sin(this.ry);
    const fz = Math.cos(this.ry);
    const ahead = GHOST_AHEAD + (BUILDINGS[kind]?.d ?? 1) / 2;
    const p = snapPlacement(kind, this.x + fx * ahead, this.z + fz * ahead);
    const facing = Math.round(this.ry / (Math.PI / 2));
    const rot = (((facing + this.ghostTurn) % 4) + 4) % 4;
    const g = this.ghost;
    if (g && g.kind === kind && g.x === p.x && g.z === p.z && g.rot === rot) return;
    const problem = placementProblem(
      this.island,
      this.buildings.values(),
      (id) => this.nodeGone(id),
      kind,
      p.x,
      p.z,
      rot,
    );
    const tooClose =
      circleInBox(this.x, this.z, RADIUS, footprint(kind, p.x, p.z, rot)) &&
      BUILDINGS[kind]?.blocks;
    this.ghost = {
      kind,
      x: p.x,
      z: p.z,
      rot,
      problem: problem ?? (tooClose ? 'Step back a little.' : null),
    };
    this.touch();
  }

  turnGhost(): void {
    this.ghostTurn = (this.ghostTurn + 1) % 4;
    this.ghost = null;
    this.updateGhost();
    this.touch();
  }

  private findTarget(): Target | null {
    const island = this.island as Island;
    const held = this.heldItem();
    const x = this.x;
    const z = this.z;
    const fx = Math.sin(this.ry);
    const fz = Math.cos(this.ry);
    // Things in front score a little better than things behind.
    const score = (tx: number, tz: number) => {
      const dx = tx - x;
      const dz = tz - z;
      const d = Math.hypot(dx, dz);
      const front = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      return d - front * 0.6;
    };
    let best = null as Target | null;
    let bestScore = Infinity;
    const offer = (t: Target, s: number) => {
      if (s < bestScore) {
        bestScore = s;
        best = t;
      }
    };
    // Monsters first: anything hostile in reach wins.
    const reach = held?.weapon?.reach ?? 1.8;
    let foe: Target | null = null;
    let foeScore = Infinity;
    for (const m of this.mobs.values()) {
      if (m.dying > 0 || m.state === MOB_STATE.burrow) continue;
      const def = MONSTERS[m.kind];
      const r = reach + (MONSTER_RADIUS[m.kind] ?? 0.5) + 0.5;
      const d = Math.hypot(m.x - x, m.z - z);
      if (d > r) continue;
      const s = score(m.x, m.z) - (def.hostile ? 5 : 0);
      if (s < foeScore) {
        foeScore = s;
        foe = {
          kind: 'mob',
          id: m.id,
          x: m.x,
          z: m.z,
          verb: def.hostile ? 'Attack' : 'Catch',
          name: MOB_NAMES[m.kind],
          hostile: def.hostile,
        };
      }
    }
    if (foe && (foe as Target).hostile) return foe;
    if (foe) offer(foe, foeScore);
    // With auto tool on, any tool in the bag counts as in hand.
    const kinds = new Set<string>();
    if (held?.tool) kinds.add(held.tool.kind);
    if (this.auto.tool && this.me)
      for (const s of this.me.inv) {
        const k = s ? ITEMS[s.id]?.tool?.kind : undefined;
        if (k) kinds.add(k);
      }
    forNodesNear(island, x, z, NODE_REACH + 1.4, (id) => {
      if (this.nodeGone(id)) return;
      const def = NODES[island.nodeType[id] as number];
      if (!def) return;
      const nx = island.nodeX[id] as number;
      const nz = island.nodeZ[id] as number;
      if (Math.hypot(nx - x, nz - z) > NODE_REACH + def.radius) return;
      // A node the held tool works on beats one it doesn't.
      const fits = def.tool === 'hand' || kinds.has(def.tool);
      offer(
        { kind: 'node', id, x: nx, z: nz, verb: def.verb, name: def.name, hostile: false },
        score(nx, nz) - def.radius + (fits ? -0.8 : 1.5),
      );
    });
    for (const b of this.buildings.values()) {
      if (Math.abs(b.x - x) > BUILD_REACH + 1 || Math.abs(b.z - z) > BUILD_REACH + 1) continue;
      const d = Math.hypot(b.x - x, b.z - z);
      if (d > BUILD_REACH) continue;
      const t = this.buildingTarget(b);
      if (t) offer(t, score(b.x, b.z) + (t.verb ? -0.3 : 2.5));
    }
    for (const poi of POIS) {
      if (Math.abs(poi.x - x) > 40 || Math.abs(poi.z - z) > 40) continue;
      for (const spot of poi.spots) {
        const sx = poi.x + spot.dx;
        const sz = poi.z + spot.dz;
        if (Math.hypot(sx - x, sz - z) > SPOT_REACH) continue;
        const t = this.spotTarget(poi, spot, sx, sz);
        if (t) offer(t, score(sx, sz) + this.spotPriority(spot));
      }
    }
    for (const d of this.drops.values()) {
      if (Math.hypot(d.x - x, d.z - z) > DROP_REACH) continue;
      offer(
        { kind: 'drop', id: d.id, x: d.x, z: d.z, verb: 'Pick up', name: d.label, hostile: false },
        score(d.x, d.z) - 0.5,
      );
    }
    if (!best) {
      const pool = poolNear(island, x, z, 2.2);
      if (pool)
        return {
          kind: 'pool',
          id: 0,
          x: pool.x,
          z: pool.z,
          verb: 'Drink',
          name: 'fresh water',
          hostile: false,
        };
    }
    return best;
  }

  private buildingTarget(b: Built): Target | null {
    const base = {
      kind: 'build' as const,
      id: b.id,
      x: b.x,
      z: b.z,
      hostile: false,
      building: b.id,
    };
    const name = BUILDINGS[b.kind]?.name ?? b.kind;
    switch (b.kind) {
      case 'campfire': {
        const fuel = this.fuel(b);
        if (fuel > CAMPFIRE_FUEL_MAX - 60)
          return { ...base, verb: 'Warm up by', name: 'the fire', panel: 'craft' };
        return {
          ...base,
          verb: this.count('wood') ? 'Add wood to' : 'Needs wood:',
          name: fuel > 0 ? 'the fire' : 'the cold fire',
        };
      }
      case 'door_wood':
        return { ...base, verb: b.v === 1 ? 'Close' : 'Open', name: 'the door' };
      case 'bedroll':
        return { ...base, verb: 'Sleep here:', name: 'set spawn' };
      case 'rain_collector':
        return {
          ...base,
          verb: (b.v ?? 0) >= 1 ? 'Drink from' : 'Empty:',
          name: `collector (${b.v ?? 0})`,
        };
      case 'storage':
        return { ...base, verb: 'Open', name: 'storage box', panel: 'storage' };
      case 'workbench':
        return { ...base, verb: 'Craft at', name: 'the workbench', panel: 'craft' };
      case 'mashbench':
        return { ...base, verb: 'Mash parts at', name: 'the Mashbench', panel: 'craft' };
      case 'snap_trap':
        return {
          ...base,
          verb: '',
          name: (b.v ?? 0) > 0 ? 'Snap trap (re-arming)' : 'Snap trap (armed)',
        };
      default:
        return { ...base, verb: '', name };
    }
  }

  private spotTarget(poi: PoiDef, spot: Spot, x: number, z: number): Target | null {
    const base = { kind: 'spot' as const, id: spot.id, x, z, hostile: false };
    switch (spot.kind) {
      case 'note':
        return {
          ...base,
          verb: 'Read',
          name: this.notes.has(spot.id) ? 'the note again' : 'a note',
        };
      case 'tag':
        return { ...base, verb: 'Read', name: 'a luggage tag' };
      case 'loot':
        return this.flags.has(`loot:${spot.id}`)
          ? null
          : { ...base, verb: 'Search', name: 'the supply crate' };
      case 'lock':
        return this.flags.has('cargo_open')
          ? null
          : { ...base, verb: 'Enter code:', name: 'cargo lock', panel: 'keypad' };
      case 'antenna':
        return this.flags.has('antenna_taken')
          ? null
          : { ...base, verb: 'Climb', name: 'the radio tower' };
      case 'beacon':
        return { ...base, verb: 'Use', name: 'the rescue beacon' };
      case 'heli':
        return this.rescue.phase === 'landed'
          ? { ...base, verb: 'Board', name: 'the helicopter!' }
          : null;
    }
    void poi;
    return null;
  }

  /** Score offset for a spot: the escape steps win, spots that would only say "not yet" lose. */
  private spotPriority(spot: Spot): number {
    if (spot.kind === 'heli') return -4;
    if (spot.kind === 'beacon') {
      if (this.rescue.phase === 'calling' || this.rescue.phase === 'landed') return 0;
      return this.carrying().has('radio') ? -4 : 2.5;
    }
    if (spot.kind === 'antenna') return this.towerClear() ? -2 : 2.5;
    return -1;
  }

  towerClear(): boolean {
    return (this.island?.towerVines ?? []).every((id) => this.nodeGone(id));
  }

  /** Seconds until the helicopter lands (or leaves), counted down locally. */
  rescueLeft(): number {
    return Math.max(0, this.rescue.left - (this.now() - this.rescueAt));
  }

  /** Campfire fuel right now (counted down locally between updates). */
  fuel(b: Built): number {
    if (b.kind !== 'campfire') return 0;
    return Math.max(0, (b.v ?? 0) - (this.time - b.at));
  }

  /** The action button's label. */
  actionLabel(): {
    text: string;
    kind: 'place' | 'attack' | 'throw' | 'use' | 'eat' | 'none';
    blocked?: string;
    /** The tool or weapon an automatic switch will take out. */
    item?: string;
  } {
    const held = this.heldItem();
    if (this.ghost) {
      return {
        text: `Place ${held?.name ?? ''}`,
        kind: 'place',
        ...(this.ghost.problem ? { blocked: this.ghost.problem } : {}),
      };
    }
    const t = this.target;
    const pick = this.autoChoice(t);
    const item = pick >= 0 ? this.me?.inv[pick]?.id : undefined;
    const auto = item ? { item } : {};
    if (t?.hostile) return { text: `${t.verb} ${t.name}`, kind: 'attack', ...auto };
    if (held?.throwable) return { text: `Throw ${held.name}`, kind: 'throw' };
    if (t)
      return {
        text: `${t.verb} ${t.name}`.trim(),
        kind: t.kind === 'mob' ? 'attack' : 'use',
        ...auto,
      };
    if (this.wantsToEat()) {
      if (held?.heal) return { text: `Use ${held.name}`, kind: 'eat' };
      if (held?.food)
        return {
          text: `${held.food.water > held.food.food ? 'Drink' : 'Eat'} ${held.name}`,
          kind: 'eat',
        };
    }
    return { text: held?.weapon ? 'Swing' : '', kind: 'none' };
  }

  /** The held food or medicine would do something (no eating on a full stomach by accident). */
  private wantsToEat(): boolean {
    const held = this.heldItem();
    const me = this.me;
    if (!held || !me) return false;
    if (held.heal) return me.hp < 100 || me.poison > 0;
    if (!held.food) return false;
    return (held.food.food > 0 && me.food < 90) || (held.food.water > 0 && me.water < 90);
  }

  /** The action button. */
  use(): void {
    const me = this.me;
    if (!me?.alive || me.escaped || this.clock < this.nextUse || this.panelBlocksMove()) return;
    const held = this.heldItem();
    const cooldown = held?.weapon?.cooldown ?? 0.6;
    if (this.ghost) {
      if (this.ghost.problem) {
        this.toast(this.ghost.problem);
        return;
      }
      this.send({
        type: 'place',
        slot: me.held,
        x: this.ghost.x,
        z: this.ghost.z,
        rot: this.ghost.rot,
      });
      this.nextUse = this.clock + 0.35;
      return;
    }
    const t = this.target;
    if (held?.throwable && !(t?.hostile && t.kind === 'mob' && !held.weapon)) {
      const aim = this.aimThrow(held.throwable.range);
      this.ry = Math.atan2(aim.x - this.x, aim.z - this.z);
      this.send({ type: 'throw', slot: me.held, x: round2(aim.x), z: round2(aim.z) });
      this.emit({ type: 'swing', id: this.you });
      this.nextUse = this.clock + 0.9;
      return;
    }
    if (t) {
      if (t.kind === 'build' && !t.verb) return;
      this.ry = Math.atan2(t.x - this.x, t.z - this.z);
      if (t.panel) {
        if (t.panel === 'storage') this.storageId = Number(t.id);
        // Crafting opens the quick panel, so you can keep an eye on things.
        if (t.panel === 'craft') {
          this.quickOpen = true;
          this.quickTab = 'craft';
          this.touch();
        } else {
          this.openPanel(t.panel);
        }
        return;
      }
      if (t.kind === 'mob' || t.kind === 'node') this.autoEquip(t);
      this.send({ type: 'use', kind: t.kind, id: t.id });
      if (t.kind === 'mob' || t.kind === 'node') {
        this.emit({ type: 'swing', id: this.you });
        this.nextUse = this.clock + (this.heldItem()?.weapon?.cooldown ?? cooldown);
      } else {
        this.nextUse = this.clock + 0.3;
      }
      return;
    }
    if (this.wantsToEat()) {
      this.send({ type: 'eat', slot: me.held });
      this.nextUse = this.clock + 0.5;
      return;
    }
    if (held?.weapon) {
      this.emit({ type: 'swing', id: this.you });
      this.nextUse = this.clock + cooldown;
    }
  }

  private aimThrow(range: number): { x: number; z: number } {
    let best: MobMirror | null = null;
    let bd = range;
    for (const m of this.mobs.values()) {
      if (m.dying > 0 || !MONSTERS[m.kind].hostile) continue;
      const d = Math.hypot(m.x - this.x, m.z - this.z);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (best) return { x: best.x, z: best.z };
    const ahead = Math.min(8, range);
    return { x: this.x + Math.sin(this.ry) * ahead, z: this.z + Math.cos(this.ry) * ahead };
  }

  // -------------------------------------------------------------------------
  // Commands from the HUD.

  openPanel(p: Panel | null): void {
    if (p === 'menu' && this.panel !== 'menu') this.menuPage = 'main';
    this.panel = p;
    this.touch();
  }

  setMenuPage(page: MenuPage): void {
    this.menuPage = page;
    this.touch();
  }

  select(slot: number, auto = false): void {
    if (!this.me || slot < 0 || slot >= HOTBAR) return;
    if (!auto) this.autoSwap = null;
    this.me = { ...this.me, held: slot };
    this.send({ type: 'equip', slot });
    this.touch();
  }

  eat(slot: number): void {
    this.send({ type: 'eat', slot });
  }

  craft(recipe: string): void {
    this.send({ type: 'craft', recipe });
  }

  moveSlot(from: number, to: number): void {
    this.autoSwap = null;
    this.send({ type: 'move', from, to });
  }

  // -------------------------------------------------------------------------
  // Auto tool and auto weapon.

  /** What a target needs: a tool kind, 'weapon', or null (bare hands do, or it's off). */
  private autoJob(t: Target): ToolKind | 'weapon' | null {
    if (t.kind === 'node') {
      const def = NODES[(this.island as Island).nodeType[Number(t.id)] as number];
      return def && def.tool !== 'hand' && this.auto.tool ? def.tool : null;
    }
    if (t.kind === 'mob' && t.hostile && this.auto.weapon) return 'weapon';
    return null;
  }

  /** The slot an automatic switch would take for this target (-1: keep what you hold). */
  autoChoice(t: Target | null): number {
    const me = this.me;
    if (!t || !me || this.ghost) return -1;
    const job = this.autoJob(t);
    if (!job) return -1;
    const held = this.heldItem();
    const i = bestSlot(me.inv, job);
    if (i < 0 || i === me.held) return -1;
    const best = jobScore(ITEMS[me.inv[i]?.id ?? ''], job);
    const have = jobScore(held, job);
    // Weapons only change for a clear step up (a spear user keeps their spear for a club).
    return best > have * (job === 'weapon' ? 1.15 : 1) ? i : -1;
  }

  private autoEquip(t: Target): void {
    if (this.autoSwap) this.autoSwap.until = this.clock + AUTO_BACK;
    let i = this.autoChoice(t);
    if (i < 0) return;
    // One switch at a time: undo the last one first, so switching back stays simple.
    const prior = this.autoSwap;
    if (prior) {
      this.autoRestore();
      i = this.autoChoice(t);
      if (i < 0) return;
    }
    const me = this.me;
    if (!me) return;
    const tool = me.inv[i]?.id ?? '';
    const prev = prior?.prev ?? me.held;
    if (i < HOTBAR) {
      this.select(i, true);
      this.autoSwap = { prev, bag: null, tool, until: this.clock + AUTO_BACK };
    } else {
      // From the bag: swap it into your hand (and back again later).
      this.swapLocal(i, me.held);
      this.autoSwap = { prev: me.held, bag: i, tool, until: this.clock + AUTO_BACK };
    }
  }

  /** Back to what you held before the automatic switch. */
  private autoRestore(): void {
    const a = this.autoSwap;
    const me = this.me;
    this.autoSwap = null;
    if (!a || !me?.alive) return;
    if (a.bag !== null) {
      const inHand = me.inv[a.prev];
      if (me.held === a.prev && (!inHand || inHand.id === a.tool)) this.swapLocal(a.prev, a.bag);
    } else {
      const inHand = me.inv[me.held];
      if (me.held !== a.prev && (!inHand || inHand.id === a.tool)) this.select(a.prev, true);
    }
  }

  /** Swaps two slots (the authority does the same; the mirror follows at once). */
  private swapLocal(from: number, to: number): void {
    const me = this.me;
    if (!me) return;
    this.send({ type: 'move', from, to });
    const inv = me.inv.slice();
    const a = inv[from] ?? null;
    inv[from] = inv[to] ?? null;
    inv[to] = a;
    this.me = { ...me, inv };
    this.touch();
  }

  dropSlot(slot: number): void {
    this.send({ type: 'drop', slot });
  }

  /** Bag slot → the open storage box (into box slot `to` when given). */
  store(slot: number, to?: number): void {
    if (this.storageId === null) return;
    this.send({ type: 'store', id: this.storageId, slot, ...(to !== undefined ? { to } : {}) });
  }

  /** Storage box slot → your bag (into bag slot `to` when given). */
  take(slot: number, to?: number): void {
    if (this.storageId === null) return;
    this.send({ type: 'take', id: this.storageId, slot, ...(to !== undefined ? { to } : {}) });
  }

  /** Eat, drink or use what's in your hand (a key on PC). */
  eatHeld(): void {
    const me = this.me;
    const held = this.heldItem();
    if (!me?.alive || !held) return;
    if (held.food || held.heal) this.eat(me.held);
  }

  /** Drop what's in your hand (a key on PC). */
  dropHeld(): void {
    const me = this.me;
    const held = this.heldItem();
    if (!me?.alive || !held) return;
    if (held.quest) {
      this.toast('Keep that one: you need it to get off the island.');
      return;
    }
    this.dropSlot(me.held);
  }

  /** Scrolls the hotbar selection. */
  cycle(step: number): void {
    if (!this.me) return;
    this.select((((this.me.held + step) % HOTBAR) + HOTBAR) % HOTBAR);
  }

  /** The quick bag/craft panel stays open while you play. */
  toggleQuick(tab?: 'bag' | 'craft'): void {
    if (this.quickOpen && (!tab || tab === this.quickTab)) this.quickOpen = false;
    else {
      this.quickOpen = true;
      if (tab) this.quickTab = tab;
    }
    this.touch();
  }

  enterCode(code: string): void {
    this.send({ type: 'code', code });
  }

  demolish(id: number): void {
    this.send({ type: 'demolish', id });
  }

  respawn(): void {
    this.send({ type: 'respawn' });
  }

  /** Crafting stations in reach. */
  stations(): Record<Station, boolean> {
    const out: Record<Station, boolean> = { hand: true, fire: false, bench: false, mash: false };
    for (const b of this.buildings.values()) {
      const st = BUILDINGS[b.kind]?.station;
      if (!st || Math.hypot(b.x - this.x, b.z - this.z) > STATION_RANGE) continue;
      if (st === 'fire' && this.fuel(b) <= 0) continue;
      out[st] = true;
    }
    return out;
  }

  canCraft(recipe: string): boolean {
    const r = RECIPES[recipe];
    if (!r || !this.me) return false;
    return this.stations()[r.station] && hasAll(this.me.inv, r.needs);
  }

  info(): DayInfo {
    return dayInfo(this.now());
  }

  objective(): Objective | null {
    return currentObjective({
      flags: this.flags,
      notes: this.notes,
      carrying: this.carrying(),
      rescue: this.rescue,
    });
  }

  async close(): Promise<void> {
    await this.link.close();
  }
}

export const MOB_NAMES: Record<MonsterKind, string> = {
  husk: 'Husk',
  snapjaw: 'Snapjaw',
  puffer: 'Puffer',
  thornback: 'Thornback',
  mother: 'the Mother Bloom',
  crab: 'Crab',
};

function blocks(b: BuildingNet): boolean {
  if (!BUILDINGS[b.kind]?.blocks) return false;
  return !(b.kind === 'door_wood' && b.v === 1);
}

function circleInBox(x: number, z: number, r: number, b: ReturnType<typeof footprint>): boolean {
  return pushOutOfBox(x, z, r, b) !== null;
}

function sameTarget(a: Target | null, b: Target | null): boolean {
  if (!a || !b) return a === b;
  return a.kind === b.kind && a.id === b.id && a.verb === b.verb && a.name === b.name;
}

/** Turns angle a towards b by at most `step` radians (shortest way). */
export function turnTowards(a: number, b: number, step: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
