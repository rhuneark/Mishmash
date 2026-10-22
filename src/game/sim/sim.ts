// The island authority. Runs on the room server in co-op, or in-process for
// solo play. Owns everything shared (nodes, buildings, monsters, progress) and
// each player's stats and inventory; players report their own position.

import {
  BUILDINGS,
  CAMPFIRE_FUEL_MAX,
  CAMPFIRE_FUEL_PER_WOOD,
  CAMPFIRE_FUEL_START,
  RAIN_EVERY,
  RAIN_MAX,
  STATION_RANGE,
  STORAGE_SLOTS,
} from '../content/buildings';
import { ITEMS, powerFor, type ItemDef } from '../content/items';
import { LUGGAGE_LOOT, NODE, NODES } from '../content/nodes';
import { NOTES, PAGES } from '../content/notes';
import { POIS, RESCUE_SECONDS, SPAWN, type PoiDef, type Spot } from '../content/pois';
import { RECIPES, type Station } from '../content/recipes';
import { hash01 } from '../rng';
import { HALF, poolNear, type Island } from '../world';
import {
  add,
  cleanInv,
  emptyInv,
  HOTBAR,
  moveSlot,
  remove,
  removeAll,
  transfer,
  wear,
} from './inventory';
import { burrowAll, damageMob, runDirector, updateMobs } from './mobs';
import { placementProblem } from './place';
import {
  MOB_KINDS,
  MOB_STATE,
  splitParts,
  type BuildingNet,
  type C2S,
  type DropNet,
  type MeNet,
  type MobNet,
  type PlayerNet,
  type S2C,
  type Slot,
  type Snapshot,
  type UseKind,
} from './protocol';
import { DAY, DUSK, NIGHT_END, NIGHT_START, dayInfo, type DayInfo } from './time';
import {
  blocksNow,
  circleHitsBox,
  colorFor,
  footprint,
  type Building,
  type Drop,
  type IslandSave,
  type Mob,
  type RescueState,
  type SimPlayer,
} from './types';

export type Out = (to: string | null, msg: S2C) => void;

export interface Light {
  x: number;
  z: number;
  r: number;
  /** Nothing of the Bloom enters it (heart lantern). */
  repel?: boolean;
}

export const FOOD_DECAY = 100 / 700;
export const WATER_DECAY = 100 / 520;
const STARVE = 0.6;
const REGEN = 0.15;
const FIRE_HEAL = 1;
const FIRE_HEAL_RANGE = 5;
const REACH = 3.2;
const HAND_DAMAGE = 5;
const MAX_SPEED = 9;
const VIEW = 70;
const POISON_DPS = 3;
const HELI_WAIT = 120;

export class IslandSim {
  readonly island: Island;
  readonly seed: number;
  time: number;
  nextId: number;
  readonly nodes = new Map<number, { hp: number; until: number }>();
  readonly buildings = new Map<number, Building>();
  readonly drops = new Map<number, Drop>();
  readonly players = new Map<string, SimPlayer>();
  readonly online = new Set<string>();
  readonly mobs = new Map<number, Mob>();
  readonly flags = new Set<string>();
  readonly notes = new Set<string>();
  motherHp: number | null;
  rescue: RescueState;
  readonly snapDeadUntil = new Map<number, number>();
  readonly snapMob = new Map<number, number>();
  lights: Light[] = [];
  readonly random: () => number;
  private readonly out: Out;
  readonly spots = new Map<string, { poi: PoiDef; spot: Spot; x: number; z: number }>();
  private lastInfo: DayInfo;
  private slowAcc = 0;
  private regrowAcc = 0;
  private readonly meDirty = new Set<string>();
  private readonly meAt = new Map<string, number>();
  private readonly lastMe = new Map<string, string>();
  private readonly booms: { x: number; z: number; at: number; by: string; item: string }[] = [];

  constructor(island: Island, save: IslandSave, out: Out, random: () => number) {
    this.island = island;
    this.seed = save.seed;
    this.out = out;
    this.random = random;
    this.time = save.time;
    this.nextId = save.nextId;
    for (const [id, hp, until] of save.nodes) {
      if (id >= 0 && id < island.nodeCount) this.nodes.set(id, { hp, until });
    }
    for (const b of save.buildings) this.buildings.set(b.id, { ...b });
    for (const d of save.drops)
      this.drops.set(d.id, { ...d, items: d.items.map((s) => ({ ...s })) });
    for (const [id, p] of Object.entries(save.players)) {
      this.players.set(id, {
        id,
        name: p.name,
        color: p.color,
        x: p.x,
        z: p.z,
        ry: 0,
        mv: 0,
        hp: p.hp,
        food: p.food,
        water: p.water,
        inv: cleanInv(p.inv),
        held: p.held,
        alive: p.alive,
        spawn: p.spawn,
        poisonUntil: 0,
        heals: [],
        lastUse: -99,
        lastPos: this.time,
        kills: p.kills,
        deaths: p.deaths,
        crafted: p.crafted,
        escaped: p.escaped,
        torchAcc: 0,
      });
    }
    for (const f of save.flags) this.flags.add(f);
    for (const n of save.notes) this.notes.add(n);
    this.motherHp = save.motherHp;
    this.rescue = { ...save.rescue };
    for (const poi of POIS) {
      for (const spot of poi.spots) {
        this.spots.set(spot.id, { poi, spot, x: poi.x + spot.dx, z: poi.z + spot.dz });
      }
    }
    this.lastInfo = dayInfo(this.time);
  }

  // -------------------------------------------------------------------------
  // Messaging.

  send(to: string, msg: S2C): void {
    if (this.online.has(to)) this.out(to, msg);
  }

  broadcast(msg: S2C): void {
    this.out(null, msg);
  }

  toast(to: string, text: string): void {
    this.send(to, { type: 'toast', text });
  }

  fx(
    k: Extract<S2C, { type: 'fx' }>['k'],
    x: number,
    z: number,
    by?: string,
    n?: number,
    r?: number,
  ): void {
    const msg: S2C = { type: 'fx', k, x: round1(x), z: round1(z) };
    if (by !== undefined) msg.by = by;
    if (n !== undefined) msg.n = n;
    if (r !== undefined) msg.r = r;
    this.broadcast(msg);
  }

  newId(): number {
    return this.nextId++;
  }

