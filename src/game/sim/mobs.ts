// Monster behaviour and the spawn director. Husks stalk and fear fire (unless
// enraged), Snapjaws ambush from the grass, Puffers burst into spores,
// Thornbacks hunt fast, the Mother Bloom slams and seeds Puffers.

import { BUILDINGS } from '../content/buildings';
import { ITEMS } from '../content/items';
import { MONSTERS, MOTHER_SLAM_RADIUS, PUFFER_BURST, type MonsterKind } from '../content/monsters';
import { monsterScale, spawnsPerSecond, speedFor, wildlifeScale } from '../rules';
import { BIOME, biomeAt, heightAt, hitCollider } from '../world';
import type { IslandSim } from './sim';
import { DAY } from './time';
import { circleHitsBox, footprint, type Mob, type SimPlayer } from './types';

const DESPAWN = 80;

function dist(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function spawnMob(
  sim: IslandSim,
  kind: MonsterKind,
  x: number,
  z: number,
  opts: { roamer?: boolean; spot?: number; enraged?: boolean; hp?: number; emerge?: boolean } = {},
): Mob {
  const def = MONSTERS[kind];
  const m: Mob = {
    id: sim.newId(),
    kind,
    x,
    z,
    ry: sim.random() * Math.PI * 2,
    hp: opts.hp ?? def.hp,
    maxHp: def.hp,
    st: opts.emerge ? 'emerge' : 'idle',
    t: opts.emerge ? 1.2 : 0,
    target: null,
    siege: null,
    gx: x,
    gz: z,
    burnUntil: 0,
    burnDps: 0,
    enraged: opts.enraged ?? false,
    spot: opts.spot ?? -1,
    ax: x,
    az: z,
    lastHitBy: null,
    hurt: 0,
    roamer: opts.roamer ?? false,
    nextSpawn: sim.time + 6,
    heldUntil: 0,
  };
  sim.mobs.set(m.id, m);
  return m;
}

export function damageMob(
  sim: IslandSim,
  m: Mob,
  dmg: number,
  by: string | null,
  burn: number,
): void {
  if (m.hp <= 0) return;
  const def = MONSTERS[m.kind];
  m.hp -= dmg;
  m.hurt = 0.25;
  if (by) m.lastHitBy = by;
  if (burn > 0) {
    m.burnUntil = sim.time + 4;
    m.burnDps = burn;
  }
  sim.fx('mobhit', m.x, m.z, by ?? undefined, Math.round(dmg));
  if (by && def.hostile && m.kind !== 'mother') {
    m.target = by;
    m.enraged = m.enraged || m.kind === 'husk';
  }
  const animal = def.animal;
  if ((m.kind === 'crab' || (animal && !animal.fights)) && by) {
    m.st = 'flee';
    m.t = 4;
    m.target = by;
  } else if (animal?.fights && by && !m.tame) {
    // A hurt boar or dog turns on whoever hurt it.
    m.target = by;
    m.angryUntil = sim.time + 15;
  }
  if (m.hp <= 0) killMob(sim, m);
}

function killMob(sim: IslandSim, m: Mob): void {
  m.hp = 0;
  sim.mobs.delete(m.id);
  sim.fx('death', m.x, m.z);
  const def = MONSTERS[m.kind];
  if (m.tame) {
    sim.toast(m.tame.owner, `${def.animal?.icon ?? ''} ${m.tame.name} is gone.`);
    sim.petsChanged();
    return;
  }
  const killer = m.lastHitBy ? sim.players.get(m.lastHitBy) : undefined;
  if (m.kind === 'snapjaw' && m.spot >= 0) {
    sim.snapDeadUntil.set(m.spot, sim.time + DAY);
    sim.snapMob.delete(m.spot);
  }
  if (m.kind === 'mother') {
    sim.flags.add('mother_dead');
    sim.motherHp = null;
    sim.makeBag(
      m.x,
      m.z,
      [
        { id: 'transmitter', n: 1 },
        { id: 'bloom_heart', n: 1 },
        { id: 'sap', n: 8 },
      ],
      'Remains of the Mother Bloom',
      0,
    );
    sim.broadcast({
      type: 'event',
      e: 'dawn',
      text: 'The Mother Bloom burns and collapses. In the roots: the transmitter, and her heart, still beating.',
    });
    sim.broadcastProgress();
    if (killer) killer.kills++;
    return;
  }
  if (!killer) return;
  killer.kills++;
  const got: string[] = [];
  for (const drop of def.drops) {
    if ((drop.chance ?? 1) < 1 && sim.random() >= (drop.chance ?? 1)) continue;
    sim.give(killer, drop.item, drop.n);
    got.push(`${drop.n} ${ITEMS[drop.item]?.name ?? drop.item}`);
  }
  if (got.length) sim.toast(killer.id, `+ ${got.join(', ')}`);
  // The taken still carry pages of Dr. Kessler's research.
  if (m.kind === 'husk' && sim.random() < PAGE_CHANCE) sim.findPage(killer);
  sim.dirty(killer);
}

/** Chance that a Husk drops the next research page. */
export const PAGE_CHANCE = 0.3;

function alivePlayer(sim: IslandSim, id: string | null): SimPlayer | null {
  if (!id || !sim.online.has(id)) return null;
  const p = sim.players.get(id);
  return p && p.alive && !p.escaped ? p : null;
}

/** Monsters notice a masked player only this close. */
export const STEALTH_RANGE = 3;

function nearestPlayer(
  sim: IslandSim,
  x: number,
  z: number,
  range: number,
  sees: (p: SimPlayer) => boolean = () => true,
): SimPlayer | null {
  let best: SimPlayer | null = null;
  let bd = range;
  for (const id of sim.online) {
    const p = alivePlayer(sim, id);
    if (!p || !sees(p)) continue;
    const d = dist(p.x, p.z, x, z);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

type Step =
  { kind: 'moved' } | { kind: 'arrived' } | { kind: 'blocked' } | { kind: 'wall'; id: number };

function walkable(sim: IslandSim, x: number, z: number, r: number): boolean {
  if (heightAt(sim.island, x, z) < -0.3) return false;
  return !hitCollider(sim.island, x, z, r);
}

function stepToward(
  sim: IslandSim,
  m: Mob,
  tx: number,
  tz: number,
  speed: number,
  dt: number,
  stop: number,
): Step {
  const dx = tx - m.x;
  const dz = tz - m.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d <= stop) return { kind: 'arrived' };
  const step = Math.min(speed * dt, d - stop);
  const r = MONSTERS[m.kind].radius;
  const base = Math.atan2(dx, dz);
  for (const off of [0, 0.7, -0.7, 1.4, -1.4]) {
    const a = base + off;
    const nx = m.x + Math.sin(a) * step;
    const nz = m.z + Math.cos(a) * step;
    if (!walkable(sim, nx, nz, r)) continue;
    const wall = sim.blockingAt(nx, nz, r);
    if (wall) {
      if (off === 0) return { kind: 'wall', id: wall.id };
      continue;
    }
    m.x = nx;
    m.z = nz;
    m.ry = a;
    return { kind: 'moved' };
  }
  return { kind: 'blocked' };
}

export function updateMobs(sim: IslandSim, dt: number): void {
  const info = sim.info();
  for (const m of [...sim.mobs.values()]) {
    if (!sim.mobs.has(m.id)) continue;
    const def = MONSTERS[m.kind];
    m.hurt = Math.max(0, m.hurt - dt);
    if (sim.time < m.burnUntil) {
      m.hp -= m.burnDps * def.fireWeak * dt;
      if (m.hp <= 0) {
        killMob(sim, m);
        continue;
      }
    }
    if (m.st === 'burrow') {
      m.t -= dt;
      if (m.t <= 0) sim.mobs.delete(m.id);
      continue;
    }
    if (m.st === 'emerge') {
      m.t -= dt;
      if (m.t <= 0) m.st = 'idle';
      continue;
    }
    if (m.heldUntil > sim.time) continue;
    // The heart lantern: nothing of the Bloom stays in its light.
    if (!def.rooted) {
      const l = sim.repelAt(m.x, m.z, def.radius);
      if (l) {
        const dx = m.x - l.x;
        const dz = m.z - l.z;
        const d = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
        m.st = 'flee';
        stepToward(
          sim,
          m,
          l.x + (dx / d) * (l.r + 3),
          l.z + (dz / d) * (l.r + 3),
          def.run,
          dt,
          0.2,
        );
        continue;
      }
    }
    switch (m.kind) {
      case 'crab':
        crab(sim, m, dt);
        break;
      case 'boar':
      case 'goat':
      case 'fowl':
      case 'dog':
        if (m.tame) pet(sim, m, m.tame, dt);
        else wildAnimal(sim, m, dt);
        break;
      case 'snapjaw':
        snapjaw(sim, m, dt);
        break;
      case 'mother':
        mother(sim, m, dt);
        break;
      default:
        walker(sim, m, dt, info.night);
    }
    // Spike barricades hurt whatever presses on them (not your own animals).
    if (m.tame) continue;
    for (const b of sim.buildings.values()) {
      const thorns = BUILDINGS[b.kind]?.thorns;
      if (!thorns || Math.abs(b.x - m.x) > 3 || Math.abs(b.z - m.z) > 3) continue;
      if (circleHitsBox(m.x, m.z, def.radius + 0.35, footprint(b.kind, b.x, b.z, b.rot))) {
        m.hp -= thorns * dt;
        m.lastHitBy = m.lastHitBy ?? b.owner;
        if (m.hp <= 0) killMob(sim, m);
        break;
      }
    }
  }
  separate(sim);
}

function crab(sim: IslandSim, m: Mob, dt: number): void {
  const def = MONSTERS.crab;
  const threat = nearestPlayer(sim, m.x, m.z, 5);
  if (threat || m.st === 'flee') {
    m.t -= dt;
    if (threat) {
      m.st = 'flee';
      m.t = Math.max(m.t, 1);
      const dx = m.x - threat.x;
      const dz = m.z - threat.z;
      const d = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
      stepToward(sim, m, m.x + (dx / d) * 5, m.z + (dz / d) * 5, def.run, dt, 0);
    } else if (m.t <= 0) {
      m.st = 'idle';
    }
    return;
  }
  wander(sim, m, dt, def.walk, 6);
}

/** Whoever is closest and holds something this animal eats (it comes closer to them). */
function foodHolder(sim: IslandSim, m: Mob, range: number): SimPlayer | null {
  const food = MONSTERS[m.kind].animal?.food ?? [];
  return nearestPlayer(sim, m.x, m.z, range, (p) => {
    const held = p.inv[p.held];
    return !!held && food.includes(held.id);
  });
}

/**
 * A wild animal grazes and wanders. Shy ones run from people, but come closer to someone
 * holding their food; boars and dogs fight back when hurt.
 */
function wildAnimal(sim: IslandSim, m: Mob, dt: number): void {
  const def = MONSTERS[m.kind];
  const animal = def.animal;
  if (!animal) return;
  if (m.st === 'windup') {
    m.t -= dt;
    if (m.t > 0) return;
    const p = alivePlayer(sim, m.target);
    if (p && dist(p.x, p.z, m.x, m.z) <= def.reach + 0.7) sim.hurtPlayer(p, def.damage, m.x, m.z, false);
    else sim.fx('swing', m.x, m.z);
    m.st = 'recover';
    m.t = def.cooldown;
    return;
  }
  if (m.st === 'recover') {
    m.t -= dt;
    if (m.t <= 0) m.st = 'idle';
    return;
  }
  // Angry: chase whoever hurt it, for a while.
  const foe = (m.angryUntil ?? 0) > sim.time ? alivePlayer(sim, m.target) : null;
  if (foe && animal.fights) {
    const d = dist(foe.x, foe.z, m.x, m.z);
    m.ry = Math.atan2(foe.x - m.x, foe.z - m.z);
    if (d <= def.reach + 0.4) {
      m.st = 'windup';
      m.t = def.windup;
      return;
    }
    if (d > 25) m.angryUntil = 0;
    m.st = 'chase';
    stepToward(sim, m, foe.x, foe.z, def.run, dt, def.reach * 0.8);
    return;
  }
  if (m.st === 'flee') {
    m.t -= dt;
    const from = alivePlayer(sim, m.target);
    if (from && m.t > 0) {
      const dx = m.x - from.x;
      const dz = m.z - from.z;
      const d = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
      stepToward(sim, m, m.x + (dx / d) * 5, m.z + (dz / d) * 5, def.run, dt, 0);
      return;
    }
    m.st = 'idle';
  }
  // Someone holding its food: come closer, slowly, and wait to be fed.
  const friend = foodHolder(sim, m, 12);
  if (friend) {
    m.ry = Math.atan2(friend.x - m.x, friend.z - m.z);
    if (dist(friend.x, friend.z, m.x, m.z) > 1.8) {
      m.st = 'wander';
      stepToward(sim, m, friend.x, friend.z, def.walk, dt, 1.6);
    } else m.st = 'idle';
    return;
  }
  if (animal.shy) {
    const near = nearestPlayer(sim, m.x, m.z, m.kind === 'dog' ? 9 : 6);
    if (near) {
      m.st = 'flee';
      m.t = 2;
      m.target = near.id;
      return;
    }
  }
  wander(sim, m, dt, def.walk, 7);
}

/**
 * A tamed animal follows its person (or stays put when told), and boars and dogs go for
 * the Bloom near them.
 */
function pet(sim: IslandSim, m: Mob, tame: NonNullable<Mob['tame']>, dt: number): void {
  const def = MONSTERS[m.kind];
  if (m.st === 'windup') {
    m.t -= dt;
    if (m.t > 0) return;
    const foe = m.siege !== null ? sim.mobs.get(m.siege) : undefined;
    if (foe && dist(foe.x, foe.z, m.x, m.z) <= def.reach + MONSTERS[foe.kind].radius + 0.6) {
      sim.fx('bite', foe.x, foe.z);
      damageMob(sim, foe, def.damage * 1.5, tame.owner, 0);
    }
    m.st = 'recover';
    m.t = def.cooldown;
    return;
  }
  if (m.st === 'recover') {
    m.t -= dt;
    if (m.t <= 0) m.st = 'idle';
    return;
  }
  const owner = alivePlayer(sim, tame.owner);
  // Fighters go for the Bloom close to their person (or to where they were told to stay).
  if (def.animal?.fights) {
    const cx = tame.mode === 'follow' && owner ? owner.x : m.gx;
    const cz = tame.mode === 'follow' && owner ? owner.z : m.gz;
    let foe: Mob | null = null;
    let fd = 9;
    for (const o of sim.mobs.values()) {
      if (o.hp <= 0 || o.tame || !MONSTERS[o.kind].hostile || o.kind === 'mother') continue;
      const d = dist(o.x, o.z, cx, cz);
      if (d < fd && dist(o.x, o.z, m.x, m.z) < 14) {
        fd = d;
        foe = o;
      }
    }
    if (foe) {
      m.ry = Math.atan2(foe.x - m.x, foe.z - m.z);
      if (dist(foe.x, foe.z, m.x, m.z) <= def.reach + MONSTERS[foe.kind].radius + 0.3) {
        m.st = 'windup';
        m.t = def.windup;
        m.siege = foe.id;
        return;
      }
      m.st = 'chase';
      stepToward(sim, m, foe.x, foe.z, def.run, dt, def.reach * 0.7);
      return;
    }
  }
  if (tame.mode === 'stay' || !owner) {
    // Potter about where it was left.
    if (dist(m.x, m.z, m.gx, m.gz) > 4) {
      m.st = 'wander';
      stepToward(sim, m, m.gx, m.gz, def.walk, dt, 1);
    } else {
      m.t -= dt;
      if (m.t <= 0) m.st = 'idle';
    }
    return;
  }
  const d = dist(owner.x, owner.z, m.x, m.z);
  if (d > 80) {
    // Lost them (they died, or ran far): catch up.
    m.x = owner.x + 2;
    m.z = owner.z + 2;
    return;
  }
  if (d > 3.2) {
    m.st = d > 8 ? 'chase' : 'wander';
    stepToward(sim, m, owner.x, owner.z, d > 8 ? def.run : def.walk * 1.4, dt, 2.4);
  } else {
    m.st = 'idle';
  }
}

function wander(sim: IslandSim, m: Mob, dt: number, speed: number, range: number): void {
  m.t -= dt;
  if (m.st !== 'wander' || m.t <= 0) {
    if (m.st === 'wander' || sim.random() < 0.5) {
      m.st = 'idle';
      m.t = 1 + sim.random() * 3;
      if (sim.random() < 0.5) {
        m.st = 'wander';
        m.gx = m.x + (sim.random() - 0.5) * 2 * range;
        m.gz = m.z + (sim.random() - 0.5) * 2 * range;
        m.t = 6;
      }
    } else {
      m.st = 'wander';
      m.gx = m.x + (sim.random() - 0.5) * 2 * range;
      m.gz = m.z + (sim.random() - 0.5) * 2 * range;
      m.t = 6;
    }
  }
  if (m.st === 'wander') {
    const s = stepToward(sim, m, m.gx, m.gz, speed, dt, 0.3);
    if (s.kind !== 'moved') {
      m.st = 'idle';
      m.t = 1;
    }
  }
}

function snapjaw(sim: IslandSim, m: Mob, dt: number): void {
  const def = MONSTERS.snapjaw;
  if (m.st === 'windup') {
    m.t -= dt;
    if (m.t <= 0) {
      const p = alivePlayer(sim, m.target);
      sim.fx('bite', m.x, m.z);
      if (p && dist(p.x, p.z, m.x, m.z) <= def.reach + 0.5) sim.hurtPlayer(p, def.damage, m.x, m.z);
      m.st = 'recover';
      m.t = def.cooldown;
    }
    return;
  }
  if (m.st === 'recover') {
    m.t -= dt;
    if (m.t <= 0) m.st = 'idle';
    return;
  }
  const p = nearestPlayer(sim, m.x, m.z, def.aggroNight);
  if (p) {
    m.target = p.id;
    m.ry = Math.atan2(p.x - m.x, p.z - m.z);
    m.st = 'windup';
    m.t = def.windup;
  }
}

function mother(sim: IslandSim, m: Mob, dt: number): void {
  const def = MONSTERS.mother;
  if (sim.time >= m.nextSpawn && nearestPlayer(sim, m.x, m.z, def.aggroDay)) {
    m.nextSpawn = sim.time + 12;
    let puffers = 0;
    for (const o of sim.mobs.values())
      if (o.kind === 'puffer' && dist(o.x, o.z, m.x, m.z) < 25) puffers++;
    for (let k = 0; k < 2 && puffers + k < 5; k++) {
      const a = sim.random() * Math.PI * 2;
      spawnMob(sim, 'puffer', m.x + Math.sin(a) * 4, m.z + Math.cos(a) * 4, {
        roamer: true,
        enraged: true,
        emerge: true,
      });
    }
  }
  if (m.st === 'windup') {
    m.t -= dt;
    if (m.t <= 0) {
      sim.fx('slam', m.ax, m.az, undefined, undefined, MOTHER_SLAM_RADIUS);
      for (const id of sim.online) {
        const p = alivePlayer(sim, id);
        if (p && dist(p.x, p.z, m.ax, m.az) <= MOTHER_SLAM_RADIUS + 0.4)
          sim.hurtPlayer(p, def.damage, m.ax, m.az);
      }
      m.st = 'recover';
      m.t = def.cooldown;
    }
    return;
  }
  if (m.st === 'recover') {
    m.t -= dt;
    if (m.t <= 0) m.st = 'idle';
    return;
  }
  const p = nearestPlayer(sim, m.x, m.z, def.aggroDay);
  if (!p) return;
  m.target = p.id;
  m.ax = p.x;
  m.az = p.z;
  m.ry = Math.atan2(p.x - m.x, p.z - m.z);
  m.st = 'windup';
  m.t = def.windup;
  sim.fx('slamwarn', m.ax, m.az, undefined, undefined, MOTHER_SLAM_RADIUS);
}

function walker(sim: IslandSim, m: Mob, dt: number, night: boolean): void {
  const def = MONSTERS[m.kind];
  // Finish an attack in progress.
  if (m.st === 'windup') {
    m.t -= dt;
    if (m.t > 0) return;
    if (m.siege !== null) {
      const b = sim.buildings.get(m.siege);
      if (b)
        sim.damageBuilding(
          b,
          (def.damage * (m.kind === 'thornback' ? 1.5 : 1.2) * sim.rules.bloomBlockDamage) / 100,
        );
      m.siege = null;
    } else if (m.kind === 'puffer') {
      burst(sim, m);
      return;
    } else {
      const p = alivePlayer(sim, m.target);
      if (p && dist(p.x, p.z, m.x, m.z) <= def.reach + 0.7) {
        sim.hurtPlayer(p, def.damage * (m.enraged ? 1.2 : 1), m.x, m.z);
      } else {
        sim.fx('swing', m.x, m.z);
      }
    }
    m.st = 'recover';
    m.t = def.cooldown;
    return;
  }
  if (m.st === 'recover') {
    m.t -= dt;
    if (m.t > 0) return;
    m.st = 'idle';
  }

  // Pick or keep a target. A petal mask hides you from all but the enraged.
  // Fog hides you: they notice you closer (not on a Bloom night).
  const fog = sim.weather.kind === 'fog' && !m.enraged ? 0.6 : 1;
  const aggro = (night || m.enraged ? def.aggroNight : def.aggroDay) * (m.enraged ? 1.5 : 1) * fog;
  const sees = (p: SimPlayer) =>
    m.enraged || !sim.hidden(p) || dist(p.x, p.z, m.x, m.z) < STEALTH_RANGE;
  let target = alivePlayer(sim, m.target);
  if (target && (dist(target.x, target.z, m.x, m.z) > aggro * 1.6 || !sees(target))) target = null;
  if (!target) target = nearestPlayer(sim, m.x, m.z, aggro, sees);
  m.target = target?.id ?? null;

  // Fire: the taken keep out of the light (and back out of it).
  const fears = def.fearsFire && !m.enraged;
  if (fears && sim.litAt(m.x, m.z, -0.5)) {
    const l = sim.lights.find((li) => dist(li.x, li.z, m.x, m.z) < li.r);
    if (l) {
      const dx = m.x - l.x;
      const dz = m.z - l.z;
      const d = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
      m.st = 'flee';
      stepToward(sim, m, l.x + (dx / d) * (l.r + 3), l.z + (dz / d) * (l.r + 3), def.run, dt, 0.2);
      return;
    }
  }

  if (!target) {
    if (m.goal) {
      // A pack on the move: head for where it was going, then roam there.
      m.st = 'wander';
      const s = stepToward(sim, m, m.goal.x, m.goal.z, def.walk, dt, 0.3);
      if (s.kind !== 'moved' || dist(m.x, m.z, m.goal.x, m.goal.z) < 4) delete m.goal;
      return;
    }
    wander(sim, m, dt, def.walk, 10);
    return;
  }

  const d = dist(target.x, target.z, m.x, m.z);
  m.ry = Math.atan2(target.x - m.x, target.z - m.z);
  if (d <= def.reach + 0.4) {
    m.st = 'windup';
    m.t = def.windup;
    m.siege = null;
    return;
  }
  const speed = speedFor(
    night || m.enraged ? sim.rules.nightSpeed : sim.rules.daySpeed,
    def.walk,
    def.run,
  );
  const before = { x: m.x, z: m.z };
  m.st = 'chase';
  const s = stepToward(sim, m, target.x, target.z, speed, dt, def.reach * 0.8);
  if ((fears && sim.litAt(m.x, m.z, 0.3)) || sim.repelAt(m.x, m.z, def.radius + 0.3)) {
    // Stop at the edge of the light and stare.
    m.x = before.x;
    m.z = before.z;
    m.st = 'idle';
    return;
  }
  if (s.kind === 'wall') {
    m.siege = s.id;
    m.st = 'windup';
    m.t = def.windup;
  }
}

function burst(sim: IslandSim, m: Mob): void {
  sim.mobs.delete(m.id);
  sim.fx('burst', m.x, m.z, undefined, undefined, PUFFER_BURST.radius);
  for (const id of sim.online) {
    const p = alivePlayer(sim, id);
    if (!p || dist(p.x, p.z, m.x, m.z) > PUFFER_BURST.radius) continue;
    sim.hurtPlayer(p, MONSTERS.puffer.damage, m.x, m.z);
    sim.poison(p, PUFFER_BURST.poisonSeconds);
  }
}

function separate(sim: IslandSim): void {
  const list = [...sim.mobs.values()];
  for (let i = 0; i < list.length; i++) {
    const a = list[i] as Mob;
    if (MONSTERS[a.kind].rooted) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j] as Mob;
      const r = MONSTERS[a.kind].radius + MONSTERS[b.kind].radius;
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const push = (r - d) / 2;
      a.x += (dx / d) * push;
      a.z += (dz / d) * push;
      if (!MONSTERS[b.kind].rooted) {
        b.x -= (dx / d) * push;
        b.z -= (dz / d) * push;
      }
    }
  }
}

