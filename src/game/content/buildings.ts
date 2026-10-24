// Things players place. Footprints are in metres along the building's own
// axes (w along x, d along z before rotation).

/** Build menu tabs. */
export type BuildCat = 'camp' | 'walls' | 'floors' | 'furniture' | 'farm' | 'defense';

export const BUILD_CATS: { id: BuildCat; icon: string; name: string }[] = [
  { id: 'camp', icon: '🏕️', name: 'Camp' },
  { id: 'walls', icon: '🧱', name: 'Walls' },
  { id: 'floors', icon: '🏠', name: 'Floors & roofs' },
  { id: 'furniture', icon: '🪑', name: 'Furniture' },
  { id: 'farm', icon: '🌱', name: 'Farm & kitchen' },
  { id: 'defense', icon: '🛡️', name: 'Defense' },
];

export interface BuildingDef {
  id: string;
  name: string;
  hp: number;
  w: number;
  d: number;
  /** Blocks movement (players and monsters). */
  blocks: boolean;
  /** What putting it down takes from your bag (build mode; nothing is crafted first). */
  cost: Record<string, number>;
  /** Build menu tab. */
  cat: BuildCat;
  /** Light radius (campfire only while it has fuel). */
  light?: number;
  /** Crafting station it provides. */
  station?: 'fire' | 'bench' | 'mash' | 'pot';
  /** Damage per second to monsters touching it. */
  thorns?: number;
  /** Bites the first monster that steps on it, holds it, then re-arms. */
  trap?: { damage: number; stun: number; rearm: number };
  /** No monster, even an enraged one, steps into its light. */
  repels?: boolean;
  /** Opens and closes (doors and gates; open ones don't block). */
  opens?: boolean;
  /**
   * How it sits on the build grid: `edge` pieces (walls, doors) run along grid lines, `corner`
   * pieces (posts) sit on grid points, the rest fill cells. Edge and corner pieces may meet
   * at corners and joints.
   */
  shape?: 'edge' | 'corner';
  /** Floors lie under other pieces, rugs on floors, roofs over everything; each only meets its
   * own layer. */
  layer?: 'floor' | 'rug' | 'roof';
  /** Storage slots (boxes, shelves, chests). */
  slots?: number;
  /** You wake up here after you fall (bedroll, bed). */
  spawn?: boolean;
  /** One line for the build menu. */
  desc: string;
}

/** Wall pieces are this tall; roofs sit on top. */
export const WALL_HEIGHT = 2.6;