  // -------------------------------------------------------------------------
  // Joining.

  join(id: string, name: string): void {
    let p = this.players.get(id);
    if (!p) {
      const inv = emptyInv();
      add(inv, 'ration', 1);
      add(inv, 'water_bottle', 1);
      const a = this.random() * Math.PI * 2;
      p = {
        id,
        name: name.slice(0, 24) || 'Survivor',
        color: colorFor(id),
        x: SPAWN.x + Math.cos(a) * 2,
        z: SPAWN.z + Math.sin(a) * 2,
        ry: Math.PI,
        mv: 0,
        hp: 100,
        food: 80,
        water: 80,
        inv,
        held: 0,
        alive: true,
        spawn: null,
        poisonUntil: 0,
        heals: [],
        lastUse: -99,
        lastPos: this.time,
        kills: 0,
        deaths: 0,
        crafted: 0,
        escaped: false,
        torchAcc: 0,
      };
      this.players.set(id, p);
    } else if (name) {
      p.name = name.slice(0, 24);
    }
    p.lastPos = this.time;
    this.online.add(id);
    const data = JSON.stringify(this.snapshot());
    const parts = splitParts(data);
    parts.forEach((part, i) =>
      this.send(id, { type: 'welcome', you: id, part: i, parts: parts.length, data: part }),
    );
    this.sendMe(p);
    this.broadcast({ type: 'players', list: this.playerList() });
  }

  leave(id: string): void {
    this.online.delete(id);
    for (const m of this.mobs.values()) if (m.target === id) m.target = null;
    this.broadcast({ type: 'players', list: this.playerList() });
  }

  playerList() {
    return [...this.online].map((id) => {
      const p = this.players.get(id) as SimPlayer;
      return { id, name: p.name, color: p.color };
    });
  }

  snapshot(): Snapshot {
    return {
      seed: this.seed,
      time: this.time,
      nodes: [...this.nodes].map(([id, s]) => [id, s.hp, s.until]),
      buildings: [...this.buildings.values()].map(buildingNet),
      drops: [...this.drops.values()].map(dropNet),
      flags: [...this.flags],
      notes: [...this.notes],
      players: this.playerList(),
      rescue: this.rescueNet(),
    };
  }

  rescueNet() {
    return {
      phase: this.rescue.phase,
      left: Math.max(0, Math.round(this.rescue.endsAt - this.time)),
    };
  }

  serialize(): IslandSave {
    const players: IslandSave['players'] = {};
    for (const [id, p] of this.players) {
      players[id] = {
        name: p.name,
        color: p.color,
        x: round1(p.x),
        z: round1(p.z),
        hp: Math.round(p.hp),
        food: Math.round(p.food),
        water: Math.round(p.water),
        inv: p.inv.map((s) => (s ? { ...s } : null)),
        held: p.held,
        alive: p.alive,
        spawn: p.spawn,
        kills: p.kills,
        deaths: p.deaths,
        crafted: p.crafted,
        escaped: p.escaped,
      };
    }
    return {
      v: 1,
      seed: this.seed,
      time: Math.round(this.time),
      nextId: this.nextId,
      nodes: [...this.nodes].map(([id, s]) => [id, Math.round(s.hp), Math.round(s.until)]),
      buildings: [...this.buildings.values()].map((b) => ({
        ...b,
        x: round1(b.x),
        z: round1(b.z),
        hp: Math.round(b.hp),
        v: Math.round(b.v),
        acc: Math.round(b.acc),
        ...(b.inv ? { inv: b.inv.map((s) => (s ? { ...s } : null)) } : {}),
      })),
      drops: [...this.drops.values()].map((d) => ({ ...d, items: d.items.map((s) => ({ ...s })) })),
      players,
      flags: [...this.flags],
      notes: [...this.notes],
      motherHp: this.currentMotherHp(),
      rescue: { ...this.rescue },
    };
  }

  private currentMotherHp(): number | null {
    for (const m of this.mobs.values()) if (m.kind === 'mother') return Math.round(m.hp);
    return this.motherHp;
  }

  // -------------------------------------------------------------------------
  // Player messages.

  handle(id: string, msg: C2S): void {
    const p = this.players.get(id);
    if (!p || !this.online.has(id)) return;
    switch (msg.type) {
      case 'pos':
        return this.onPos(p, msg.x, msg.z, msg.ry, msg.mv);
      case 'use':
        return this.onUse(p, msg.kind, msg.id);
      case 'throw':
        return this.onThrow(p, msg.slot, msg.x, msg.z);
      case 'eat':
        return this.onEat(p, msg.slot);
      case 'equip':
        if (msg.slot >= 0 && msg.slot < HOTBAR) {
          p.held = Math.floor(msg.slot);
          this.dirty(p);
        }
        return;
      case 'craft':
        return this.onCraft(p, msg.recipe);
      case 'place':
        return this.onPlace(p, msg.slot, msg.x, msg.z, msg.rot);
      case 'demolish':
        return this.onDemolish(p, msg.id);
      case 'move':
        moveSlot(p.inv, Math.floor(msg.from), Math.floor(msg.to));
        return this.dirty(p);
      case 'drop':
        return this.onDropSlot(p, msg.slot);
      case 'store':
        return this.onStore(p, msg.id, msg.slot, msg.to);
      case 'take':
        return this.onTake(p, msg.id, msg.slot, msg.to);
      case 'code':
        return this.onCode(p, msg.code);
      case 'respawn':
        return this.onRespawn(p);
      default:
        return;
    }
  }