/** At dawn the night's roamers sink back into the soil. */
export function burrowAll(sim: IslandSim): void {
  if (sim.rescue.phase === 'calling') return;
  for (const m of sim.mobs.values()) {
    if (m.roamer && MONSTERS[m.kind].hostile && m.kind !== 'snapjaw' && m.kind !== 'mother') {
      m.st = 'burrow';
      m.t = 1.6;
    }
  }
}

function pickKind(r: number, table: [MonsterKind, number][]): MonsterKind {
  let acc = 0;
  for (const [k, p] of table) {
    acc += p;
    if (r < acc) return k;
  }
  return (table[0] as [MonsterKind, number])[0];
}

export function runDirector(sim: IslandSim): void {
  const info = sim.info();
  const players = [...sim.online]
    .map((id) => alivePlayer(sim, id))
    .filter((p): p is SimPlayer => !!p);

  // Despawn what nobody is near (never someone's animal).
  for (const m of [...sim.mobs.values()]) {
    if (m.tame) continue;
    let near = Infinity;
    for (const p of players) near = Math.min(near, dist(p.x, p.z, m.x, m.z));
    const limit = m.kind === 'mother' ? 95 : m.kind === 'snapjaw' ? 60 : DESPAWN;
    if (near > limit) {
      sim.mobs.delete(m.id);
      if (m.kind === 'snapjaw' && m.spot >= 0) sim.snapMob.delete(m.spot);
      if (m.kind === 'mother') sim.motherHp = m.hp;
    }
  }

  // Rooted Snapjaws wake when someone comes close.
  sim.island.snapjaws.forEach((s, i) => {
    if (sim.snapMob.has(i) || (sim.snapDeadUntil.get(i) ?? 0) > sim.time) return;
    if (!players.some((p) => dist(p.x, p.z, s.x, s.z) < 45)) return;
    const m = spawnMob(sim, 'snapjaw', s.x, s.z, { spot: i });
    sim.snapMob.set(i, m.id);
  });

  // The Mother Bloom.
  if (!sim.flags.has('mother_dead') && ![...sim.mobs.values()].some((m) => m.kind === 'mother')) {
    const spot = sim.island.mother;
    if (players.some((p) => dist(p.x, p.z, spot.x, spot.z) < 75)) {
      spawnMob(sim, 'mother', spot.x, spot.z, sim.motherHp ? { hp: sim.motherHp } : {});
    }
  }

  // Roamers around each player.
  const tower = sim.island.poiById['tower'];
  for (const p of players) {
    let hostileNear = 0;
    let crabsNear = 0;
    let animalsNear = 0;
    for (const m of sim.mobs.values()) {
      const d = dist(p.x, p.z, m.x, m.z);
      if (d > 50) continue;
      if (m.kind === 'crab') crabsNear++;
      else if (MONSTERS[m.kind].animal) {
        if (!m.tame) animalsNear++;
      } else if (m.roamer) hostileNear++;
    }
    const biome = biomeAt(sim.island, p.x, p.z);
    const rescueHere =
      sim.rescue.phase === 'calling' && tower && dist(p.x, p.z, tower.x, tower.z) < 70;
    let want = 0;
    let enraged = false;
    let table: [MonsterKind, number][] = [['husk', 1]];
    if (rescueHere) {
      want = 4 + 3 * players.length;
      enraged = true;
      table = [
        ['husk', 0.5],
        ['thornback', 0.3],
        ['puffer', 0.2],
      ];
    } else if (info.bloom) {
      want = Math.min(18, 8 + Math.floor(info.nightOf / 2));
      enraged = true;
      table = [
        ['husk', 0.5],
        ['puffer', 0.2],
        ['thornback', 0.3],
      ];
    } else if (info.night) {
      want = Math.min(12, 3 + Math.floor(info.nightOf * 0.8));
      table =
        info.nightOf >= 3
          ? [
              ['husk', 0.65],
              ['puffer', 0.22],
              ['thornback', 0.13],
            ]
          : [
              ['husk', 0.72],
              ['puffer', 0.28],
            ];
    } else if (biome === BIOME.jungle || biome === BIOME.bog || biome === BIOME.forest) {
      want = Math.min(3, 1 + Math.floor(info.day / 4));
      table =
        biome === BIOME.bog
          ? [
              ['husk', 0.7],
              ['puffer', 0.3],
            ]
          : [['husk', 1]];
    }
    // Bloom nights and the rescue always come, at least half size.
    const scale = monsterScale(sim.rules.monsters);
    want = Math.round(want * (enraged ? Math.max(0.5, scale) : scale));
    if (hostileNear < want) {
      // The spawn rate rule: below one a second, a chance each second.
      const rate = spawnsPerSecond(sim.rules.spawnRate);
      const base = (info.bloom && !rescueHere ? 2 : 1) * rate;
      const n = Math.min(
        want - hostileNear,
        Math.floor(base) + (sim.random() < base - Math.floor(base) ? 1 : 0),
      );
      for (let k = 0; k < n; k++) {
        const pos = spawnSpot(sim, p.x, p.z, enraged, info.night || enraged);
        if (!pos) break;
        const kind = pickKind(sim.random(), table);
        const m = spawnMob(sim, kind, pos.x, pos.z, {
          roamer: true,
          enraged,
          emerge: info.night || enraged,
        });
        // Night spawns come for the player they rose near.
        if (enraged || info.night) m.target = p.id;
      }
    }
    if (!info.night && crabsNear < 2 && biome === BIOME.beach) {
      const pos = spawnSpot(sim, p.x, p.z, false, false, BIOME.beach);
      if (pos) spawnMob(sim, 'crab', pos.x, pos.z, { roamer: true });
    }
    // Island animals by day, by what grows where.
    const herd = ANIMALS_BY_BIOME[biome];
    const wantAnimals = Math.round(2 * wildlifeScale(sim.rules.animals));
    if (herd && !info.night && animalsNear < wantAnimals && sim.random() < 0.25) {
      const pos = spawnSpot(sim, p.x, p.z, false, false, biome);
      if (pos) spawnMob(sim, pickKind(sim.random(), herd), pos.x, pos.z, { roamer: true });
    }
  }
}