const list: BuildingDef[] = [
  // Camp
  {
    id: 'campfire',
    name: 'Campfire',
    hp: 150,
    w: 1.4,
    d: 1.4,
    blocks: true,
    light: 9,
    station: 'fire',
    cat: 'camp',
    cost: { wood: 5, stone: 4 },
    desc: 'Light, warmth and cooking. The taken keep away from it.',
  },
  {
    id: 'workbench',
    name: 'Workbench',
    hp: 200,
    w: 1.8,
    d: 1.0,
    blocks: true,
    station: 'bench',
    cat: 'camp',
    cost: { wood: 10, stone: 4, rope: 2 },
    desc: 'Metal tools, weapons and more are made here.',
  },
  {
    id: 'bedroll',
    name: 'Bedroll',
    hp: 60,
    w: 1.0,
    d: 2.0,
    blocks: false,
    spawn: true,
    cat: 'camp',
    cost: { fiber: 8, cloth: 2 },
    desc: 'You wake up here after you fall.',
  },
  {
    id: 'storage',
    name: 'Storage box',
    hp: 150,
    w: 1.0,
    d: 0.8,
    blocks: true,
    slots: 12,
    cat: 'camp',
    cost: { wood: 8, rope: 1 },
    desc: 'Holds 12 stacks. Shared with your crew.',
  },
  {
    id: 'rain_collector',
    name: 'Rain collector',
    hp: 120,
    w: 1.2,
    d: 1.2,
    blocks: true,
    cat: 'camp',
    cost: { wood: 6, cloth: 2, rope: 1 },
    desc: 'Fills with clean water over time (fast in the rain).',
  },
  {
    id: 'torch_post',
    name: 'Torch post',
    hp: 80,
    w: 0.4,
    d: 0.4,
    blocks: true,
    light: 7,
    shape: 'corner',
    cat: 'camp',
    cost: { wood: 3, fiber: 2, sap: 1 },
    desc: 'A light that never goes out.',
  },
  {
    id: 'mashbench',
    name: 'Mashbench',
    hp: 220,
    w: 1.8,
    d: 1.1,
    blocks: true,
    station: 'mash',
    cat: 'camp',
    cost: { wood: 10, scrap: 4, bloom_tendril: 3, snap_tooth: 2 },
    desc: 'Turns monster parts into special gear.',
  },
  // Walls
  {
    id: 'wall_wood',
    name: 'Wooden wall',
    hp: 300,
    w: 2.0,
    d: 0.35,
    blocks: true,
    shape: 'edge',
    cat: 'walls',
    cost: { wood: 6 },
    desc: 'Keeps things out. For a while.',
  },
  {
    id: 'wall_half',
    name: 'Short wall',
    hp: 160,
    w: 1.0,
    d: 0.35,
    blocks: true,
    shape: 'edge',
    cat: 'walls',
    cost: { wood: 3 },
    desc: 'Half a wooden wall (1 m): fills the gaps.',
  },
  {
    id: 'wall_window',
    name: 'Window wall',
    hp: 260,
    w: 2.0,
    d: 0.35,
    blocks: true,
    shape: 'edge',
    cat: 'walls',
    cost: { wood: 6, scrap: 1 },
    desc: 'A wooden wall with a window to keep watch through.',
  },
  {
    id: 'door_wood',
    name: 'Wooden door',
    hp: 250,
    w: 2.0,
    d: 0.35,
    blocks: true,
    opens: true,
    shape: 'edge',
    cat: 'walls',
    cost: { wood: 6, scrap: 1 },
    desc: 'A wall you can open.',
  },
  {
    id: 'gate_wood',
    name: 'Wooden gate',
    hp: 450,
    w: 4.0,
    d: 0.4,
    blocks: true,
    opens: true,
    shape: 'edge',
    cat: 'walls',
    cost: { wood: 12, rope: 2, scrap: 1 },
    desc: 'A double-wide door (4 m) for a bigger camp.',
  },
  {
    id: 'post_wood',
    name: 'Wooden post',
    hp: 200,
    w: 0.5,
    d: 0.5,
    blocks: true,
    shape: 'corner',
    cat: 'walls',
    cost: { wood: 2 },
    desc: 'A corner post: walls meet neatly on it.',
  },
  {
    id: 'wall_stone',
    name: 'Stone wall',
    hp: 750,
    w: 2.0,
    d: 0.45,
    blocks: true,
    shape: 'edge',
    cat: 'walls',
    cost: { stone: 10, wood: 2 },
    desc: 'Much harder to break.',
  },
  {
    id: 'wall_stone_half',
    name: 'Short stone wall',
    hp: 380,
    w: 1.0,
    d: 0.45,
    blocks: true,
    shape: 'edge',
    cat: 'walls',
    cost: { stone: 5, wood: 1 },
    desc: 'Half a stone wall (1 m).',
  },
  {
    id: 'pillar_stone',
    name: 'Stone pillar',
    hp: 450,
    w: 0.6,
    d: 0.6,
    blocks: true,
    shape: 'corner',
    cat: 'walls',
    cost: { stone: 6 },
    desc: 'A heavy corner pillar.',
  },
  {
    id: 'wall_scrap',
    name: 'Scrap wall',
    hp: 900,
    w: 2.0,
    d: 0.4,
    blocks: true,
    shape: 'edge',
    cat: 'walls',
    cost: { scrap: 5, wood: 2 },
    desc: 'Plane panels bolted to posts. The toughest wall there is.',
  },
  {
    id: 'fence_wood',
    name: 'Fence',
    hp: 140,
    w: 2.0,
    d: 0.3,
    blocks: true,
    shape: 'edge',
    cat: 'walls',
    cost: { wood: 3, fiber: 2 },
    desc: 'A low fence: pens animals in, lets you see over it.',
  },
  {
    id: 'fence_gate',
    name: 'Fence gate',
    hp: 140,
    w: 2.0,
    d: 0.3,
    blocks: true,
    opens: true,
    shape: 'edge',
    cat: 'walls',
    cost: { wood: 4, rope: 1 },
    desc: 'A gate in the fence.',
  },
  // Floors and roofs
  {
    id: 'floor_wood',
    name: 'Wooden floor',
    hp: 200,
    w: 2.0,
    d: 2.0,
    blocks: false,
    layer: 'floor',
    cat: 'floors',
    cost: { wood: 4 },
    desc: 'Planks to walk on. Nothing grows through a floor.',
  },
  {
    id: 'floor_stone',
    name: 'Stone floor',
    hp: 400,
    w: 2.0,
    d: 2.0,
    blocks: false,
    layer: 'floor',
    cat: 'floors',
    cost: { stone: 6 },
    desc: 'Flagstones: a proper courtyard.',
  },
  {
    id: 'rug',
    name: 'Rug',
    hp: 60,
    w: 2.0,
    d: 1.4,
    blocks: false,
    layer: 'rug',
    cat: 'floors',
    cost: { cloth: 3, fiber: 2 },
    desc: 'Makes a shelter feel like home.',
  },
  {
    id: 'roof_thatch',
    name: 'Thatch roof',
    hp: 120,
    w: 2.0,
    d: 2.0,
    blocks: false,
    layer: 'roof',
    cat: 'floors',
    cost: { fiber: 6, wood: 2 },
    desc: 'Keeps the rain off your fire, your crops and you.',
  },
  {
    id: 'roof_wood',
    name: 'Wooden roof',
    hp: 250,
    w: 2.0,
    d: 2.0,
    blocks: false,
    layer: 'roof',
    cat: 'floors',
    cost: { wood: 5 },
    desc: 'A plank roof. Keeps the rain off.',
  },
  // Furniture
  {
    id: 'table',
    name: 'Table',
    hp: 120,
    w: 1.6,
    d: 0.9,
    blocks: true,
    cat: 'furniture',
    cost: { wood: 6 },
    desc: 'Somewhere to eat like a civilised survivor.',
  },
  {
    id: 'chair',
    name: 'Chair',
    hp: 60,
    w: 0.6,
    d: 0.6,
    blocks: true,
    cat: 'furniture',
    cost: { wood: 3 },
    desc: 'Take a load off.',
  },
  {
    id: 'bed',
    name: 'Bed',
    hp: 160,
    w: 1.2,
    d: 2.2,
    blocks: true,
    spawn: true,
    cat: 'furniture',
    cost: { wood: 8, cloth: 4, fiber: 4 },
    desc: 'You wake up here after you fall, and you heal faster near it.',
  },
  {
    id: 'shelf',
    name: 'Shelf',
    hp: 120,
    w: 1.6,
    d: 0.5,
    blocks: true,
    slots: 8,
    cat: 'furniture',
    cost: { wood: 6 },
    desc: 'Holds 8 stacks against a wall.',
  },
  {
    id: 'chest_big',
    name: 'Big chest',
    hp: 260,
    w: 1.4,
    d: 0.9,
    blocks: true,
    slots: 24,
    cat: 'furniture',
    cost: { wood: 10, rope: 2, scrap: 2 },
    desc: 'Holds 24 stacks.',
  },
  {
    id: 'lamp',
    name: 'Sap lamp',
    hp: 80,
    w: 0.5,
    d: 0.5,
    blocks: true,
    light: 6,
    cat: 'furniture',
    cost: { scrap: 1, sap: 1, cloth: 1 },
    desc: 'Bloom sap burns slow and bright. A light for indoors.',
  },
  // Farm and kitchen
  {
    id: 'garden_plot',
    name: 'Garden plot',
    hp: 100,
    w: 2.0,
    d: 2.0,
    blocks: false,
    layer: 'floor',
    cat: 'farm',
    cost: { wood: 2, fiber: 4 },
    desc: 'Plant seeds here. Water them, or let the rain do it.',
  },
  {
    id: 'cooking_pot',
    name: 'Cooking pot',
    hp: 140,
    w: 0.9,
    d: 0.9,
    blocks: true,
    station: 'pot',
    cat: 'farm',
    cost: { scrap: 3, stone: 4, wood: 2 },
    desc: 'Stews and soups. Put it next to a lit campfire.',
  },
  // Defense
  {
    id: 'spikes',
    name: 'Spike barricade',
    hp: 200,
    w: 2.0,
    d: 0.8,
    blocks: true,
    thorns: 10,
    shape: 'edge',
    cat: 'defense',
    cost: { wood: 5, stone: 2 },
    desc: 'Hurts whatever pushes against it.',
  },
  {
    id: 'spike_pit',
    name: 'Spike pit',
    hp: 150,
    w: 2.0,
    d: 2.0,
    blocks: false,
    layer: 'floor',
    thorns: 14,
    cat: 'defense',
    cost: { wood: 4, stone: 3 },
    desc: 'Sharpened stakes in a shallow pit: hurts monsters that walk over it.',
  },
  {
    id: 'thorn_wall',
    name: 'Thorn wall',
    hp: 650,
    w: 2.0,
    d: 0.55,
    blocks: true,
    thorns: 16,
    shape: 'edge',
    cat: 'defense',
    cost: { thorn_plate: 2, wood: 6 },
    desc: 'Thornback plates: very hard to break, and it cuts.',
  },
  {
    id: 'snap_trap',
    name: 'Snap trap',
    hp: 90,
    w: 1.0,
    d: 1.0,
    blocks: false,
    trap: { damage: 45, stun: 3, rearm: 15 },
    cat: 'defense',
    cost: { snap_tooth: 2, scrap: 2, rope: 1 },
    desc: 'Bites the first monster to step on it and holds it.',
  },
  {
    id: 'heart_lantern',
    name: 'Heart lantern',
    hp: 400,
    w: 0.9,
    d: 0.9,
    blocks: true,
    light: 14,
    repels: true,
    cat: 'defense',
    cost: { bloom_heart: 1, scrap: 4, sap: 4 },
    desc: 'No Bloom steps into its light, not even on a Bloom night.',
  },
];

export const BUILDINGS: Record<string, BuildingDef> = Object.fromEntries(
  list.map((b) => [b.id, b]),
);

export const CAMPFIRE_FUEL_MAX = 900;
export const CAMPFIRE_FUEL_START = 300;
export const CAMPFIRE_FUEL_PER_WOOD = 120;
export const STORAGE_SLOTS = 12;

/** Storage slots a building has (0: not storage). */
export function slotsOf(kind: string): number {
  return BUILDINGS[kind]?.slots ?? 0;
}

/** What taking a piece down gives back: half of each material (a single part comes back). */
export function refundOf(kind: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(BUILDINGS[kind]?.cost ?? {})) {
    const back = n === 1 ? 1 : Math.floor(n / 2);
    if (back > 0) out[id] = back;
  }
  return out;
}
export const RAIN_MAX = 5;
export const RAIN_EVERY = 90;
export const STATION_RANGE = 4;
/** A cooking pot needs a lit campfire this close. */
export const POT_FIRE_RANGE = 3;