  private onPos(p: SimPlayer, x: number, z: number, ry: number, mv: number): void {
    if (!p.alive || !Number.isFinite(x) || !Number.isFinite(z)) return;
    const dt = Math.max(0.1, this.time - p.lastPos);
    const maxD = MAX_SPEED * dt + 1.5;
    let dx = x - p.x;
    let dz = z - p.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > maxD) {
      dx = (dx / d) * maxD;
      dz = (dz / d) * maxD;
    }
    p.x = clampWorld(p.x + dx);
    p.z = clampWorld(p.z + dz);
    p.ry = Number.isFinite(ry) ? ry : p.ry;
    p.mv = mv === 1 || mv === 2 ? mv : 0;
    p.lastPos = this.time;
  }

  held(p: SimPlayer): ItemDef | undefined {
    const s = p.inv[p.held];
    return s ? ITEMS[s.id] : undefined;
  }

  private onUse(p: SimPlayer, kind: UseKind, id: number | string): void {
    if (!p.alive) return;
    switch (kind) {
      case 'node':
        return this.useNode(p, Number(id));
      case 'mob':
        return this.useMob(p, Number(id));
      case 'build':
        return this.useBuilding(p, Number(id));
      case 'spot':
        return this.useSpot(p, String(id));
      case 'drop':
        return this.useDrop(p, Number(id));
      case 'pool':
        return this.usePool(p);
    }
  }

  private cooldownOk(p: SimPlayer, cd: number): boolean {
    if (this.time - p.lastUse < cd * 0.75) return false;
    p.lastUse = this.time;
    return true;
  }

  nodeGone(id: number): boolean {
    const s = this.nodes.get(id);
    return !!s && s.until !== 0;
  }

  private useNode(p: SimPlayer, id: number): void {
    if (!(id >= 0 && id < this.island.nodeCount) || this.nodeGone(id)) return;
    const type = this.island.nodeType[id] as number;
    const def = NODES[type];
    if (!def) return;
    const nx = this.island.nodeX[id] as number;
    const nz = this.island.nodeZ[id] as number;
    if (dist(p.x, p.z, nx, nz) > REACH + def.radius) return;
    const held = this.held(p);
    if (!this.cooldownOk(p, held?.weapon?.cooldown ?? 0.6)) return;
    let power: number;
    let usedTool = false;
    if (def.tool === 'hand') {
      power = 10;
    } else if (type === NODE.scrap) {
      usedTool = held?.tool?.kind === 'pick';
      power = usedTool ? (held?.tool?.power ?? 8) : 8;
    } else {
      power = powerFor(held, def.tool);
      usedTool = power > 0;
    }
    if (power <= 0) {
      const need = def.tool === 'axe' ? 'an axe' : def.tool === 'pick' ? 'a pickaxe' : 'a machete';
      this.toast(p.id, `${def.name}: you need ${need}.`);
      this.fx('deny', nx, nz, p.id);
      return;
    }
    if (usedTool && wear(p.inv, p.held)) this.toast(p.id, `Your ${held?.name ?? 'tool'} broke.`);
    const state = this.nodes.get(id) ?? { hp: def.hp, until: 0 };
    state.hp -= power;
    const fxKind = def.tool === 'axe' ? 'chop' : def.tool === 'pick' ? 'mine' : 'gather';
    this.fx(fxKind, nx, nz, p.id);
    if (state.hp > 0) {
      this.nodes.set(id, state);
      this.broadcast({ type: 'node', id, hp: state.hp, gone: 0 });
      this.dirty(p);
      return;
    }
    const neverBack = def.regrow === null || this.island.towerVines.includes(id);
    this.nodes.set(id, { hp: 0, until: neverBack ? -1 : this.time + (def.regrow ?? DAY) });
    this.broadcast({ type: 'node', id, hp: 0, gone: 1 });
    const got: string[] = [];
    if (type === NODE.luggage) {
      for (let k = 0; k < 2; k++) {
        const pick = pickWeighted(LUGGAGE_LOOT, hash01(id, k, this.seed + 77));
        this.give(p, pick.item, pick.n);
        got.push(`${pick.n} ${ITEMS[pick.item]?.name ?? pick.item}`);
      }
    } else {
      for (const drop of def.drops) {
        const chance = drop.chance ?? 1;
        if (chance < 1 && this.random() >= chance) continue;
        this.give(p, drop.item, drop.n);
        got.push(`${drop.n} ${ITEMS[drop.item]?.name ?? drop.item}`);
      }
    }
    if (got.length) this.toast(p.id, `+ ${got.join(', ')}`);
    if (this.island.towerVines.includes(id) && this.towerClear()) {
      this.broadcast({
        type: 'toast',
        text: 'The vines around the radio tower are cut. The antenna is reachable.',
      });
    }
    this.dirty(p);
  }

  towerClear(): boolean {
    return this.island.towerVines.every((v) => this.nodeGone(v));
  }

  private useMob(p: SimPlayer, id: number): void {
    const m = this.mobs.get(id);
    if (!m || m.hp <= 0 || m.st === 'burrow') return;
    const held = this.held(p);
    const weapon = held?.weapon;
    const reach = (weapon?.reach ?? 1.8) + (MONSTER_RADIUS[m.kind] ?? 0.5) + 0.8;
    if (dist(p.x, p.z, m.x, m.z) > reach) return;
    if (!this.cooldownOk(p, weapon?.cooldown ?? 0.6)) return;
    const dmg = weapon?.damage ?? HAND_DAMAGE;
    this.fx('swing', p.x, p.z, p.id);
    if (weapon && wear(p.inv, p.held)) this.toast(p.id, `Your ${held?.name ?? 'weapon'} broke.`);
    damageMob(this, m, dmg, p.id, weapon?.burn ?? 0);
    this.dirty(p);
  }

  private useBuilding(p: SimPlayer, id: number): void {
    const b = this.buildings.get(id);
    if (!b) return;
    if (dist(p.x, p.z, b.x, b.z) > REACH + 1.2) return;
    switch (b.kind) {
      case 'campfire': {
        if (b.v > CAMPFIRE_FUEL_MAX - 60) {
          this.toast(p.id, 'The fire is roaring. No more wood needed.');
          return;
        }
        if (!remove(p.inv, 'wood', 1)) {
          this.toast(p.id, 'You need wood to feed the fire.');
          return;
        }
        b.v = Math.min(CAMPFIRE_FUEL_MAX, b.v + CAMPFIRE_FUEL_PER_WOOD);
        this.broadcast({ type: 'build', b: buildingNet(b) });
        this.fx('build', b.x, b.z, p.id);
        this.dirty(p);
        return;
      }
      case 'door_wood':
        b.v = b.v === 1 ? 0 : 1;
        this.broadcast({ type: 'build', b: buildingNet(b) });
        return;
      case 'bedroll':
        p.spawn = b.id;
        this.toast(p.id, 'You will wake up here if you fall.');
        this.dirty(p);
        return;
      case 'rain_collector':
        if (b.v < 1) {
          this.toast(p.id, 'The collector is empty. Give it time.');
          return;
        }
        b.v -= 1;
        p.water = Math.min(100, p.water + 30);
        this.fx('drink', b.x, b.z, p.id);
        this.broadcast({ type: 'build', b: buildingNet(b) });
        this.dirty(p);
        return;
      default:
        return;
    }
  }

  private useSpot(p: SimPlayer, spotId: string): void {
    const s = this.spots.get(spotId);
    if (!s) return;
    if (dist(p.x, p.z, s.x, s.z) > REACH + 1) return;
    const { spot } = s;
    switch (spot.kind) {
      case 'note':
      case 'tag': {
        const fresh = !this.notes.has(spot.id);
        this.notes.add(spot.id);
        const note = spot.note ? NOTES[spot.note] : undefined;
        for (const r of note?.reveals ?? []) this.flags.add(`seen:${r}`);
        this.send(p.id, { type: 'event', e: 'note', id: spot.id });
        if (fresh) {
          this.broadcastProgress();
          this.fx('pickup', s.x, s.z, p.id);
        }
        return;
      }
      case 'loot': {
        const key = `loot:${spot.id}`;
        if (this.flags.has(key)) {
          this.toast(p.id, 'Empty. Someone got here first.');
          return;
        }
        this.flags.add(key);
        const got = (spot.loot ?? []).map((l) => {
          this.give(p, l.item, l.n);
          return `${l.n} ${ITEMS[l.item]?.name ?? l.item}`;
        });
        this.toast(p.id, `Found: ${got.join(', ')}`);
        this.fx('pickup', s.x, s.z, p.id);
        this.broadcastProgress();
        this.dirty(p);
        return;
      }
      case 'lock':
        if (this.flags.has('cargo_open'))
          this.toast(p.id, 'The cargo container is open and empty.');
        return;
      case 'antenna': {
        if (this.flags.has('antenna_taken')) {
          this.toast(p.id, 'The antenna is already gone.');
          return;
        }
        if (!this.towerClear()) {
          this.toast(p.id, 'Thick Bloom vines block the ladder. Cut them with a machete.');
          this.fx('deny', s.x, s.z, p.id);
          return;
        }
        this.flags.add('antenna_taken');
        this.give(p, 'antenna', 1);
        this.broadcast({
          type: 'toast',
          text: `${p.name} climbed the tower and took the antenna.`,
        });
        this.fx('pickup', s.x, s.z, p.id);
        this.broadcastProgress();
        this.dirty(p);
        return;
      }
      case 'beacon':
        return this.useBeacon(p);
      case 'heli':
        return this.useHeli(p);
    }
  }

  private useBeacon(p: SimPlayer): void {
    if (this.rescue.phase === 'calling' || this.rescue.phase === 'landed') {
      this.toast(p.id, 'Help is on the way. Hold out!');
      return;
    }
    if (p.inv.some((s) => s?.id === 'radio') === false) {
      this.toast(p.id, 'The beacon needs an emergency radio. Build one at a workbench.');
      this.fx('deny', p.x, p.z, p.id);
      return;
    }
    this.rescue = { phase: 'calling', endsAt: this.time + RESCUE_SECONDS };
    this.flags.add('radio_called');
    this.broadcast({ type: 'rescue', r: this.rescueNet() });
    this.broadcast({
      type: 'event',
      e: 'bloom',
      text: `${p.name} called for rescue! Hold the tower for 3 minutes. The Bloom heard it too.`,
    });
    this.broadcastProgress();
  }

  private useHeli(p: SimPlayer): void {
    if (this.rescue.phase !== 'landed') {
      this.toast(p.id, 'This is the helipad. Call for rescue at the beacon first.');
      return;
    }
    p.escaped = true;
    this.flags.add('escaped');
    this.broadcastProgress();
    this.send(p.id, { type: 'event', e: 'win' });
    this.broadcast({ type: 'toast', text: `${p.name} boarded the helicopter!` });
    this.dirty(p);
  }

  private useDrop(p: SimPlayer, id: number): void {
    const d = this.drops.get(id);
    if (!d || dist(p.x, p.z, d.x, d.z) > REACH + 0.5) return;
    const left: Slot[] = [];
    for (const s of d.items) {
      const rest = add(p.inv, s.id, s.n, s.d);
      if (rest > 0) left.push({ ...s, n: rest });
    }
    if (left.length) {
      d.items = left;
      this.broadcast({ type: 'drop', d: dropNet(d) });
      this.toast(p.id, 'Your bag is full. Some things are still there.');
    } else {
      this.drops.delete(id);
      this.broadcast({ type: 'undrop', id });
    }
    this.fx('pickup', d.x, d.z, p.id);
    this.dirty(p);
  }

  private usePool(p: SimPlayer): void {
    if (!poolNear(this.island, p.x, p.z, 2.5)) return;
    if (!this.cooldownOk(p, 0.8)) return;
    p.water = Math.min(100, p.water + 25);
    this.fx('drink', p.x, p.z, p.id);
    this.dirty(p);
  }

  private onThrow(p: SimPlayer, slot: number, x: number, z: number): void {
    const s = p.inv[slot];
    const def = s ? ITEMS[s.id] : undefined;
    if (!p.alive || !s || !def?.throwable) return;
    if (!this.cooldownOk(p, 0.8)) return;
    const range = def.throwable.range;
    let dx = x - p.x;
    let dz = z - p.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > range) {
      dx = (dx / d) * range;
      dz = (dz / d) * range;
    }
    remove(p.inv, s.id, 1);
    this.booms.push({ x: p.x + dx, z: p.z + dz, at: this.time + 0.55, by: p.id, item: s.id });
    this.fx('throw', p.x + dx, p.z + dz, p.id);
    this.dirty(p);
  }

  private onEat(p: SimPlayer, slot: number): void {
    const s = p.inv[slot];
    const def = s ? ITEMS[s.id] : undefined;
    if (!p.alive || !s || !def) return;
    if (def.food) {
      p.food = Math.min(100, p.food + def.food.food);
      p.water = Math.min(100, p.water + def.food.water);
      this.fx(def.food.water > def.food.food ? 'drink' : 'eat', p.x, p.z, p.id);
    } else if (def.heal) {
      p.heals.push({ perSec: def.heal.hp / def.heal.seconds, until: this.time + def.heal.seconds });
      p.poisonUntil = 0;
      this.fx('heal', p.x, p.z, p.id);
    } else {
      return;
    }
    s.n -= 1;
    if (s.n <= 0) p.inv[slot] = null;
    this.dirty(p);
  }

  stationNear(x: number, z: number, station: Exclude<Station, 'hand'>): boolean {
    for (const b of this.buildings.values()) {
      if (BUILDINGS[b.kind]?.station !== station) continue;
      if (station === 'fire' && b.v <= 0) continue;
      if (dist(x, z, b.x, b.z) <= STATION_RANGE) return true;
    }
    return false;
  }

  private onCraft(p: SimPlayer, recipeId: string): void {
    const r = RECIPES[recipeId];
    if (!p.alive || !r) return;
    if (r.station !== 'hand' && !this.stationNear(p.x, p.z, r.station)) {
      this.toast(
        p.id,
        r.station === 'fire'
          ? 'Stand next to a lit campfire.'
          : r.station === 'mash'
            ? 'Stand next to a Mashbench.'
            : 'Stand next to a workbench.',
      );
      return;
    }
    if (!removeAll(p.inv, r.needs)) {
      this.toast(p.id, 'Not enough materials.');
      return;
    }
    this.give(p, r.out, r.n);
    p.crafted++;
    this.fx('craft', p.x, p.z, p.id);
    this.toast(p.id, `Crafted ${r.n > 1 ? `${r.n} ` : ''}${ITEMS[r.out]?.name ?? r.out}`);
    if (r.out === 'radio') {
      this.broadcast({
        type: 'toast',
        text: `${p.name} built the emergency radio! Take it to the beacon on the peak.`,
      });
      this.flags.add('radio_built');
      this.broadcastProgress();
    }
    this.dirty(p);
  }

  /** Why a building can't go here, or null if it can. */
  placeProblem(kind: string, x: number, z: number, rot: number): string | null {
    return placementProblem(
      this.island,
      this.buildings.values(),
      (id) => this.nodeGone(id),
      kind,
      x,
      z,
      rot,
    );
  }

  private onPlace(p: SimPlayer, slot: number, x: number, z: number, rot: number): void {
    const s = p.inv[slot];
    const def = s ? ITEMS[s.id] : undefined;
    if (!p.alive || !s || !def?.place) return;
    if (dist(p.x, p.z, x, z) > 7) return;
    const kind = def.place;
    const r = Math.floor(rot) & 3;
    const problem = this.placeProblem(kind, x, z, r);
    if (problem) {
      this.toast(p.id, problem);
      this.fx('deny', x, z, p.id);
      return;
    }
    s.n -= 1;
    if (s.n <= 0) p.inv[slot] = null;
    const b: Building = {
      id: this.newId(),
      kind,
      x,
      z,
      rot: r,
      hp: BUILDINGS[kind]?.hp ?? 100,
      owner: p.id,
      v: kind === 'campfire' ? CAMPFIRE_FUEL_START : 0,
      acc: 0,
    };
    if (kind === 'storage') b.inv = new Array<Slot | null>(STORAGE_SLOTS).fill(null);
    if (kind === 'bedroll' && p.spawn === null) p.spawn = b.id;
    this.buildings.set(b.id, b);
    this.broadcast({ type: 'build', b: buildingNet(b) });
    this.fx('build', x, z, p.id);
    this.dirty(p);
  }

  private onDemolish(p: SimPlayer, id: number): void {
    const b = this.buildings.get(id);
    if (!p.alive || !b || dist(p.x, p.z, b.x, b.z) > REACH + 2) return;
    const def = BUILDINGS[b.kind];
    const item = Object.values(ITEMS).find((i) => i.place === b.kind);
    this.buildings.delete(id);
    this.broadcast({ type: 'unbuild', id });
    this.fx('break', b.x, b.z, p.id);
    if (item && def && b.hp >= def.hp * 0.5) this.give(p, item.id, 1);
    for (const s of b.inv ?? []) if (s) this.give(p, s.id, s.n, s.d);
    for (const q of this.players.values()) if (q.spawn === id) q.spawn = null;
    this.dirty(p);
  }

  private onDropSlot(p: SimPlayer, slot: number): void {
    const s = p.inv[slot];
    if (!p.alive || !s) return;
    p.inv[slot] = null;
    this.makeBag(p.x, p.z, [s], `${ITEMS[s.id]?.name ?? 'Items'}`, this.time + DAY);
    this.dirty(p);
  }

  private onStore(p: SimPlayer, id: number, slot: number, to?: number): void {
    const b = this.buildings.get(id);
    const s = p.inv[slot];
    if (!b?.inv || !s || dist(p.x, p.z, b.x, b.z) > REACH + 1.5) return;
    if (transfer(p.inv, slot, b.inv, cleanIndex(to, b.inv.length)) === 0) {
      this.toast(p.id, 'The box is full.');
      return;
    }
    this.broadcast({ type: 'build', b: buildingNet(b) });
    this.dirty(p);
  }

  private onTake(p: SimPlayer, id: number, slot: number, to?: number): void {
    const b = this.buildings.get(id);
    const s = b?.inv?.[slot];
    if (!b?.inv || !s || dist(p.x, p.z, b.x, b.z) > REACH + 1.5) return;
    if (transfer(b.inv, slot, p.inv, cleanIndex(to, p.inv.length)) === 0) {
      this.toast(p.id, 'Your bag is full.');
      return;
    }
    this.broadcast({ type: 'build', b: buildingNet(b) });
    this.dirty(p);
  }

  private onCode(p: SimPlayer, code: string): void {
    const s = this.spots.get('cargo_lock');
    if (!p.alive || !s || dist(p.x, p.z, s.x, s.z) > REACH + 1.5) return;
    if (this.flags.has('cargo_open')) return;
    if (String(code).trim() !== this.island.code) {
      this.toast(p.id, "Click. The lock doesn't budge.");
      this.fx('deny', s.x, s.z, p.id);
      return;
    }
    this.flags.add('cargo_open');
    const got = (s.spot.loot ?? []).map((l) => {
      this.give(p, l.item, l.n);
      return `${l.n} ${ITEMS[l.item]?.name ?? l.item}`;
    });
    this.fx('unlock', s.x, s.z, p.id);
    this.broadcast({ type: 'toast', text: `${p.name} opened the cargo hold: ${got.join(', ')}` });
    this.broadcastProgress();
    this.dirty(p);
  }

  private onRespawn(p: SimPlayer): void {
    if (p.alive) return;
    const bed = p.spawn !== null ? this.buildings.get(p.spawn) : undefined;
    if (bed && bed.kind === 'bedroll') {
      p.x = bed.x + 1.2;
      p.z = bed.z;
    } else {
      p.x = SPAWN.x + (this.random() - 0.5) * 4;
      p.z = SPAWN.z + (this.random() - 0.5) * 4;
    }
    p.alive = true;
    p.hp = 60;
    p.food = Math.max(p.food, 40);
    p.water = Math.max(p.water, 40);
    p.poisonUntil = 0;
    p.heals = [];
    p.lastPos = this.time;
    this.send(p.id, { type: 'event', e: 'respawn' });
    this.dirty(p);
  }

  // -------------------------------------------------------------------------
  // Shared helpers used by monsters.

  give(p: SimPlayer, item: string, n: number, d?: number): void {
    const rest = add(p.inv, item, n, d);
    if (rest > 0) {
      this.makeBag(
        p.x,
        p.z,
        [{ id: item, n: rest, ...(d !== undefined ? { d } : {}) }],
        'Overflow',
        this.time + DAY,
      );
      this.toast(p.id, 'Your bag is full; some items were left on the ground.');
    }
  }

  makeBag(x: number, z: number, items: Slot[], label: string, until: number): void {
    const d: Drop = { id: this.newId(), x, z, items, label, until };
    this.drops.set(d.id, d);
    this.broadcast({ type: 'drop', d: dropNet(d) });
  }

  hurtPlayer(p: SimPlayer, dmg: number, x: number, z: number): void {
    if (!p.alive || p.escaped) return;
    p.hp -= dmg;
    this.fx('hit', p.x, p.z, p.id, Math.round(dmg));
    void x;
    void z;
    if (p.hp <= 0) this.kill(p);
    this.dirty(p);
  }

  poison(p: SimPlayer, seconds: number): void {
    p.poisonUntil = Math.max(p.poisonUntil, this.time + seconds);
    this.dirty(p);
  }

  private kill(p: SimPlayer): void {
    p.alive = false;
    p.hp = 0;
    p.deaths++;
    const items = p.inv.filter((s): s is Slot => s !== null);
    if (items.length) this.makeBag(p.x, p.z, items, `${p.name}'s bag`, this.time + 2 * DAY);
    p.inv = emptyInv();
    p.heals = [];
    this.fx('death', p.x, p.z, p.id);
    this.send(p.id, { type: 'event', e: 'dead' });
    for (const m of this.mobs.values()) if (m.target === p.id) m.target = null;
  }

  /** The nearest blocking building whose footprint a circle at (x, z) overlaps. */
  blockingAt(x: number, z: number, r: number): Building | null {
    for (const b of this.buildings.values()) {
      if (!blocksNow(b)) continue;
      if (Math.abs(b.x - x) > 3 || Math.abs(b.z - z) > 3) continue;
      if (circleHitsBox(x, z, r, footprint(b.kind, b.x, b.z, b.rot))) return b;
    }
    return null;
  }

  damageBuilding(b: Building, dmg: number): void {
    b.hp -= dmg;
    if (b.hp <= 0) {
      this.buildings.delete(b.id);
      this.broadcast({ type: 'unbuild', id: b.id });
      this.fx('break', b.x, b.z);
      for (const p of this.players.values()) if (p.spawn === b.id) p.spawn = null;
      for (const s of b.inv ?? [])
        if (s) this.makeBag(b.x, b.z, [s], 'Box contents', this.time + DAY);
    } else {
      this.broadcast({ type: 'build', b: buildingNet(b) });
    }
  }

  /** The repelling light (heart lantern) that (x, z) is inside, if any. */
  repelAt(x: number, z: number, extra = 0): Light | null {
    for (const l of this.lights) {
      if (l.repel && dist(l.x, l.z, x, z) < l.r + extra) return l;
    }
    return null;
  }

  /** Is this player hidden by a petal mask (never on a Bloom night)? */
  hidden(p: SimPlayer): boolean {
    const s = p.inv[p.held];
    return !!s && ITEMS[s.id]?.stealth === true && !this.lastInfo.bloom;
  }

  /** The next research page a Husk had on it (shared progress). */
  findPage(p: SimPlayer): void {
    const page = PAGES.find((id) => !this.notes.has(id));
    if (!page) return;
    this.notes.add(page);
    const n = PAGES.indexOf(page) + 1;
    this.send(p.id, { type: 'event', e: 'note', id: page });
    this.broadcast({
      type: 'toast',
      text: `${p.name} found a page of Dr. Kessler's research (${n}/${PAGES.length}).`,
    });
    this.broadcastProgress();
  }

  /** Is (x, z) lit by fire (keeps fire-fearing monsters out)? */
  litAt(x: number, z: number, extra = 0): boolean {
    for (const l of this.lights) {
      if (dist(l.x, l.z, x, z) < l.r + extra) return true;
    }
    return false;
  }

  dirty(p: SimPlayer): void {
    this.meDirty.add(p.id);
  }

  broadcastProgress(): void {
    this.broadcast({ type: 'progress', flags: [...this.flags], notes: [...this.notes] });
  }

  // -------------------------------------------------------------------------
  // Simulation step.

  tick(dt: number): void {
    this.time += dt;
    this.dayEvents();
    this.updateLights();
    this.survival(dt);
    this.updateBuildings(dt);
    this.updateBooms();
    updateMobs(this, dt);
    this.slowAcc += dt;
    if (this.slowAcc >= 1) {
      this.slowAcc -= 1;
      runDirector(this);
      this.discover();
      this.expireDrops();
      this.updateRescue();
    }
    this.regrowAcc += dt;
    if (this.regrowAcc >= 2) {
      this.regrowAcc = 0;
      this.regrow();
    }
    this.sendTicks();
    this.flushMe();
  }

  private dayEvents(): void {
    const now = dayInfo(this.time);
    const was = this.lastInfo;
    this.lastInfo = now;
    const crossed = (edge: number) =>
      (was.phase < edge && now.phase >= edge) || (now.day !== was.day && edge <= now.phase);
    if (crossed(DUSK) && now.phase < NIGHT_START) {
      const bloomTonight = now.day % 7 === 0;
      this.broadcast({
        type: 'event',
        e: 'dusk',
        text: bloomTonight
          ? 'The air smells sweet and rotten. Tonight the Bloom wakes.'
          : 'Dusk. Get near a fire.',
      });
    }
    if (crossed(NIGHT_START)) {
      this.broadcast({
        type: 'event',
        e: now.bloom ? 'bloom' : 'night',
        text: now.bloom
          ? 'BLOOM NIGHT. Nothing keeps them away tonight. Survive until dawn.'
          : 'Night falls.',
      });
    }
    if (crossed(NIGHT_END) && now.phase < 0.5) {
      this.broadcast({ type: 'event', e: 'dawn', text: `Dawn. Day ${now.day}.` });
      burrowAll(this);
    }
  }

  private updateLights(): void {
    const lights: Light[] = [];
    for (const b of this.buildings.values()) {
      const def = BUILDINGS[b.kind];
      if (!def?.light || (b.kind === 'campfire' && b.v <= 0)) continue;
      lights.push({ x: b.x, z: b.z, r: def.light, ...(def.repels ? { repel: true } : {}) });
    }
    for (const id of this.online) {
      const p = this.players.get(id);
      if (p?.alive && p.inv[p.held]?.id === 'torch') lights.push({ x: p.x, z: p.z, r: 4.5 });
    }
    this.lights = lights;
  }

  private survival(dt: number): void {
    for (const id of this.online) {
      const p = this.players.get(id);
      if (!p || !p.alive || p.escaped) continue;
      const before = `${Math.round(p.hp)}|${Math.round(p.food)}|${Math.round(p.water)}`;
      p.food = Math.max(0, p.food - FOOD_DECAY * dt);
      p.water = Math.max(0, p.water - WATER_DECAY * dt);
      if (p.food <= 0) p.hp -= STARVE * dt;
      if (p.water <= 0) p.hp -= STARVE * dt;
      const poisoned = this.time < p.poisonUntil;
      if (poisoned) p.hp -= POISON_DPS * dt;
      p.heals = p.heals.filter((h) => h.until > this.time);
      for (const h of p.heals) p.hp += h.perSec * dt;
      if (!poisoned && p.food > 40 && p.water > 40) p.hp += REGEN * dt;
      for (const b of this.buildings.values()) {
        if (b.kind === 'campfire' && b.v > 0 && dist(b.x, b.z, p.x, p.z) < FIRE_HEAL_RANGE) {
          p.hp += FIRE_HEAL * dt;
          break;
        }
      }
      p.hp = Math.min(100, p.hp);
      // Torches burn and masks wilt while held.
      const held = p.inv[p.held];
      const heldDef = held ? ITEMS[held.id] : undefined;
      if (heldDef?.wears) {
        p.torchAcc += dt;
        if (p.torchAcc >= 1) {
          p.torchAcc -= 1;
          if (wear(p.inv, p.held)) {
            this.toast(
              p.id,
              heldDef.id === 'torch'
                ? 'Your torch burned out.'
                : `Your ${heldDef.name.toLowerCase()} fell apart.`,
            );
          }
          this.dirty(p);
        }
      }
      if (p.hp <= 0) this.kill(p);
      const after = `${Math.round(p.hp)}|${Math.round(p.food)}|${Math.round(p.water)}`;
      if (after !== before) this.dirty(p);
    }
  }

  private updateBuildings(dt: number): void {
    for (const b of this.buildings.values()) {
      if (b.kind === 'campfire' && b.v > 0) {
        b.v = Math.max(0, b.v - dt);
        if (b.v === 0) this.broadcast({ type: 'build', b: buildingNet(b) });
      } else if (b.kind === 'rain_collector' && b.v < RAIN_MAX) {
        b.acc += dt;
        if (b.acc >= RAIN_EVERY) {
          b.acc = 0;
          b.v += 1;
          this.broadcast({ type: 'build', b: buildingNet(b) });
        }
      } else if (BUILDINGS[b.kind]?.trap) {
        this.updateTrap(b, dt);
      }
    }
  }

  /** Snap traps: v is seconds until re-armed (0 = armed). */
  private updateTrap(b: Building, dt: number): void {
    const trap = BUILDINGS[b.kind]?.trap;
    if (!trap) return;
    if (b.v > 0) {
      b.v = Math.max(0, b.v - dt);
      if (b.v === 0) this.broadcast({ type: 'build', b: buildingNet(b) });
      return;
    }
    for (const m of this.mobs.values()) {
      if (m.kind === 'mother' || m.kind === 'crab' || m.hp <= 0 || m.st === 'burrow') continue;
      if (Math.abs(m.x - b.x) > 1.2 || Math.abs(m.z - b.z) > 1.2) continue;
      if (dist(m.x, m.z, b.x, b.z) > 0.6 + (MONSTER_RADIUS[m.kind] ?? 0.5)) continue;
      b.v = trap.rearm;
      this.fx('bite', b.x, b.z);
      m.heldUntil = this.time + trap.stun;
      m.st = 'idle';
      damageMob(this, m, trap.damage, b.owner || null, 0);
      this.broadcast({ type: 'build', b: buildingNet(b) });
      return;
    }
  }

  private updateBooms(): void {
    for (let i = this.booms.length - 1; i >= 0; i--) {
      const boom = this.booms[i] as (typeof this.booms)[number];
      if (this.time < boom.at) continue;
      this.booms.splice(i, 1);
      const bomb = ITEMS[boom.item]?.throwable;
      if (!bomb) continue;
      this.fx(
        boom.item === 'spore_bomb' ? 'spore' : 'boom',
        boom.x,
        boom.z,
        boom.by,
        undefined,
        bomb.radius,
      );
      for (const m of [...this.mobs.values()]) {
        if (dist(m.x, m.z, boom.x, boom.z) <= bomb.radius + (MONSTER_RADIUS[m.kind] ?? 0.5)) {
          damageMob(this, m, bomb.damage, boom.by, bomb.burn);
        }
      }
    }
  }

  private discover(): void {
    let changed = false;
    for (const id of this.online) {
      const p = this.players.get(id);
      if (!p?.alive) continue;
      for (const poi of POIS) {
        const key = `seen:${poi.id}`;
        if (!this.flags.has(key) && dist(p.x, p.z, poi.x, poi.z) < 45) {
          this.flags.add(key);
          this.toast(p.id, `Discovered: ${poi.name}`);
          changed = true;
        }
      }
    }
    if (changed) this.broadcastProgress();
  }

  private expireDrops(): void {
    for (const d of this.drops.values()) {
      if (d.until > 0 && this.time > d.until) {
        this.drops.delete(d.id);
        this.broadcast({ type: 'undrop', id: d.id });
      }
    }
  }

  private updateRescue(): void {
    if (this.rescue.phase === 'calling' && this.time >= this.rescue.endsAt) {
      this.rescue = { phase: 'landed', endsAt: this.time + HELI_WAIT };
      this.broadcast({ type: 'rescue', r: this.rescueNet() });
      this.broadcast({
        type: 'event',
        e: 'dawn',
        text: 'The helicopter has landed on the helipad! Get aboard!',
      });
    } else if (this.rescue.phase === 'landed' && this.time >= this.rescue.endsAt) {
      this.rescue = { phase: 'gone', endsAt: this.time };
      this.broadcast({ type: 'rescue', r: this.rescueNet() });
      this.broadcast({
        type: 'toast',
        text: 'The helicopter took off. The radio still works: call again from the beacon.',
      });
    }
  }

  private regrow(): void {
    for (const [id, s] of this.nodes) {
      if (s.until <= 0 || this.time < s.until) continue;
      const r = NODES[this.island.nodeType[id] as number]?.radius ?? 0;
      const x = this.island.nodeX[id] as number;
      const z = this.island.nodeZ[id] as number;
      if (r > 0 && this.blockingAt(x, z, r)) {
        s.until = this.time + 120;
        continue;
      }
      this.nodes.delete(id);
      this.broadcast({
        type: 'node',
        id,
        hp: NODES[this.island.nodeType[id] as number]?.hp ?? 1,
        gone: 0,
      });
    }
  }

  private sendTicks(): void {
    const players: PlayerNet[] = [];
    for (const id of this.online) {
      const p = this.players.get(id);
      if (!p) continue;
      players.push([
        id,
        round1(p.x),
        round1(p.z),
        round2(p.ry),
        p.mv,
        Math.round(p.hp),
        p.inv[p.held]?.id ?? '',
        p.alive && !p.escaped ? 1 : 0,
      ]);
    }
    const t = round1(this.time);
    for (const id of this.online) {
      const p = this.players.get(id);
      if (!p) continue;
      const mobs: MobNet[] = [];
      for (const m of this.mobs.values()) {
        if (Math.abs(m.x - p.x) > VIEW || Math.abs(m.z - p.z) > VIEW) continue;
        mobs.push([
          m.id,
          MOB_KINDS.indexOf(m.kind),
          round1(m.x),
          round1(m.z),
          round2(m.ry),
          mobStateCode(m),
          Math.max(0, Math.round((m.hp / m.maxHp) * 100)),
          this.time < m.burnUntil ? 1 : 0,
        ]);
      }
      this.out(id, { type: 'tick', t, p: players, m: mobs });
    }
  }

  private flushMe(): void {
    for (const id of this.meDirty) {
      const p = this.players.get(id);
      if (!p || !this.online.has(id)) {
        this.meDirty.delete(id);
        continue;
      }
      if (this.time - (this.meAt.get(id) ?? -1) < 0.2) continue;
      this.meDirty.delete(id);
      this.sendMe(p);
    }
  }

  private sendMe(p: SimPlayer): void {
    const me: MeNet = {
      hp: Math.max(0, Math.round(p.hp)),
      food: Math.round(p.food),
      water: Math.round(p.water),
      inv: p.inv.map((s) =>
        s ? { ...s, ...(s.d !== undefined ? { d: Math.round(s.d) } : {}) } : null,
      ),
      held: p.held,
      alive: p.alive,
      poison: Math.max(0, Math.round(p.poisonUntil - this.time)),
      spawnSet: p.spawn !== null,
      escaped: p.escaped,
      kills: p.kills,
      crafted: p.crafted,
      deaths: p.deaths,
    };
    const key = JSON.stringify(me);
    if (this.lastMe.get(p.id) === key) return;
    this.lastMe.set(p.id, key);
    this.meAt.set(p.id, this.time);
    this.send(p.id, { type: 'me', me });
  }
}

