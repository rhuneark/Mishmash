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
  station?: 'fire' | 'bench';
  /** Damage per second to monsters touching it. */
  thorns?: number;
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
  { id: 'wall_wood', name: 'Wooden wall', hp: 300, w: 2.0, d: 0.35, blocks: true },
  { id: 'door_wood', name: 'Wooden door', hp: 250, w: 2.0, d: 0.35, blocks: true },
  { id: 'wall_stone', name: 'Stone wall', hp: 750, w: 2.0, d: 0.45, blocks: true },
  { id: 'spikes', name: 'Spike barricade', hp: 200, w: 2.0, d: 0.8, blocks: true, thorns: 10 },
  { id: 'torch_post', name: 'Torch post', hp: 80, w: 0.4, d: 0.4, blocks: true, light: 7 },
  { id: 'storage', name: 'Storage box', hp: 150, w: 1.0, d: 0.8, blocks: true },
  { id: 'bedroll', name: 'Bedroll', hp: 60, w: 1.0, d: 2.0, blocks: false },
  { id: 'rain_collector', name: 'Rain collector', hp: 120, w: 1.2, d: 1.2, blocks: true },
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
