// Islands from parts: every new island is a seed plus a few components, so they
// differ a lot for little effort. The landmark layout turns (quarter turns) and
// mirrors, a climate repaints it and reshuffles its plants, and a terrain style
// changes the coast and hills. The classic parts give exactly the island the
// seed always gave (saves from before keep their island).

import { NODE } from './content/nodes';
import type { PoiDef } from './content/pois';

export type Climate = 'tropic' | 'autumn' | 'pines' | 'volcanic' | 'overgrown';
export type Terrain = 'classic' | 'rugged' | 'islets' | 'highlands' | 'wetlands';

export interface IslandParts {
  /** Quarter turns of the landmark layout, clockwise seen from above. */
  turn: 0 | 1 | 2 | 3;
  /** Mirrored east to west (before turning). */
  mirror: boolean;
  climate: Climate;
  terrain: Terrain;
  /** How it was generated (GEN): missing = 1, the islands from before the starter supplies. */
  gen?: number;
}

/**
 * The generator new islands get. 2: twigs, loose stones and bushes topped up around the crash
 * site (v1.25). Islands keep the one they were made with, so saved ones never change.
 */
export const GEN = 2;

export interface IslandSpec extends IslandParts {
  seed: number;
}

export const CLASSIC: IslandParts = {
  turn: 0,
  mirror: false,
  climate: 'tropic',
  terrain: 'classic',
};

export const CLIMATES: Climate[] = ['tropic', 'autumn', 'pines', 'volcanic', 'overgrown'];
export const TERRAINS: Terrain[] = ['classic', 'rugged', 'islets', 'highlands', 'wetlands'];

export const CLIMATE_NAMES: Record<Climate, string> = {
  tropic: 'Tropical',
  autumn: 'Autumn',
  pines: 'Misty pines',
  volcanic: 'Volcanic',
  overgrown: 'Overgrown',
};

export const TERRAIN_NAMES: Record<Terrain, string> = {
  classic: 'Rolling',
  rugged: 'Rugged coast',
  islets: 'Islets',
  highlands: 'Highlands',
  wetlands: 'Wetlands',
};

export function isClassic(p: IslandParts): boolean {
  return (
    p.turn === 0 &&
    !p.mirror &&
    p.climate === 'tropic' &&
    p.terrain === 'classic' &&
    (p.gen ?? 1) === 1
  );
}

/** Island parts from saved (untrusted) data; anything missing is classic. */
export function parseParts(raw: unknown): IslandParts {
  if (!raw || typeof raw !== 'object') return { ...CLASSIC };
  const o = raw as Record<string, unknown>;
  const turn = o['turn'];
  return {
    turn: turn === 1 || turn === 2 || turn === 3 ? turn : 0,
    mirror: o['mirror'] === true,
    climate: CLIMATES.includes(o['climate'] as Climate) ? (o['climate'] as Climate) : 'tropic',
    terrain: TERRAINS.includes(o['terrain'] as Terrain) ? (o['terrain'] as Terrain) : 'classic',
    ...(o['gen'] === GEN ? { gen: GEN } : {}),
  };
}

/** A new island: any layout, climate and terrain (or the ones asked for). */
export function randomParts(random: () => number, want: Partial<IslandParts> = {}): IslandParts {
  const pick = <T>(list: T[]): T => list[Math.floor(random() * list.length)] as T;
  return {
    turn: want.turn ?? pick([0, 1, 2, 3] as const),
    mirror: want.mirror ?? random() < 0.5,
    climate: want.climate ?? pick(CLIMATES),
    terrain: want.terrain ?? pick(TERRAINS),
    gen: GEN,
  };
}

/** A short code to share an island ("AU-R3M-48213"): climate, terrain, layout, seed. */
export function specCode(s: IslandSpec): string {
  const c = s.climate.slice(0, 2).toUpperCase();
  const t = s.terrain.slice(0, 1).toUpperCase();
  return `${c}-${t}${s.turn}${s.mirror ? 'M' : ''}-${s.seed}`;
}

