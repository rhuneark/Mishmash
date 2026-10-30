// The island authority. Runs on the room server in co-op, or in-process for
// solo play. Owns everything shared (nodes, buildings, monsters, progress) and
// each player's stats and inventory; players report their own position.

import {
  BUILDINGS,
  CAMPFIRE_FUEL_MAX,
  costFor,
  CAMPFIRE_FUEL_PER_WOOD,
  CAMPFIRE_FUEL_START,
  POT_FIRE_RANGE,
  RAIN_EVERY,
  RAIN_MAX,
  STATION_RANGE,
  refundOf,
  slotsOf,
} from '../content/buildings';
import { ITEMS, powerFor, type ItemDef } from '../content/items';
import { LUGGAGE_LOOT, NODE, NODES } from '../content/nodes';
import { CROPS, CROP_BY_ID, WET_SECONDS, cropForSeed, cropStage } from '../content/crops';
import { NOTES, PAGES } from '../content/notes';
import {
  BOTTLE_MAPS,
  DIG_HP,
  GENERATOR_SAP,
  TREASURE_LOOT,
  bunkerCode,
  wreckCode,
} from '../content/secrets';
import { RESCUE_SECONDS, type PoiDef, type Spot } from '../content/pois';
import { isClassic, type IslandParts } from '../islands';
import {
  changedRules,
  changeRules,
  hungerScale,
  parseRules,
  yieldOf,
  type WorldRules,
} from '../rules';
import { RECIPES, type Station } from '../content/recipes';
import { hash01 } from '../rng';
import { MAX_SAY, SAY_GAP, cleanMessage } from '../chat';
import { HALF, forNodesNear, hitCollider, poolNear, type Island } from '../world';
import {
  add,
  cleanInv,
  count,
  emptyInv,
  HOTBAR,
  moveSlot,
  removeFrom,
  remove,
  transfer,
  wear,
  type Inv,
} from './inventory';
import { FIRST_EVENT, compass, rollLoot, runEvents, sponsorPod } from './events';
import { isRewardKind, islandDay, rewardReady } from '../ads';
import { TUTORIAL, TUT_DONE, TUT_GIFT, TUT_VERSION, builtBy, type TutView } from '../tutorial';
import { DAILY_GIFT, DAILY_XP, dailyGoal, utcDay, type DailyKind } from '../daily';
import { lookCode, parseLook, shirtOf } from '../outfits';
import { parseWeather, runWeather, type WeatherState } from './weather';
import { burrowAll, damageMob, runDirector, spawnMob, updateMobs } from './mobs';
import { MONSTERS, PET_NAMES } from '../content/monsters';
import { BUILD_REACH, placementProblem } from './place';
import { PERK_STEP, XP, cantLearn, levelFor, rankOf, type PerkId } from '../skills';
import {
  MOB_KINDS,
  MOB_STATE,
  SHOTS,
  splitParts,
  type BuildingNet,
  type C2S,
  type DropNet,
  type MeNet,
  type MobNet,
  type PetNet,
  type PlayerNet,
  type S2C,
  type Slot,
  type Snapshot,
  type UseKind,
} from './protocol';
import { DAY, DUSK, NIGHT_END, NIGHT_START, dayInfo, lowTide, type DayInfo } from './time';
import {
  blocksNow,
  circleHitsBox,
  colorFor,
  footprint,
  type Building,
  type Drop,
  CHEST_SLOTS,
  type IslandSave,
  type Mob,
  type PetState,
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
/** Second wind's flash throws the Bloom this far back from you. */
const SECOND_WIND_RANGE = 10;
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
  /** World events (events.ts): when the next one comes, and pods on their way down. */
  nextEvent: number;
  /** World rules (rules.ts), picked when the island was made; its owner may change them. */
  rules: WorldRules;
  /** The sky (weather.ts). */
  weather: WeatherState;
  /** Who may change the rules: the solo player, or the host of a co-op room. */
  owner = '';
  /** A public island (strangers): only who built a piece, or the host, takes it down. */
  open = false;
  /** The wall clock (ms), handed in by the link or the room before each tick: the daily goal's
   * date. 0 until then. */
  wallMs = 0;
  /** The island's multiplayer code (kept in the save). */
  readonly code: string | undefined;
  readonly parts: IslandParts;
  /** The storage every box opens when the rules connect them. */
  readonly chest: Inv;
  readonly falling: { x: number; z: number; at: number; sponsor?: boolean }[] = [];
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
  /** Treasure being dug up: hits left (map number → hp). */
  private readonly digs = new Map<number, number>();
  /** Arrows in the air: they hit `mob` when they get there. */
  private readonly shots: { mob: number; at: number; by: string; dmg: number; burn: number }[] = [];

  constructor(island: Island, save: IslandSave, out: Out, random: () => number) {
    this.island = island;
    this.seed = save.seed;
    this.out = out;
    this.random = random;
    this.time = save.time;
    this.nextId = save.nextId;
    this.code = save.code;
    this.rules = parseRules(save.rules);
    this.parts = island.spec;
    this.chest = cleanInv(save.chest, this.rules.infiniteStacks, CHEST_SLOTS);
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
        look: '',
        x: p.x,
        z: p.z,
        ry: 0,
        mv: 0,
        hp: p.hp,
        food: p.food,
        water: p.water,
        inv: cleanInv(p.inv, this.rules.infiniteStacks),
        held: p.held,
        alive: p.alive,
        spawn: p.spawn,
        poisonUntil: 0,
        heals: [],
        lastUse: -99,
        lastPos: this.time,
        kills: p.kills,
        slain: p.slain ?? 0,
        deaths: p.deaths,
        crafted: p.crafted,
        escaped: p.escaped,
        torchAcc: 0,
        lastSay: -99,
        xp: p.xp ?? 0,
        perks: { ...(p.perks ?? {}) },
        ads: { ...(p.ads ?? {}) },
        lastBag: null,
        tut: p.tut ?? TUT_DONE,
        tutPaid: p.tutPaid ?? (p.tut === undefined ? TUT_DONE : 0),
        ...(p.daily ? { daily: { ...p.daily } } : {}),
      });
    }
    for (const f of save.flags) this.flags.add(f);
    for (const n of save.notes) this.notes.add(n);
    this.motherHp = save.motherHp;
    this.rescue = { ...save.rescue };
    this.nextEvent = save.nextEvent ?? this.time + FIRST_EVENT;
    this.weather = parseWeather(save.weather, this.time);
    for (const pet of save.pets ?? []) {
      const m = spawnMob(this, pet.kind, pet.x, pet.z, { hp: pet.hp });
      m.tame = { owner: pet.owner, name: pet.name, mode: pet.mode, next: pet.next };
      m.gx = pet.x;
      m.gz = pet.z;
    }
    for (const poi of island.pois) {
      for (const spot of poi.spots) {
        this.spots.set(spot.id, { poi, spot, x: poi.x + spot.dx, z: poi.z + spot.dz });
      }
    }
    this.lastInfo = this.info();
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

  /** New world rules from the island's owner (storage stays as the island was made). */
  setRules(raw: unknown): void {
    this.rules = changeRules(this.rules, raw);
    this.lastInfo = this.info();
    this.broadcast({ type: 'rules', rules: { ...this.rules } });
  }

  /** Day, night and Bloom nights by this island's rules. */
  info(): DayInfo {
    return dayInfo(this.time, this.rules.bloomEvery);
  }

  /** A building as players see it (storage boxes show the shared chest when connected). */
  net(b: Building): BuildingNet {
    const n = buildingNet(b);
    if (slotsOf(b.kind) && this.rules.sharedChests)
      n.inv = this.chest.map((s) => (s ? { ...s } : null));
    return n;
  }

  /** The inventory a storage box holds (the shared chest when connected). */
  chestOf(b: Building): Inv | null {
    if (!slotsOf(b.kind)) return null;
    return this.rules.sharedChests ? this.chest : (b.inv ?? null);
  }

  /** Tells everyone a box changed (every box, when they share one chest). */
  private chestChanged(b: Building): void {
    if (!this.rules.sharedChests) {
      this.broadcast({ type: 'build', b: this.net(b) });
      return;
    }
    for (const o of this.buildings.values())
      if (slotsOf(o.kind)) this.broadcast({ type: 'build', b: this.net(o) });
  }

  // -------------------------------------------------------------------------
  // Joining.

  join(id: string, name: string, look?: string): void {
    let p = this.players.get(id);
    if (!p) {
      const inv = emptyInv();
      add(inv, 'ration', 1);
      add(inv, 'water_bottle', 1);
      const a = this.random() * Math.PI * 2;
      const spawn = this.island.spawn;
      p = {
        id,
        name: name.slice(0, 24) || 'Survivor',
        color: colorFor(id),
        look: '',
        x: spawn.x + Math.cos(a) * 2,
        z: spawn.z + Math.sin(a) * 2,
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
        slain: 0,
        deaths: 0,
        crafted: 0,
        escaped: false,
        torchAcc: 0,
        lastSay: -99,
        xp: 0,
        perks: {},
        ads: {},
        lastBag: null,
        tut: 0,
        tutPaid: 0,
      };
      this.players.set(id, p);
    } else if (name) {
      p.name = name.slice(0, 24);
    }
    // The outfit (looks only): its coat is the survivor's colour on the island.
    const worn = parseLook(look);
    p.look = lookCode(worn);
    p.color = shirtOf(worn, colorFor(id));
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
      return { id, name: p.name, color: p.color, look: p.look };
    });
  }

  snapshot(): Snapshot {
    return {
      seed: this.seed,
      time: this.time,
      nodes: [...this.nodes].map(([id, s]) => [id, s.hp, s.until]),
      buildings: [...this.buildings.values()].map((b) => this.net(b)),
      drops: [...this.drops.values()].map(dropNet),
      flags: [...this.flags],
      notes: [...this.notes],
      players: this.playerList(),
      rescue: this.rescueNet(),
      island: { ...this.parts },
      rules: { ...this.rules },
      weather: this.weather.kind,
      pets: this.petList(),
    };
  }

  /** Tamed animals as players see them. */
  petList(): PetNet[] {
    const out: PetNet[] = [];
    for (const m of this.mobs.values()) {
      if (!m.tame) continue;
      const gives = MONSTERS[m.kind].animal?.gives;
      out.push({
        id: m.id,
        name: m.tame.name,
        owner: m.tame.owner,
        mode: m.tame.mode,
        ready: !!gives && this.time >= m.tame.next,
      });
    }
    return out;
  }

  private lastPets = '';

  /** Tells everyone when a pet is tamed, told to stay, has something ready, or is gone. */
  petsChanged(): void {
    const list = this.petList();
    const key = JSON.stringify(list);
    if (key === this.lastPets) return;
    this.lastPets = key;
    this.broadcast({ type: 'pets', list });
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
        slain: p.slain ?? 0,
        deaths: p.deaths,
        crafted: p.crafted,
        escaped: p.escaped,
        ...(p.xp ? { xp: p.xp, perks: { ...p.perks } } : {}),
        ...(Object.keys(p.ads).length ? { ads: { ...p.ads } } : {}),
        tut: p.tut,
        tutPaid: p.tutPaid,
        tutV: TUT_VERSION,
        ...(p.daily ? { daily: { ...p.daily } } : {}),
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
      nextEvent: Math.round(this.nextEvent),
      ...(isClassic(this.parts) ? {} : { island: { ...this.parts } }),
      ...(Object.keys(changedRules(this.rules)).length ? { rules: { ...this.rules } } : {}),
      ...(this.chest.some((s) => s) ? { chest: this.chest.map((s) => (s ? { ...s } : null)) } : {}),
      weather: { kind: this.weather.kind, until: Math.round(this.weather.until) },
      ...(this.code ? { code: this.code } : {}),
      ...(this.petList().length
        ? {
            pets: [...this.mobs.values()]
              .filter((m) => m.tame)
              .map((m) => ({
                ...(m.tame as PetState),
                kind: m.kind,
                x: round1(m.x),
                z: round1(m.z),
                hp: Math.round(m.hp),
              })),
          }
        : {}),
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
      case 'shoot':
        return this.onShoot(p, msg.x, msg.z);
      case 'eat':
        return this.onEat(p, msg.slot);
      case 'equip':
        if (msg.slot >= 0 && msg.slot < HOTBAR) {
          p.held = Math.floor(msg.slot);
          this.dirty(p);
        }
        return;
      case 'craft': {
        // Several at once (the craft menu's ×5): each one checked like a single craft.
        const n = Math.min(20, Math.max(1, Math.floor(Number(msg.n) || 1)));
        for (let k = 0; k < n; k++) if (!this.onCraft(p, msg.recipe, k === n - 1)) break;
        return;
      }
      case 'learn':
        return this.onLearn(p, msg.perk);
      case 'place':
        return this.onPlace(p, msg.slot, msg.x, msg.z, msg.rot);
      case 'build':
        return this.onBuild(p, msg.kind, msg.x, msg.z, msg.rot);
      case 'demolish':
        return this.onDemolish(p, msg.id);
      case 'move':
        moveSlot(p.inv, Math.floor(msg.from), Math.floor(msg.to), this.rules.infiniteStacks);
        return this.dirty(p);
      case 'drop':
        return this.onDropSlot(p, msg.slot);
      case 'store':
        return this.onStore(p, msg.id, msg.slot, msg.to);
      case 'take':
        return this.onTake(p, msg.id, msg.slot, msg.to);
      case 'code':
        return this.onCode(p, msg.code);
      case 'rules':
        if (id === this.owner) this.setRules(msg.rules);
        return;
      case 'respawn':
        return this.onRespawn(p);
      case 'reward':
        return this.onReward(p, msg.kind);
      case 'tutorial':
        return this.onTutorial(p, msg.act, msg.step);
      case 'say':
        return this.onSay(p, msg.text);
      default:
        return;
    }
  }

  /** A chat line for everyone on the island: one line, short, not too often. */
  private onSay(p: SimPlayer, raw: unknown): void {
    if (typeof raw !== 'string' || this.time - p.lastSay < SAY_GAP) return;
    const text = cleanMessage(raw, MAX_SAY);
    if (!text) return;
    p.lastSay = this.time;
    this.broadcast({ type: 'say', from: p.id, name: p.name, text });
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
      case 'dig':
        return this.useDig(p, Number(id));
    }
  }

  private cooldownOk(p: SimPlayer, cd: number): boolean {
    if (this.time - p.lastUse < cd * 0.75) return false;
    p.lastUse = this.time;
    return true;
  }

  nodeGone(id: number): boolean {
    if (this.island.hidden[id]) return true;
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
    if (usedTool && this.wearHeld(p)) this.toast(p.id, `Your ${held?.name ?? 'tool'} broke.`);
    if (usedTool && def.tool === 'axe')
      power *= 1 + PERK_STEP.lumberjack * this.rank(p, 'lumberjack');
    if (usedTool && (def.tool === 'pick' || type === NODE.scrap))
      power *= 1 + PERK_STEP.miner * this.rank(p, 'miner');
    const state = this.nodes.get(id) ?? { hp: def.hp, until: 0 };
    state.hp -= (power * this.rules.blockDamage) / 100;
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
    // What you get shows as "+3 Wood" over your head (the client sees the bag change).
    if (type === NODE.luggage) {
      // Scavenger: one more find.
      const finds = 2 + this.rank(p, 'scavenger');
      for (let k = 0; k < finds; k++) {
        const pick = pickWeighted(LUGGAGE_LOOT, hash01(id, k, this.seed + 77));
        this.give(p, pick.item, yieldOf(pick.n, this.rules.yield));
      }
      this.gainXp(p, XP.luggage);
      this.did(p, 'search');
    } else {
      this.gainXp(p, def.tool === 'hand' ? XP.pick : XP.fell);
      this.did(p, def.tool === 'hand' ? 'pick' : 'fell');
      // Forager: sometimes one more from bushes, branches and stones; Scavenger from wreckage.
      const first = def.drops[0];
      const extra =
        def.tool === 'hand'
          ? PERK_STEP.forager * this.rank(p, 'forager')
          : type === NODE.scrap
            ? 0.5 * this.rank(p, 'scavenger')
            : 0;
      if (first && extra > 0 && this.random() < extra) this.give(p, first.item, 1);
      for (const drop of def.drops) {
        const chance = drop.chance ?? 1;
        if (chance < 1 && this.random() >= chance) continue;
        this.give(p, drop.item, yieldOf(drop.n, this.rules.yield));
      }
    }
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
    const animal = MONSTERS[m.kind].animal;
    if (animal && (m.tame || this.feeds(p, m))) return this.usePet(p, m);
    const held = this.held(p);
    const weapon = held?.weapon;
    const reach = (weapon?.reach ?? 1.8) + (MONSTER_RADIUS[m.kind] ?? 0.5) + 0.8;
    if (dist(p.x, p.z, m.x, m.z) > reach) return;
    if (!this.cooldownOk(p, weapon?.cooldown ?? 0.6)) return;
    const dmg = weapon?.damage ?? HAND_DAMAGE;
    this.fx('swing', p.x, p.z, p.id);
    if (weapon && this.wearHeld(p)) this.toast(p.id, `Your ${held?.name ?? 'weapon'} broke.`);
    damageMob(this, m, this.hitDamage(p, m, dmg, false), p.id, weapon?.burn ?? 0);
    this.dirty(p);
  }

  /** Is the player holding something this wild animal eats? */
  private feeds(p: SimPlayer, m: Mob): boolean {
    const held = p.inv[p.held];
    return !!held && !!MONSTERS[m.kind].animal?.food.includes(held.id);
  }

  /** An animal: feed a wild one (enough feedings and it's yours), or tend your own. */
  private usePet(p: SimPlayer, m: Mob): void {
    const animal = MONSTERS[m.kind].animal;
    if (!animal || dist(p.x, p.z, m.x, m.z) > REACH + 0.6) return;
    if (!this.cooldownOk(p, 0.6)) return;
    const tame = m.tame;
    if (!tame) {
      const held = p.inv[p.held];
      if (!held) return;
      held.n -= 1;
      if (held.n <= 0) p.inv[p.held] = null;
      const fed = m.fed && m.fed.by === p.id ? m.fed.n + 1 : 1;
      m.fed = { by: p.id, n: fed };
      this.fx('eat', m.x, m.z, p.id);
      // Animal friend: they trust you one feeding sooner.
      const feeds = Math.max(1, animal.feeds - this.rank(p, 'animal_friend'));
      if (fed >= feeds) {
        const name = PET_NAMES[m.id % PET_NAMES.length] as string;
        m.tame = {
          owner: p.id,
          name,
          mode: 'follow',
          next: this.time + (animal.gives?.every ?? 0) / 2,
        };
        delete m.fed;
        m.roamer = false;
        m.st = 'idle';
        this.fx('heal', m.x, m.z, p.id);
        this.toast(p.id, `${animal.icon} The ${animal.noun} trusts you now. Meet ${name}!`);
        this.gainXp(p, XP.tame);
        this.petsChanged();
      } else {
        this.toast(p.id, `The ${animal.noun} eats from your hand (${fed}/${feeds}).`);
      }
      this.dirty(p);
      return;
    }
    if (tame.owner !== p.id) {
      const owner = this.players.get(tame.owner)?.name ?? 'someone';
      this.toast(p.id, `${tame.name} belongs to ${owner}.`);
      return;
    }
    const gives = animal.gives;
    if (gives && this.time >= tame.next) {
      tame.next = this.time + gives.every * (this.rank(p, 'animal_friend') ? 0.5 : 1);
      this.give(p, gives.item, 1);
      this.toast(
        p.id,
        `${tame.name} gives you ${ITEMS[gives.item]?.name.toLowerCase() ?? 'something'}.`,
      );
      this.fx('pickup', m.x, m.z, p.id);
    } else {
      tame.mode = tame.mode === 'follow' ? 'stay' : 'follow';
      m.gx = m.x;
      m.gz = m.z;
      this.toast(
        p.id,
        tame.mode === 'stay' ? `${tame.name} stays here.` : `${tame.name} follows you.`,
      );
    }
    this.petsChanged();
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
        this.broadcast({ type: 'build', b: this.net(b) });
        this.fx('build', b.x, b.z, p.id);
        this.dirty(p);
        return;
      }
      case 'door_wood':
      case 'gate_wood':
      case 'fence_gate':
        b.v = b.v === 1 ? 0 : 1;
        this.broadcast({ type: 'build', b: this.net(b) });
        return;
      case 'bedroll':
      case 'bed':
        p.spawn = b.id;
        this.toast(p.id, 'You will wake up here if you fall.');
        this.dirty(p);
        return;
      case 'rain_collector': {
        if (b.v < 1) {
          this.toast(p.id, 'The collector is empty. Give it time.');
          return;
        }
        const can = this.heldCan(p);
        b.v -= 1;
        if (can) {
          can.d = ITEMS[can.id]?.durability ?? 8;
          this.toast(p.id, 'Watering can filled.');
        } else p.water = Math.min(100, p.water + 30);
        this.fx('drink', b.x, b.z, p.id);
        this.broadcast({ type: 'build', b: this.net(b) });
        this.dirty(p);
        return;
      }
      case 'garden_plot':
        return this.usePlot(p, b);
      default:
        return;
    }
  }

  private useSpot(p: SimPlayer, spotId: string): void {
    const s = this.spots.get(spotId);
    if (!s) return;
    if (dist(p.x, p.z, s.x, s.z) > REACH + 1) return;
    const { spot } = s;
    if (spot.after && !this.flags.has(spot.after)) return;
    if (spot.tide && !lowTide(this.time)) {
      this.toast(p.id, 'The hold is flooded. Low water is from 04:00 to 08:00 and 16:00 to 20:00.');
      this.fx('deny', s.x, s.z, p.id);
      return;
    }
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
          this.gainXp(p, XP.note);
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
        if (spot.note) this.findNote(p, spot.note);
        this.broadcastProgress();
        this.dirty(p);
        return;
      }
      case 'lock':
        if (this.flags.has(lockFlag(spot)))
          this.toast(
            p.id,
            spot.lock === 'bunker' ? 'The bunker door stands open.' : 'Open and empty.',
          );
        return;
      case 'generator': {
        if (this.flags.has('bunker_power')) {
          this.toast(p.id, 'The generator hums. The keypad by the door is lit.');
          return;
        }
        if (count(p.inv, 'sap') < GENERATOR_SAP) {
          this.toast(p.id, `The generator is out of fuel. It needs ${GENERATOR_SAP} Bloom sap.`);
          this.fx('deny', s.x, s.z, p.id);
          return;
        }
        remove(p.inv, 'sap', GENERATOR_SAP);
        this.flags.add('bunker_power');
        this.gainXp(p, XP.secret);
        this.fx('unlock', s.x, s.z, p.id);
        this.broadcast({
          type: 'toast',
          text: `${p.name} fuelled the bunker's generator. The keypad by the door lights up.`,
        });
        this.broadcastProgress();
        this.dirty(p);
        return;
      }
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
        this.gainXp(p, XP.secret);
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

  /** The watering can in hand, if that's what's held. */
  private heldCan(p: SimPlayer): Slot | null {
    const s = p.inv[p.held];
    return s && ITEMS[s.id]?.can ? s : null;
  }

  /** The seed to plant: the one in hand, else the first in the bag. */
  seedFor(p: SimPlayer): Slot | null {
    const held = p.inv[p.held];
    if (held && cropForSeed(held.id)) return held;
    return p.inv.find((s) => s && cropForSeed(s.id)) ?? null;
  }

  /** A garden plot: plant, water or harvest. */
  private usePlot(p: SimPlayer, b: Building): void {
    const crop = b.crop;
    if (!crop) {
      const seed = this.seedFor(p);
      const def = seed ? cropForSeed(seed.id) : undefined;
      if (!seed || !def) {
        this.toast(p.id, 'Plant seeds here. Suitcases, supply pods and berry bushes have them.');
        return;
      }
      seed.n -= 1;
      if (seed.n <= 0) p.inv[p.inv.indexOf(seed)] = null;
      b.crop = { id: def.id, grow: 0, wet: this.rainingOn(b.x, b.z) ? WET_SECONDS : 0 };
      this.gainXp(p, XP.plant);
      this.fx('gather', b.x, b.z, p.id);
      this.broadcast({ type: 'build', b: this.net(b) });
      this.dirty(p);
      return;
    }
    const def = CROP_BY_ID[crop.id];
    if (!def) return;
    if (crop.grow >= 1) {
      // Green thumb 2: one more from every harvest.
      const more = this.rank(p, 'green_thumb') >= 2 ? 1 : 0;
      this.give(p, def.out, yieldOf(this.between(def.yield), this.rules.yield) + more);
      this.gainXp(p, XP.harvest);
      const seeds = this.between(def.seeds);
      if (seeds > 0) this.give(p, def.seed, seeds);
      if (def.regrows) crop.grow = 0.5;
      else delete b.crop;
      this.fx('gather', b.x, b.z, p.id);
      this.broadcast({ type: 'build', b: this.net(b) });
      this.dirty(p);
      return;
    }
    const can = this.heldCan(p);
    if (can && (can.d ?? 0) >= 1 && crop.wet < WET_SECONDS * 0.5) {
      can.d = (can.d ?? 1) - 1;
      crop.wet = WET_SECONDS;
      this.fx('drink', b.x, b.z, p.id);
      this.broadcast({ type: 'build', b: this.net(b) });
      this.dirty(p);
      return;
    }
    if (can && (can.d ?? 0) < 1) {
      this.toast(p.id, 'The can is empty. Fill it at a pool or a rain collector.');
      return;
    }
    const pct = Math.floor(crop.grow * 100);
    this.toast(
      p.id,
      crop.wet > 0
        ? `${def.name}: ${pct}% grown.`
        : `${def.name}: ${pct}% grown. The soil is dry: water it, or wait for rain.`,
    );
  }

  /** A whole number between min and max. */
  private between([lo, hi]: [number, number]): number {
    return lo + Math.floor(this.random() * (hi - lo + 1));
  }

  /** Is a roof over (x, z)? Roofs keep the rain off. */
  sheltered(x: number, z: number): boolean {
    for (const b of this.buildings.values()) {
      if (BUILDINGS[b.kind]?.layer !== 'roof') continue;
      const f = footprint(b.kind, b.x, b.z, b.rot);
      if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) return true;
    }
    return false;
  }

  /** Does rain fall on (x, z) right now (weather, and no roof)? */
  rainingOn(x: number, z: number): boolean {
    return this.raining() && !this.sheltered(x, z);
  }

  /** Is it raining on the island? */
  raining(): boolean {
    return this.weather.kind === 'rain' || this.weather.kind === 'storm';
  }

  /** Lightning hits (x, z): monsters there burn, a tree there comes down. */
  strike(x: number, z: number): void {
    for (const m of [...this.mobs.values()])
      if (!m.tame && dist(m.x, m.z, x, z) < 3 + (MONSTER_RADIUS[m.kind] ?? 0.5))
        damageMob(this, m, 60, null, 6);
    let tree = -1;
    let best = 3;
    forNodesNear(this.island, x, z, 3, (id, d2) => {
      const t = this.island.nodeType[id];
      if ((t === NODE.palm || t === NODE.jungle || t === NODE.pine) && !this.nodeGone(id)) {
        const d = Math.sqrt(d2);
        if (d < best) {
          best = d;
          tree = id;
        }
      }
    });
    if (tree >= 0) {
      this.nodes.set(tree, { hp: 0, until: this.time + 3 * DAY });
      this.broadcast({ type: 'node', id: tree, hp: 0, gone: 1 });
      const tx = this.island.nodeX[tree] as number;
      const tz = this.island.nodeZ[tree] as number;
      this.makeBag(tx, tz, [{ id: 'wood', n: 2 }], 'Split wood', this.time + DAY);
    }
  }

  private usePool(p: SimPlayer): void {
    if (!poolNear(this.island, p.x, p.z, 2.5)) return;
    if (!this.cooldownOk(p, 0.8)) return;
    const can = this.heldCan(p);
    if (can) {
      can.d = ITEMS[can.id]?.durability ?? 8;
      this.toast(p.id, 'Watering can filled.');
      this.fx('drink', p.x, p.z, p.id);
      this.dirty(p);
      return;
    }
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

  /**
   * The held bow, crossbow or slingshot: the first of its ammo in the bag flies toward
   * (x, z) and hits the first creature on the line, unless a tree, rock or wreckage is
   * in the way. Arrows fly over walls, so you can shoot from behind your own.
   */
  private onShoot(p: SimPlayer, x: number, z: number): void {
    const held = p.inv[p.held];
    const bow = held ? ITEMS[held.id]?.ranged : undefined;
    if (!p.alive || !bow || !Number.isFinite(x) || !Number.isFinite(z)) return;
    const ammoSlot = p.inv.findIndex((s) => !!s && bow.ammo.includes(s.id));
    const ammo = p.inv[ammoSlot];
    if (!ammo) {
      this.toast(p.id, `No ${(ITEMS[bow.ammo[0] as string]?.name ?? 'ammo').toLowerCase()}s left.`);
      return;
    }
    if (!this.cooldownOk(p, bow.cooldown)) return;
    let dx = x - p.x;
    let dz = z - p.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) {
      dx = Math.sin(p.ry);
      dz = Math.cos(p.ry);
    } else {
      dx /= len;
      dz /= len;
    }
    const range = bow.range;
    // The first creature along the line...
    let hit: Mob | null = null;
    let far = range;
    for (const m of this.mobs.values()) {
      if (m.tame || m.hp <= 0 || m.st === 'burrow') continue;
      const ox = m.x - p.x;
      const oz = m.z - p.z;
      const t = ox * dx + oz * dz;
      if (t < 0.2 || t > far) continue;
      if (Math.abs(ox * dz - oz * dx) > (MONSTER_RADIUS[m.kind] ?? 0.5) + 0.35) continue;
      hit = m;
      far = t;
    }
    // ...unless something solid comes first.
    const block = this.shotBlocked(p.x, p.z, dx, dz, far);
    if (block < far) {
      hit = null;
      far = block;
    }
    const ammoId = ammo.id;
    const extra = ITEMS[ammoId]?.ammo;
    remove(p.inv, ammoId, 1);
    if (this.wearHeld(p)) this.toast(p.id, `Your ${ITEMS[held?.id ?? '']?.name ?? 'bow'} broke.`);
    const look = SHOTS.indexOf(ammoId as (typeof SHOTS)[number]);
    this.fx('shot', p.x + dx * far, p.z + dz * far, p.id, bow.speed, Math.max(0, look));
    if (hit) {
      this.shots.push({
        mob: hit.id,
        at: this.time + far / bow.speed,
        by: p.id,
        dmg: this.hitDamage(p, hit, bow.damage + (extra?.damage ?? 0), true),
        burn: extra?.burn ?? 0,
      });
    }
    this.dirty(p);
  }

  /** How far a shot gets before a tree, rock or landmark wall stops it. */
  private shotBlocked(x: number, z: number, dx: number, dz: number, range: number): number {
    let stop = range;
    for (let s = 0.5; s < stop; s += 0.5) {
      if (hitCollider(this.island, x + dx * s, z + dz * s, 0.05)) {
        stop = s;
        break;
      }
    }
    const mx = x + (dx * range) / 2;
    const mz = z + (dz * range) / 2;
    forNodesNear(this.island, mx, mz, range / 2 + 2, (id) => {
      if (this.nodeGone(id)) return;
      const r = NODES[this.island.nodeType[id] as number]?.radius ?? 0;
      if (r <= 0) return;
      const ox = (this.island.nodeX[id] as number) - x;
      const oz = (this.island.nodeZ[id] as number) - z;
      const t = ox * dx + oz * dz;
      if (t < 0.5 || t > stop) return;
      if (Math.abs(ox * dz - oz * dx) < r) stop = t;
    });
    return stop;
  }

  private onEat(p: SimPlayer, slot: number): void {
    const s = p.inv[slot];
    const def = s ? ITEMS[s.id] : undefined;
    if (!p.alive || !s || !def) return;
    if (def.reads) return this.readBottle(p, slot);
    if (!def.food && !def.heal) return;
    if (def.food) {
      p.food = Math.min(100, p.food + def.food.food);
      p.water = Math.min(100, p.water + def.food.water);
      this.fx(def.food.water > def.food.food ? 'drink' : 'eat', p.x, p.z, p.id);
    }
    if (def.heal) {
      // Meals heal over time; medicine also clears poison.
      // Field medic: more from every bandage, medicine and meal.
      const medic = 1 + PERK_STEP.field_medic * this.rank(p, 'field_medic');
      p.heals.push({
        perSec: (def.heal.hp * medic) / def.heal.seconds,
        until: this.time + def.heal.seconds,
      });
      if (!def.food) p.poisonUntil = 0;
      this.fx('heal', p.x, p.z, p.id);
    }
    s.n -= 1;
    if (s.n <= 0) p.inv[slot] = null;
    this.dirty(p);
  }

  stationNear(x: number, z: number, station: Exclude<Station, 'hand'>): boolean {
    for (const b of this.buildings.values()) {
      if (BUILDINGS[b.kind]?.station !== station) continue;
      if (station === 'fire' && b.v <= 0) continue;
      if (station === 'pot' && !this.fireUnder(b)) continue;
      if (dist(x, z, b.x, b.z) <= STATION_RANGE) return true;
    }
    return false;
  }

  /** A cooking pot only cooks with a lit campfire next to it. */
  private fireUnder(pot: Building): boolean {
    for (const b of this.buildings.values()) {
      if (b.kind === 'campfire' && b.v > 0 && dist(b.x, b.z, pot.x, pot.z) <= POT_FIRE_RANGE)
        return true;
    }
    return false;
  }

  private onCraft(p: SimPlayer, recipeId: string, last = true): boolean {
    const r = RECIPES[recipeId];
    if (!p.alive || !r) return false;
    if (r.station !== 'hand' && !this.stationNear(p.x, p.z, r.station)) {
      this.toast(
        p.id,
        r.station === 'fire'
          ? 'Stand next to a lit campfire.'
          : r.station === 'mash'
            ? 'Stand next to a Mashbench.'
            : r.station === 'pot'
              ? 'Stand by a cooking pot with a lit campfire next to it.'
              : 'Stand next to a workbench.',
      );
      return false;
    }
    const from = this.rules.craftFromChests ? [p.inv, ...this.chests()] : [p.inv];
    if (!removeFrom(from, r.needs)) {
      this.toast(p.id, 'Not enough materials.');
      return false;
    }
    if (from.length > 1) this.chestsChanged();
    this.give(p, r.out, r.n);
    p.crafted++;
    this.gainXp(p, r.station === 'bench' || r.station === 'mash' ? XP.craftBench : XP.craft);
    this.did(p, 'craft');
    if (r.station === 'fire' || r.station === 'pot') this.did(p, 'cook');
    if (last) {
      this.fx('craft', p.x, p.z, p.id);
      this.toast(p.id, `Crafted ${r.n > 1 ? `${r.n} ` : ''}${ITEMS[r.out]?.name ?? r.out}`);
    }
    if (r.out === 'radio') {
      this.broadcast({
        type: 'toast',
        text: `${p.name} built the emergency radio! Take it to the beacon on the peak.`,
      });
      this.flags.add('radio_built');
      this.broadcastProgress();
    }
    this.dirty(p);
    return true;
  }

  // -------------------------------------------------------------------------
  // Levels and skills (skills.ts).

  /** Today's date (UTC days) from the wall clock the link hands in; -1 before it does. */
  wallDay(): number {
    return this.wallMs > 0 ? utcDay(this.wallMs) : -1;
  }

  /** Something that may count towards today's daily goal; done once, it pays once. */
  did(p: SimPlayer, kind: DailyKind, n = 1): void {
    const day = this.wallDay();
    if (day < 0) return;
    if (p.daily?.day !== day) p.daily = { day, n: 0, done: false };
    const goal = dailyGoal(day);
    const d = p.daily;
    if (d.done || goal.kind !== kind) return;
    d.n = Math.min(goal.need, d.n + n);
    if (d.n >= goal.need) {
      d.done = true;
      for (const g of DAILY_GIFT) this.give(p, g.id, g.n);
      this.gainXp(p, DAILY_XP);
      this.fx('levelup', p.x, p.z, p.id, 0);
      this.out(p.id, {
        type: 'event',
        e: 'daily',
        text: `${goal.icon} Daily goal done: ${goal.text}! A care package: two bandages and water.`,
      });
    }
    this.dirty(p);
  }

  /** XP for something a player did; a new level brings a skill point. */
  gainXp(p: SimPlayer, n: number): void {
    if (n <= 0) return;
    const before = levelFor(p.xp);
    p.xp += n;
    const after = levelFor(p.xp);
    if (after > before) {
      this.fx('levelup', p.x, p.z, p.id, after);
      this.toast(p.id, `⭐ Level ${after}! A skill point to spend: 🎒 › Skills.`);
    }
    this.dirty(p);
  }

  private onLearn(p: SimPlayer, perk: unknown): void {
    const id = String(perk) as PerkId;
    const why = cantLearn(p.perks, p.xp, id);
    if (why) {
      this.toast(p.id, why);
      return;
    }
    p.perks[id] = rankOf(p.perks, id) + 1;
    this.fx('craft', p.x, p.z, p.id);
    this.dirty(p);
  }

  /** A perk's rank for a player (0 when they don't have it). */
  rank(p: SimPlayer | undefined, id: PerkId): number {
    return p ? rankOf(p.perks, id) : 0;
  }

  /** Wears the held tool or weapon (Tinkerer: sometimes it doesn't); true if it broke. */
  private wearHeld(p: SimPlayer): boolean {
    if (this.random() < PERK_STEP.tinkerer * this.rank(p, 'tinkerer')) return false;
    return wear(p.inv, p.held);
  }

  /** Damage a player's blow or shot does to a monster, with their perks. */
  private hitDamage(p: SimPlayer, m: Mob, base: number, ranged: boolean): number {
    let dmg = base;
    dmg *=
      1 +
      (ranged
        ? PERK_STEP.marksman * this.rank(p, 'marksman')
        : PERK_STEP.brawler * this.rank(p, 'brawler'));
    const max = MONSTERS[m.kind].hp;
    if (m.hp < max / 2 && this.rank(p, 'executioner')) dmg *= 1 + PERK_STEP.executioner;
    return Math.round(dmg * 10) / 10;
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

  /** A placeable item from the bag (pieces crafted before the build menu, held ghosts). */
  private onPlace(p: SimPlayer, slot: number, x: number, z: number, rot: number): void {
    const s = p.inv[slot];
    const def = s ? ITEMS[s.id] : undefined;
    if (!p.alive || !s || !def?.place) return;
    if (!this.canPlaceAt(p, def.place, x, z, rot)) return;
    s.n -= 1;
    if (s.n <= 0) p.inv[slot] = null;
    this.putDown(p, def.place, x, z, rot);
  }

  /** Build mode: a piece paid for from the bag (a made one first, else its materials). */
  private onBuild(p: SimPlayer, kind: string, x: number, z: number, rot: number): void {
    const def = BUILDINGS[kind];
    if (!p.alive || !def || !this.canPlaceAt(p, kind, x, z, rot, BUILD_REACH)) return;
    const made = p.inv.findIndex((s) => s && ITEMS[s.id]?.place === kind);
    const slot = made >= 0 ? p.inv[made] : null;
    if (slot) {
      slot.n -= 1;
      if (slot.n <= 0) p.inv[made] = null;
    } else {
      const from = this.rules.craftFromChests ? [p.inv, ...this.chests()] : [p.inv];
      const cost = costFor(kind, PERK_STEP.carpenter * this.rank(p, 'carpenter'));
      if (!removeFrom(from, cost)) {
        this.toast(p.id, `Not enough materials for the ${def.name.toLowerCase()}.`);
        this.fx('deny', x, z, p.id);
        return;
      }
      if (from.length > 1) this.chestsChanged();
    }
    this.putDown(p, kind, x, z, rot);
  }

  private canPlaceAt(
    p: SimPlayer,
    kind: string,
    x: number,
    z: number,
    rot: number,
    reach = 7,
  ): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(z) || dist(p.x, p.z, x, z) > reach) return false;
    const problem = this.placeProblem(kind, x, z, Math.floor(rot) & 3);
    if (problem) {
      this.toast(p.id, problem);
      this.fx('deny', x, z, p.id);
      return false;
    }
    return true;
  }

  private putDown(p: SimPlayer, kind: string, x: number, z: number, rot: number): void {
    const b: Building = {
      id: this.newId(),
      kind,
      x,
      z,
      rot: Math.floor(rot) & 3,
      // Sturdy build: tougher pieces.
      hp: Math.round(
        (BUILDINGS[kind]?.hp ?? 100) * (1 + PERK_STEP.sturdy * this.rank(p, 'sturdy')),
      ),
      owner: p.id,
      v: kind === 'campfire' ? CAMPFIRE_FUEL_START : 0,
      acc: 0,
    };
    const slots = slotsOf(kind);
    if (slots) b.inv = new Array<Slot | null>(slots).fill(null);
    if (BUILDINGS[kind]?.spawn && p.spawn === null) p.spawn = b.id;
    this.buildings.set(b.id, b);
    this.broadcast({ type: 'build', b: this.net(b) });
    this.fx('build', x, z, p.id);
    this.gainXp(p, XP.build);
    this.did(p, 'build');
    this.dirty(p);
  }

  private onDemolish(p: SimPlayer, id: number): void {
    const b = this.buildings.get(id);
    if (!p.alive || !b || dist(p.x, p.z, b.x, b.z) > BUILD_REACH + 1) return;
    if (this.open && b.owner !== p.id && p.id !== this.owner) {
      this.toast(p.id, 'On a public island only who built it takes it down.');
      this.fx('deny', b.x, b.z, p.id);
      return;
    }
    const def = BUILDINGS[b.kind];
    this.buildings.delete(id);
    this.broadcast({ type: 'unbuild', id });
    this.fx('break', b.x, b.z, p.id);
    // Half the materials come back, if it wasn't half broken already.
    if (def && b.hp >= def.hp * 0.5)
      for (const [item, n] of Object.entries(refundOf(b.kind))) this.give(p, item, n);
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
    const box = b ? this.chestOf(b) : null;
    const s = p.inv[slot];
    if (!b || !box || !s || dist(p.x, p.z, b.x, b.z) > REACH + 1.5) return;
    if (transfer(p.inv, slot, box, cleanIndex(to, box.length), this.rules.infiniteStacks) === 0) {
      this.toast(p.id, 'The box is full.');
      return;
    }
    this.chestChanged(b);
    this.dirty(p);
  }

  private onTake(p: SimPlayer, id: number, slot: number, to?: number): void {
    const b = this.buildings.get(id);
    const box = b ? this.chestOf(b) : null;
    const s = box?.[slot];
    if (!b || !box || !s || dist(p.x, p.z, b.x, b.z) > REACH + 1.5) return;
    if (transfer(box, slot, p.inv, cleanIndex(to, p.inv.length), this.rules.infiniteStacks) === 0) {
      this.toast(p.id, 'Your bag is full.');
      return;
    }
    this.chestChanged(b);
    this.dirty(p);
  }

  /** A code typed on the keypad of the nearest lock: the cargo hold, the bunker or the safe. */
  private onCode(p: SimPlayer, code: string): void {
    if (!p.alive) return;
    let s: { spot: Spot; x: number; z: number } | null = null;
    for (const v of this.spots.values()) {
      if (v.spot.kind !== 'lock' || dist(p.x, p.z, v.x, v.z) > REACH + 1.5) continue;
      if (!s || dist(p.x, p.z, v.x, v.z) < dist(p.x, p.z, s.x, s.z)) s = v;
    }
    if (!s) return;
    const { spot } = s;
    const flag = lockFlag(spot);
    if (this.flags.has(flag)) return;
    if (spot.lock === 'bunker' && !this.flags.has('bunker_power')) {
      this.toast(p.id, 'The keypad is dead. The generator next to the door has no fuel.');
      return;
    }
    if (spot.tide && !lowTide(this.time)) {
      this.toast(p.id, 'The safe is under water. Come back at low tide.');
      return;
    }
    const want =
      spot.lock === 'bunker'
        ? bunkerCode(this.seed)
        : spot.lock === 'wreck'
          ? wreckCode(this.seed)
          : this.island.code;
    if (String(code).trim() !== want) {
      this.toast(p.id, "Click. The lock doesn't budge.");
      this.fx('deny', s.x, s.z, p.id);
      return;
    }
    this.flags.add(flag);
    this.gainXp(p, XP.secret);
    const got = (spot.loot ?? []).map((l) => {
      this.give(p, l.item, l.n);
      return `${l.n} ${ITEMS[l.item]?.name ?? l.item}`;
    });
    this.fx('unlock', s.x, s.z, p.id);
    const what =
      spot.lock === 'bunker'
        ? 'opened the bunker door'
        : spot.lock === 'wreck'
          ? "opened the captain's safe"
          : 'opened the cargo hold';
    this.broadcast({ type: 'toast', text: `${p.name} ${what}: ${got.join(', ')}` });
    if (spot.note) this.findNote(p, spot.note);
    this.broadcastProgress();
    this.dirty(p);
  }

  /** A note found somewhere other than a spot (a treasure map): shared, and shown to the finder. */
  private findNote(p: SimPlayer, id: string): void {
    if (!NOTES[id]) return;
    if (!this.notes.has(id)) this.gainXp(p, XP.note);
    this.notes.add(id);
    this.send(p.id, { type: 'event', e: 'note', id });
  }

  /** Reads a message in a bottle: the next treasure map, or a castaway's letter. */
  private readBottle(p: SimPlayer, slot: number): void {
    const s = p.inv[slot];
    if (!s) return;
    s.n -= 1;
    if (s.n <= 0) p.inv[slot] = null;
    const next = BOTTLE_MAPS.map((n) => `treasure_${n}`).find((id) => !this.notes.has(id));
    this.findNote(p, next ?? 'bottle_letter');
    if (next) this.toast(p.id, 'A treasure map! The X is on your map.');
    this.broadcastProgress();
    this.dirty(p);
  }

  /** Digs at treasure map `n`'s X with a shovel: a few blows and the chest comes up. */
  private useDig(p: SimPlayer, n: number): void {
    const at = this.island.treasures[n - 1];
    if (!at || !this.notes.has(`treasure_${n}`) || this.flags.has(`dug:${n}`)) return;
    if (dist(p.x, p.z, at.x, at.z) > REACH + 0.8) return;
    const held = this.held(p);
    if (held?.tool?.kind !== 'shovel') {
      this.toast(p.id, 'You need a shovel to dig here. Make one at a workbench.');
      this.fx('deny', at.x, at.z, p.id);
      return;
    }
    if (!this.cooldownOk(p, held.weapon?.cooldown ?? 0.75)) return;
    if (this.wearHeld(p)) this.toast(p.id, 'Your shovel broke.');
    const left = (this.digs.get(n) ?? DIG_HP) - held.tool.power;
    this.fx('dig', at.x, at.z, p.id);
    if (left > 0) {
      this.digs.set(n, left);
      this.dirty(p);
      return;
    }
    this.digs.delete(n);
    this.flags.add(`dug:${n}`);
    this.gainXp(p, XP.secret);
    this.makeBag(
      at.x,
      at.z,
      rollLoot(TREASURE_LOOT, this.random),
      'Buried chest',
      this.time + 3 * DAY,
      'crate',
    );
    this.broadcast({ type: 'toast', text: `${p.name} dug up a buried chest!` });
    this.fx('unlock', at.x, at.z, p.id);
    this.broadcastProgress();
    this.dirty(p);
  }

  private onRespawn(p: SimPlayer): void {
    if (p.alive) return;
    const bed = p.spawn !== null ? this.buildings.get(p.spawn) : undefined;
    if (bed && BUILDINGS[bed.kind]?.spawn) {
      p.x = bed.x + 1.2;
      p.z = bed.z;
    } else {
      p.x = this.island.spawn.x + (this.random() - 0.5) * 4;
      p.z = this.island.spawn.z + (this.random() - 0.5) * 4;
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

  /**
   * An ad the player chose to watch to the end (ads.ts): the in-flight channel at a seatback
   * screen (a sponsor drop or Island Explorer), or Second wind when they've fallen. Each
   * once per island day.
   */
  private onReward(p: SimPlayer, kind: string): void {
    if (!isRewardKind(kind) || p.escaped || !rewardReady(p.ads, kind, this.time)) return;
    if (kind === 'wind') {
      if (p.alive) return;
      p.ads.wind = islandDay(this.time);
      this.secondWind(p);
      return;
    }
    if (!p.alive || !this.screenNear(p)) return;
    if (kind === 'guide') {
      const poi = this.unfound(p);
      if (!poi) {
        this.toast(p.id, "📺 Island Explorer: you've already been everywhere it goes.");
        return;
      }
      p.ads.guide = islandDay(this.time);
      this.flags.add(`seen:${poi.id}`);
      const d = Math.round(dist(p.x, p.z, poi.x, poi.z) / 10) * 10;
      this.toast(
        p.id,
        `📺 Island Explorer visits ${poi.name}, ${d} m ${compass(poi.x - p.x, poi.z - p.z)}. It's on your map.`,
      );
      this.fx('unlock', p.x, p.z, p.id);
      this.broadcastProgress();
    } else {
      if (!sponsorPod(this, p)) {
        this.toast(
          p.id,
          "📺 The sponsor couldn't find a clear spot near you. Try somewhere more open.",
        );
        return;
      }
      p.ads.drop = islandDay(this.time);
    }
    this.dirty(p);
  }

  /**
   * Survival basics (tutorial.ts): a step done (checked here when the island can see it,
   * taken on the player's word when it's about walking or eating), paid once per survivor
   * even if they start the tutorial again; skipping or starting over only moves the step.
   */
  private onTutorial(p: SimPlayer, act: string, step: number | undefined): void {
    if (act === 'skip') p.tut = TUT_DONE;
    else if (act === 'restart') p.tut = 0;
    else if (act === 'done') {
      const s = TUTORIAL[p.tut];
      if (!s || step !== p.tut) return;
      const view: TutView = {
        inv: p.inv,
        notes: this.notes,
        built: builtBy(this.buildings.values(), p.id),
        did: new Set(),
        xp: p.xp,
        perks: p.perks,
      };
      if (!s.trust && !s.done(view)) return;
      if (p.tut >= p.tutPaid) {
        p.tutPaid = p.tut + 1;
        this.gainXp(p, s.xp);
        if (p.tutPaid === TUT_DONE) for (const g of TUT_GIFT) this.give(p, g.id, g.n);
      }
      p.tut++;
    } else return;
    this.dirty(p);
  }

  /** A seatback screen in reach: the crash site's, or one someone built. */
  private screenNear(p: SimPlayer): boolean {
    for (const s of this.spots.values())
      if (s.spot.kind === 'screen' && dist(p.x, p.z, s.x, s.z) <= REACH + 1.5) return true;
    for (const b of this.buildings.values())
      if (BUILDINGS[b.kind]?.screen && dist(p.x, p.z, b.x, b.z) <= REACH + 1.5) return true;
    return false;
  }

  /** The nearest landmark or secret site nobody has found (survey markers stay a puzzle). */
  private unfound(p: SimPlayer): PoiDef | null {
    let best: PoiDef | null = null;
    for (const poi of this.island.pois) {
      if (this.flags.has(`seen:${poi.id}`) || poi.id.startsWith('marker')) continue;
      if (!best || dist(p.x, p.z, poi.x, poi.z) < dist(p.x, p.z, best.x, best.z)) best = poi;
    }
    return best;
  }

  /** Second wind: up again where they fell, with their bag, and the Bloom thrown back. */
  private secondWind(p: SimPlayer): void {
    const bag = p.lastBag !== null ? this.drops.get(p.lastBag) : undefined;
    if (bag) {
      const left: Slot[] = [];
      for (const s of bag.items) {
        const rest = add(p.inv, s.id, s.n, s.d, this.rules.infiniteStacks);
        if (rest > 0) left.push({ ...s, n: rest });
      }
      if (left.length) bag.items = left;
      else {
        this.drops.delete(bag.id);
        this.broadcast({ type: 'undrop', id: bag.id });
      }
    }
    p.lastBag = null;
    p.alive = true;
    p.hp = 50;
    p.food = Math.max(p.food, 30);
    p.water = Math.max(p.water, 30);
    p.poisonUntil = 0;
    p.heals = [];
    p.lastPos = this.time;
    for (const m of this.mobs.values()) {
      if (m.tame || !MONSTERS[m.kind].hostile) continue;
      const d = dist(p.x, p.z, m.x, m.z);
      if (d > SECOND_WIND_RANGE) continue;
      // Thrown back and dazzled for a moment.
      const push = Math.min((SECOND_WIND_RANGE - d) / Math.max(d, 0.5), 3);
      const nx = m.x + (m.x - p.x) * push;
      const nz = m.z + (m.z - p.z) * push;
      if (!hitCollider(this.island, nx, nz, 0.6)) {
        m.x = nx;
        m.z = nz;
      }
      m.heldUntil = Math.max(m.heldUntil, this.time + 4);
      if (m.target === p.id) m.target = null;
    }
    this.fx('lightning', p.x, p.z, p.id);
    this.fx('heal', p.x, p.z, p.id);
    this.send(p.id, { type: 'event', e: 'respawn' });
    this.broadcast({
      type: 'toast',
      text: `🚁 A Verdance med-drone got ${p.name} back on their feet.`,
    });
    this.dirty(p);
  }

  // -------------------------------------------------------------------------
  // Shared helpers used by monsters.

  give(p: SimPlayer, item: string, n: number, d?: number): void {
    const rest = add(p.inv, item, n, d, this.rules.infiniteStacks);
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

  makeBag(
    x: number,
    z: number,
    items: Slot[],
    label: string,
    until: number,
    kind?: 'crate' | 'pod',
  ): number {
    const d: Drop = { id: this.newId(), x, z, items, label, until, ...(kind ? { kind } : {}) };
    this.drops.set(d.id, d);
    this.broadcast({ type: 'drop', d: dropNet(d) });
    return d.id;
  }

  /** `bloom`: the Bloom did it (the difficulty rule scales it). */
  hurtPlayer(p: SimPlayer, dmg: number, x: number, z: number, bloom = true): void {
    if (!p.alive || p.escaped) return;
    if (bloom) {
      dmg = (dmg * this.rules.difficulty) / 100;
      // Thick skin.
      dmg *= 1 - PERK_STEP.thick_skin * this.rank(p, 'thick_skin');
    }
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
    // What's left behind follows the rules: everything, the hotbar, the bag, nothing.
    const rule = this.rules.deathDrop;
    const drops = (i: number) =>
      rule === 'everything' ||
      (rule === 'toolbelt' ? i < HOTBAR : rule === 'backpack' && i >= HOTBAR);
    const items: Slot[] = [];
    p.inv.forEach((s, i) => {
      if (!s || rule === 'nothing' || !(drops(i) || rule === 'delete')) return;
      if (rule !== 'delete') items.push(s);
      p.inv[i] = null;
    });
    p.lastBag = items.length
      ? this.makeBag(p.x, p.z, items, `${p.name}'s bag`, this.time + 2 * DAY)
      : null;
    p.heals = [];
    this.fx('death', p.x, p.z, p.id);
    this.send(p.id, { type: 'event', e: 'dead' });
    for (const m of this.mobs.values()) if (m.target === p.id) m.target = null;
  }

  /** Every storage inventory (the shared one once, when boxes are connected). */
  private chests(): Inv[] {
    if (this.rules.sharedChests) return [this.chest];
    const out: Inv[] = [];
    for (const b of this.buildings.values()) if (slotsOf(b.kind) && b.inv) out.push(b.inv);
    return out;
  }

  /** Crafting or building took from storage: tell everyone what's left. */
  private chestsChanged(): void {
    for (const b of this.buildings.values()) {
      if (!slotsOf(b.kind)) continue;
      this.chestChanged(b);
      // Connected boxes go out together.
      if (this.rules.sharedChests) break;
    }
  }

  /** The nearest blocking building whose footprint a circle at (x, z) overlaps. */
  /** Is anything anyone built within `r` m of (x, z)? Nothing spawns in or beside a base. */
  baseAt(x: number, z: number, r: number): boolean {
    for (const b of this.buildings.values()) {
      if (Math.abs(b.x - x) > r + 3 || Math.abs(b.z - z) > r + 3) continue;
      if (circleHitsBox(x, z, r, footprint(b.kind, b.x, b.z, b.rot))) return true;
    }
    return false;
  }

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
      this.broadcast({ type: 'build', b: this.net(b) });
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
    this.gainXp(p, XP.page);
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
      runEvents(this);
      runWeather(this);
      this.petsChanged();
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
    const now = this.info();
    const was = this.lastInfo;
    this.lastInfo = now;
    const crossed = (edge: number) =>
      (was.phase < edge && now.phase >= edge) || (now.day !== was.day && edge <= now.phase);
    if (crossed(DUSK) && now.phase < NIGHT_START) {
      const every = this.rules.bloomEvery;
      const bloomTonight = every > 0 && now.day % every === 0;
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
      // Everyone who made it through the night (a Bloom night counts for more).
      const bloomed = dayInfo(this.time - 30, this.rules.bloomEvery).bloom;
      for (const id of this.online) {
        const q = this.players.get(id);
        if (!q?.alive || q.escaped) continue;
        this.gainXp(q, bloomed ? XP.bloomDawn : XP.dawn);
        this.did(q, 'night');
      }
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
      const hunger = hungerScale(this.rules.hunger);
      // Iron stomach: slower hunger and thirst.
      const stomach = 1 - PERK_STEP.iron_stomach * this.rank(p, 'iron_stomach');
      p.food = Math.max(0, p.food - FOOD_DECAY * hunger * stomach * dt);
      // Out in the rain you drink as you go.
      const rain = this.rainingOn(p.x, p.z) ? 0.5 : 1;
      p.water = Math.max(0, p.water - WATER_DECAY * hunger * rain * stomach * dt);
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
        const wet = this.rainingOn(b.x, b.z) ? (this.weather.kind === 'storm' ? 2.2 : 1.6) : 1;
        b.v = Math.max(0, b.v - dt * wet);
        if (b.v === 0) this.broadcast({ type: 'build', b: this.net(b) });
      } else if (b.kind === 'rain_collector' && b.v < RAIN_MAX) {
        b.acc += dt * (this.rainingOn(b.x, b.z) ? 5 : 1);
        if (b.acc >= RAIN_EVERY) {
          b.acc = 0;
          b.v += 1;
          this.broadcast({ type: 'build', b: this.net(b) });
        }
      } else if (BUILDINGS[b.kind]?.trap) {
        this.updateTrap(b, dt);
      } else if (b.crop) {
        this.updatePlot(b, b.crop, dt);
      }
    }
  }

  /** Crops grow while the soil is wet; the rain waters plots without a roof. */
  private updatePlot(b: Building, crop: NonNullable<Building['crop']>, dt: number): void {
    const before = cropNet(crop).join();
    const def = CROP_BY_ID[crop.id];
    if (this.rainingOn(b.x, b.z)) crop.wet = WET_SECONDS;
    // Green thumb: the planter's crops grow faster.
    const thumb = 1 + PERK_STEP.green_thumb * this.rank(this.players.get(b.owner), 'green_thumb');
    if (def && crop.grow < 1 && crop.wet > 0)
      crop.grow = Math.min(1, crop.grow + (dt * thumb) / def.grow);
    crop.wet = Math.max(0, crop.wet - dt);
    if (cropNet(crop).join() !== before) this.broadcast({ type: 'build', b: this.net(b) });
  }

  /** Snap traps: v is seconds until re-armed (0 = armed). */
  private updateTrap(b: Building, dt: number): void {
    const trap = BUILDINGS[b.kind]?.trap;
    if (!trap) return;
    if (b.v > 0) {
      b.v = Math.max(0, b.v - dt);
      if (b.v === 0) this.broadcast({ type: 'build', b: this.net(b) });
      return;
    }
    for (const m of this.mobs.values()) {
      if (m.kind === 'mother' || m.kind === 'crab' || m.tame || m.hp <= 0 || m.st === 'burrow')
        continue;
      if (Math.abs(m.x - b.x) > 1.2 || Math.abs(m.z - b.z) > 1.2) continue;
      if (dist(m.x, m.z, b.x, b.z) > 0.6 + (MONSTER_RADIUS[m.kind] ?? 0.5)) continue;
      b.v = trap.rearm;
      this.fx('bite', b.x, b.z);
      m.heldUntil = this.time + trap.stun;
      m.st = 'idle';
      damageMob(this, m, trap.damage, b.owner || null, 0);
      this.broadcast({ type: 'build', b: this.net(b) });
      return;
    }
  }

  private updateBooms(): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i] as (typeof this.shots)[number];
      if (this.time < shot.at) continue;
      this.shots.splice(i, 1);
      const m = this.mobs.get(shot.mob);
      if (m && !m.tame && m.st !== 'burrow') damageMob(this, m, shot.dmg, shot.by, shot.burn);
    }
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
        if (m.tame) continue;
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
      for (const poi of this.island.pois) {
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
      slain: p.slain,
      crafted: p.crafted,
      deaths: p.deaths,
      xp: p.xp,
      perks: p.perks,
      ads: p.ads,
      tut: p.tut,
      ...(this.wallDay() >= 0
        ? {
            daily: {
              day: this.wallDay(),
              goal: dailyGoal(this.wallDay()).id,
              n: p.daily?.day === this.wallDay() ? p.daily.n : 0,
              done: p.daily?.day === this.wallDay() && p.daily.done,
            },
          }
        : {}),
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
  boar: 0.55,
  goat: 0.45,
  fowl: 0.3,
  dog: 0.4,
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
  if (b.crop) net.crop = cropNet(b.crop);
  return net;
}

/** [crop index, stage, wet, grown % in fives]: what players see of a plot. */
export function cropNet(c: NonNullable<Building['crop']>): [number, number, number, number] {
  return [
    Math.max(
      0,
      CROPS.findIndex((d) => d.id === c.id),
    ),
    cropStage(c.grow),
    c.wet > 0 ? 1 : 0,
    Math.floor(c.grow * 20) * 5,
  ];
}

export function dropNet(d: Drop): DropNet {
  const net: DropNet = {
    id: d.id,
    x: d.x,
    z: d.z,
    items: d.items.map((s) => ({ ...s })),
    label: d.label,
  };
  if (d.kind === 'crate' || d.kind === 'pod') net.kind = d.kind;
  return net;
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

/** The flag an opened lock sets (the cargo hold's predates the others). */
function lockFlag(spot: Spot): string {
  return `${spot.lock ?? 'cargo'}_open`;
}
