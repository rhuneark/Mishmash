// Crafting recipes. `station`: 'hand' anywhere, 'fire' near a lit campfire,
// 'bench' near a workbench.

export type Station = 'hand' | 'fire' | 'bench';

export interface Recipe {
  id: string;
  out: string;
  n: number;
  station: Station;
  needs: Record<string, number>;
}

const list: Recipe[] = [
  // By hand
  { id: 'rope', out: 'rope', n: 1, station: 'hand', needs: { fiber: 3 } },
  {
    id: 'axe_stone',
    out: 'axe_stone',
    n: 1,
    station: 'hand',
    needs: { wood: 3, stone: 2, fiber: 2 },
  },
  {
    id: 'pick_stone',
    out: 'pick_stone',
    n: 1,
    station: 'hand',
    needs: { wood: 3, stone: 3, fiber: 2 },
  },
  { id: 'club', out: 'club', n: 1, station: 'hand', needs: { wood: 4 } },
  { id: 'spear', out: 'spear', n: 1, station: 'hand', needs: { wood: 3, stone: 1, fiber: 2 } },
  { id: 'torch', out: 'torch', n: 1, station: 'hand', needs: { wood: 1, fiber: 2 } },
  { id: 'bandage', out: 'bandage', n: 1, station: 'hand', needs: { cloth: 1, fiber: 2 } },
  { id: 'campfire', out: 'campfire', n: 1, station: 'hand', needs: { wood: 5, stone: 4 } },
  { id: 'bedroll', out: 'bedroll', n: 1, station: 'hand', needs: { fiber: 8, cloth: 2 } },
  {
    id: 'workbench',
    out: 'workbench',
    n: 1,
    station: 'hand',
    needs: { wood: 10, stone: 4, rope: 2 },
  },
  // At a campfire
  { id: 'crab_cooked', out: 'crab_cooked', n: 1, station: 'fire', needs: { crab_raw: 1 } },
  { id: 'skewer', out: 'skewer', n: 1, station: 'fire', needs: { mushroom: 2, wood: 1 } },
  // At a workbench
  { id: 'wall_wood', out: 'wall_wood', n: 1, station: 'bench', needs: { wood: 6 } },
  { id: 'door_wood', out: 'door_wood', n: 1, station: 'bench', needs: { wood: 6, scrap: 1 } },
  { id: 'wall_stone', out: 'wall_stone', n: 1, station: 'bench', needs: { stone: 10, wood: 2 } },
  { id: 'spikes', out: 'spikes', n: 1, station: 'bench', needs: { wood: 5, stone: 2 } },
  {
    id: 'torch_post',
    out: 'torch_post',
    n: 1,
    station: 'bench',
    needs: { wood: 3, fiber: 2, sap: 1 },
  },
  { id: 'storage', out: 'storage', n: 1, station: 'bench', needs: { wood: 8, rope: 1 } },
  {
    id: 'rain_collector',
    out: 'rain_collector',
    n: 1,
    station: 'bench',
    needs: { wood: 6, cloth: 2, rope: 1 },
  },
  {
    id: 'axe_scrap',
    out: 'axe_scrap',
    n: 1,
    station: 'bench',
    needs: { scrap: 3, wood: 2, rope: 1 },
  },
  {
    id: 'pick_scrap',
    out: 'pick_scrap',
    n: 1,
    station: 'bench',
    needs: { scrap: 3, wood: 2, rope: 1 },
  },
  {
    id: 'machete',
    out: 'machete',
    n: 1,
    station: 'bench',
    needs: { scrap: 4, wood: 1, rope: 1, cloth: 1 },
  },
  { id: 'firebomb', out: 'firebomb', n: 2, station: 'bench', needs: { sap: 2, cloth: 1 } },
  { id: 'medkit', out: 'medkit', n: 1, station: 'bench', needs: { bandage: 1, sap: 2 } },
  {
    id: 'radio',
    out: 'radio',
    n: 1,
    station: 'bench',
    needs: { battery: 1, antenna: 1, transmitter: 1, scrap: 4, rope: 2 },
  },
];

export const RECIPES: Record<string, Recipe> = Object.fromEntries(list.map((r) => [r.id, r]));
export const RECIPE_LIST = list;

export const STATION_NAMES: Record<Station, string> = {
  hand: 'By hand',
  fire: 'Campfire',
  bench: 'Workbench',
};