export function parseSpecCode(code: string): IslandSpec | null {
  const m = /^([A-Z]{2})-([A-Z])([0-3])(M?)-(\d{1,10})$/.exec(code.trim().toUpperCase());
  if (!m) return null;
  const climate = CLIMATES.find((c) => c.slice(0, 2).toUpperCase() === m[1]);
  const terrain = TERRAINS.find((t) => t.slice(0, 1).toUpperCase() === m[2]);
  const seed = Number(m[5]);
  if (!climate || !terrain || !Number.isSafeInteger(seed) || seed > 0xffffffff) return null;
  return {
    seed,
    climate,
    terrain,
    turn: Number(m[3]) as 0 | 1 | 2 | 3,
    mirror: m[4] === 'M',
    gen: GEN,
  };
}

/** Tells generated islands apart: the map code, and the generator when it isn't the first. */
export function specKey(s: IslandSpec): string {
  return (s.gen ?? 1) > 1 ? `${specCode(s)}/${s.gen}` : specCode(s);
}

const FIRST: Record<Climate, string[]> = {
  tropic: ['Coral', 'Palm', 'Sunset', 'Lagoon', 'Mango', 'Gull'],
  autumn: ['Ember', 'Maple', 'Hollow', 'Harvest', 'Lantern', 'Rust'],
  pines: ['Fog', 'Pine', 'Grey', 'Hush', 'Raven', 'Cold'],
  volcanic: ['Ash', 'Cinder', 'Obsidian', 'Brimstone', 'Scorch', 'Basalt'],
  overgrown: ['Bloom', 'Thorn', 'Petal', 'Rot', 'Tendril', 'Spore'],
};
const SECOND = ['Isle', 'Key', 'Reach', 'Cay', 'Rock', 'Atoll', 'Haven', 'Point'];

/** A name for the island, the same for a spec everywhere. */
export function islandName(s: IslandSpec): string {
  const a = FIRST[s.climate];
  const h = (s.seed >>> 0) ^ (s.turn * 7919) ^ (s.mirror ? 104729 : 0);
  return `${a[h % a.length]} ${SECOND[Math.floor(h / 7) % SECOND.length]}`;
}

// ---------------------------------------------------------------------------
// Multiplayer codes: every island gets its own (kept in the save), and friends join the
// island with it whenever its owner has it open.

/** Letters and digits that can't be mixed up (no I, L, O, 0 or 1). */
export const JOIN_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const JOIN_LEN = 6;

export function newJoinCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < JOIN_LEN; i++) code += JOIN_CHARS[Math.floor(random() * JOIN_CHARS.length)];
  return code;
}

/** A typed or saved code as stored ("abc-2xy" → "ABC2XY"); null if it can't be one. */
export function cleanJoinCode(text: string): string | null {
  const code = text.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== JOIN_LEN) return null;
  for (const c of code) if (!JOIN_CHARS.includes(c)) return null;
  return code;
}

/** How a code is shown: "ABC-2XY". */
export function showJoinCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

// ---------------------------------------------------------------------------
// Layout: the landmarks (and the peak and the marsh) of the classic island, turned
// and mirrored. Quarter turns and mirrors map the 2 m height grid onto itself, so a
// turned island stays exact.

/** A spot of the classic layout on this island. */
export function place(p: IslandParts, x: number, z: number): { x: number; z: number } {
  let ax = p.mirror ? -x : x;
  let az = z;
  for (let k = 0; k < p.turn; k++) {
    const t = ax;
    ax = -az;
    az = t;
  }
  return { x: ax, z: az };
}

/** A spot on this island back in the classic layout. */
export function unplace(p: IslandParts, x: number, z: number): { x: number; z: number } {
  let ax = x;
  let az = z;
  for (let k = 0; k < p.turn; k++) {
    const t = az;
    az = -ax;
    ax = t;
  }
  return { x: p.mirror ? -ax : ax, z: az };
}

/** A box's angle (collider convention) after the layout change. */
function turnAngle(p: IslandParts, rot: number): number {
  return (p.mirror ? Math.PI - rot : rot) + (p.turn * Math.PI) / 2;
}

