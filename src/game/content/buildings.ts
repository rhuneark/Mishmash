// Things players place. Footprints are in metres along the building's own
// axes (w along x, d along z before rotation).

export interface BuildingDef {
  id: string;
  name: string;
  hp: number;
  w: number;
  d: number;
  /** Blocks movement (players and monsters). */
  blocks: boolean;
  /** Light radius (campfire only while it has fuel). */
  light?: number;
  /** Crafting station it provides. */
  station?: 'fire' | 'bench' | 'mash';
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
}

const list: BuildingDef[] = [
  {
    id: 'campfire',
    name: 'Campfire',
    hp: 150,
    w: 1.4,
    d: 1.4,
    blocks: true,
    light: 9,
    station: 'fire',
  },
  { id: 'workbench', name: 'Workbench', hp: 200, w: 1.8, d: 1.0, blocks: true, station: 'bench' },
  { id: 'wall_wood', name: 'Wooden wall', hp: 300, w: 2.0, d: 0.35, blocks: true, shape: 'edge' },
  {
    id: 'door_wood',
    name: 'Wooden door',
    hp: 250,
    w: 2.0,
    d: 0.35,
    blocks: true,
    opens: true,
    shape: 'edge',
  },
  { id: 'wall_stone', name: 'Stone wall', hp: 750, w: 2.0, d: 0.45, blocks: true, shape: 'edge' },
  {
    id: 'spikes',
    name: 'Spike barricade',
    hp: 200,
    w: 2.0,
    d: 0.8,
    blocks: true,
    thorns: 10,
    shape: 'edge',
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
  },
  { id: 'storage', name: 'Storage box', hp: 150, w: 1.0, d: 0.8, blocks: true },
  { id: 'bedroll', name: 'Bedroll', hp: 60, w: 1.0, d: 2.0, blocks: false },
  { id: 'rain_collector', name: 'Rain collector', hp: 120, w: 1.2, d: 1.2, blocks: true },
  { id: 'mashbench', name: 'Mashbench', hp: 220, w: 1.8, d: 1.1, blocks: true, station: 'mash' },
  {
    id: 'thorn_wall',
    name: 'Thorn wall',
    hp: 650,
    w: 2.0,
    d: 0.55,
    blocks: true,
    thorns: 16,
    shape: 'edge',
  },
  {
    id: 'snap_trap',
    name: 'Snap trap',
    hp: 90,
    w: 1.0,
    d: 1.0,
    blocks: false,
    trap: { damage: 45, stun: 3, rearm: 15 },
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
  },
  // Building shapes: short walls, windows, posts and a wide gate.
  { id: 'wall_half', name: 'Short wall', hp: 160, w: 1.0, d: 0.35, blocks: true, shape: 'edge' },
  { id: 'wall_window', name: 'Window wall', hp: 260, w: 2.0, d: 0.35, blocks: true, shape: 'edge' },
  { id: 'post_wood', name: 'Wooden post', hp: 200, w: 0.5, d: 0.5, blocks: true, shape: 'corner' },
  {
    id: 'gate_wood',
    name: 'Wooden gate',
    hp: 450,
    w: 4.0,
    d: 0.4,
    blocks: true,
    opens: true,
    shape: 'edge',
  },
  {
    id: 'wall_stone_half',
    name: 'Short stone wall',
    hp: 380,
    w: 1.0,
    d: 0.45,
    blocks: true,
    shape: 'edge',
  },
  {
    id: 'pillar_stone',
    name: 'Stone pillar',
    hp: 450,
    w: 0.6,
    d: 0.6,
    blocks: true,
    shape: 'corner',
  },
];

export const BUILDINGS: Record<string, BuildingDef> = Object.fromEntries(
  list.map((b) => [b.id, b]),
);

export const CAMPFIRE_FUEL_MAX = 900;
export const CAMPFIRE_FUEL_START = 300;
export const CAMPFIRE_FUEL_PER_WOOD = 120;
export const STORAGE_SLOTS = 12;
export const RAIN_MAX = 5;
export const RAIN_EVERY = 90;
export const STATION_RANGE = 4;