export const MONSTER_RADIUS: Record<string, number> = {
  husk: 0.45,
  snapjaw: 0.6,
  puffer: 0.5,
  thornback: 0.7,
  mother: 2.6,
  crab: 0.35,
};

export function buildingNet(b: Building): BuildingNet {
  const net: BuildingNet = {
    id: b.id,
    kind: b.kind,
    x: b.x,
    z: b.z,
    rot: b.rot,
    hp: Math.round(b.hp),
    owner: b.owner,
  };
  if (b.v) net.v = Math.round(b.v);
  if (b.inv) net.inv = b.inv.map((s) => (s ? { ...s } : null));
  return net;
}

export function dropNet(d: Drop): DropNet {
  return { id: d.id, x: d.x, z: d.z, items: d.items.map((s) => ({ ...s })), label: d.label };
}

function mobStateCode(m: Mob): number {
  if (m.hp <= 0) return MOB_STATE.dying;
  if (m.st === 'burrow') return MOB_STATE.burrow;
  if (m.st === 'emerge') return MOB_STATE.emerge;
  if (m.st === 'windup') return MOB_STATE.windup;
  if (m.st === 'recover' && m.t > 0.25) return MOB_STATE.strike;
  if (m.hurt > 0) return MOB_STATE.hurt;
  if (m.st === 'chase' || m.st === 'flee') return MOB_STATE.run;
  if (m.st === 'wander') return MOB_STATE.walk;
  return MOB_STATE.idle;
}

function pickWeighted<T extends { weight: number }>(list: T[], r: number): T {
  const total = list.reduce((s, e) => s + e.weight, 0);
  let acc = 0;
  for (const e of list) {
    acc += e.weight / total;
    if (r < acc) return e;
  }
  return list[list.length - 1] as T;
}

export function dist(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/** A slot index from a message, or undefined when it's missing or out of range. */
function cleanIndex(v: unknown, length: number): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < length ? v : undefined;
}

function clampWorld(v: number): number {
  return Math.max(-HALF + 2, Math.min(HALF - 2, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