/** The landmarks as they stand on this island (same ids, spots and boxes). */
export function layoutPois(p: IslandParts, pois: PoiDef[]): PoiDef[] {
  if (p.turn === 0 && !p.mirror) return pois;
  return pois.map((poi) => {
    const at = place(p, poi.x, poi.z);
    return {
      ...poi,
      x: at.x,
      z: at.z,
      boxes: poi.boxes.map((b) => {
        const d = place(p, b.dx, b.dz);
        return { ...b, dx: d.x, dz: d.z, rot: turnAngle(p, b.rot) };
      }),
      spots: poi.spots.map((s) => {
        const d = place(p, s.dx, s.dz);
        return { ...s, dx: d.x, dz: d.z };
      }),
    };
  });
}

const DIRS: [string, number, number][] = [
  ['north', 0, -1],
  ['south', 0, 1],
  ['east', 1, 0],
  ['west', -1, 0],
];

function wordOf(dx: number, dz: number): string {
  const ns = dz < 0 ? 'north' : dz > 0 ? 'south' : '';
  const ew = dx > 0 ? 'east' : dx < 0 ? 'west' : '';
  return ns && ew ? `${ns}-${ew}` : ns || ew;
}

/**
 * Direction words in a text ("west", "north-east", "eastern"), turned and mirrored with
 * the layout, so the notes and the journal point the right way on every island.
 */
export function turnDirections(text: string, p: IslandParts): string {
  if (p.turn === 0 && !p.mirror) return text;
  return text.replace(
    /\b(North|north|South|south|East|east|West|west)(?:-(east|west))?(ern)?\b/g,
    (_m, a: string, b: string | undefined, ern: string | undefined) => {
      let dx = 0;
      let dz = 0;
      for (const w of [a.toLowerCase(), b]) {
        const d = DIRS.find(([n]) => n === w);
        if (d) {
          dx += d[1];
          dz += d[2];
        }
      }
      const to = place(p, dx, dz);
      let word = wordOf(Math.round(to.x), Math.round(to.z));
      if (ern) word += 'ern';
      return a[0] === a[0]?.toUpperCase() ? word[0]?.toUpperCase() + word.slice(1) : word;
    },
  );
}

// ---------------------------------------------------------------------------
// Climates: how generation shuffles the plants (colours live in the renderer).

export interface ClimateGen {
  /** Pine forest above this noise value (classic 0.63). */
  pine: number;
  /** Jungle above this moisture (classic 0.5). */
  moist: number;
  /** Highlands above this height-ish (classic 17). */
  highland: number;
  /** Scatter odds × this, per node type. */
  plants: Partial<Record<number, number>>;
  /** Rooted Snapjaws × this. */
  snapjaws: number;
}

export function climateGen(c: Climate): ClimateGen | null {
  switch (c) {
    case 'tropic':
      return null;
    case 'autumn':
      // Palms give way to broadleaf woods (the jungle trees, in autumn colours) and pines.
      return {
        pine: 0.56,
        moist: 0.46,
        highland: 17,
        plants: { [NODE.palm]: 0.15, [NODE.berry]: 1.6 },
        snapjaws: 1,
      };
    case 'pines':
      return {
        pine: 0.44,
        moist: 0.62,
        highland: 15,
        plants: { [NODE.palm]: 0.1, [NODE.jungle]: 0.6 },
        snapjaws: 0.7,
      };
    case 'volcanic':
      return {
        pine: 0.6,
        moist: 0.6,
        highland: 12,
        plants: {
          [NODE.palm]: 0.4,
          [NODE.jungle]: 0.5,
          [NODE.pine]: 0.6,
          [NODE.bush]: 0.6,
          [NODE.rock]: 2.2,
          [NODE.pebble]: 2,
          [NODE.branch]: 0.6,
        },
        snapjaws: 0.8,
      };
    case 'overgrown':
      return {
        pine: 0.7,
        moist: 0.38,
        highland: 19,
        plants: { [NODE.jungle]: 1.2, [NODE.mushroom]: 2, [NODE.vines]: 3 },
        snapjaws: 1.8,
      };
  }
}