/** Which island animals live where. */
const ANIMALS_BY_BIOME: Partial<Record<number, [MonsterKind, number][]>> = {
  [BIOME.meadow]: [
    ['fowl', 0.55],
    ['goat', 0.45],
  ],
  [BIOME.jungle]: [
    ['boar', 0.55],
    ['fowl', 0.45],
  ],
  [BIOME.forest]: [
    ['boar', 0.4],
    ['goat', 0.3],
    ['dog', 0.3],
  ],
  [BIOME.highland]: [
    ['goat', 0.8],
    ['dog', 0.2],
  ],
};

function spawnSpot(
  sim: IslandSim,
  px: number,
  pz: number,
  ignoreLight: boolean,
  close: boolean,
  biome?: number,
): { x: number; z: number } | null {
  for (let i = 0; i < 10; i++) {
    const a = sim.random() * Math.PI * 2;
    const r = close ? 22 + sim.random() * 14 : 28 + sim.random() * 14;
    const x = px + Math.sin(a) * r;
    const z = pz + Math.cos(a) * r;
    if (heightAt(sim.island, x, z) < 0.3) continue;
    if (biome !== undefined && biomeAt(sim.island, x, z) !== biome) continue;
    if (hitCollider(sim.island, x, z, 1)) continue;
    if (sim.blockingAt(x, z, 1)) continue;
    if (!ignoreLight && sim.litAt(x, z, 4)) continue;
    if (sim.repelAt(x, z, 3)) continue;
    let tooClose = false;
    for (const id of sim.online) {
      const p = sim.players.get(id);
      if (p?.alive && dist(p.x, p.z, x, z) < 18) tooClose = true;
    }
    if (tooClose) continue;
    return { x, z };
  }
  return null;
}
