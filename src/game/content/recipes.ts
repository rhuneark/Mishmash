// Crafting recipes. `station`: 'hand' anywhere, 'fire' near a lit campfire,
// 'bench' near a workbench, 'mash' near a Mashbench (monster parts), 'pot' at a
// cooking pot next to a lit campfire. Buildings aren't crafted: build mode puts
// them down straight from materials (buildings.ts `cost`).

export type Station = 'hand' | 'fire' | 'bench' | 'mash' | 'pot';

export const STATIONS: Station[] = ['hand', 'fire', 'bench', 'mash', 'pot'];

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
  { id: 'rope_tendril', out: 'rope', n: 2, station: 'hand', needs: { bloom_tendril: 1 } },
  { id: 'cloth_hide', out: 'cloth', n: 2, station: 'hand', needs: { hide: 1 } },
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
  { id: 'seed_berry', out: 'seed_berry', n: 2, station: 'hand', needs: { berries: 4 } },
  {
    id: 'slingshot',
    out: 'slingshot',
    n: 1,
    station: 'hand',
    needs: { wood: 2, rope: 1, hide: 1 },
  },
  { id: 'arrow', out: 'arrow', n: 5, station: 'hand', needs: { wood: 1, stone: 1, feather: 2 } },
  {
    id: 'arrow_fiber',
    out: 'arrow',
    n: 2,
    station: 'hand',
    needs: { wood: 1, stone: 1, fiber: 2 },
  },
  { id: 'fire_arrow', out: 'fire_arrow', n: 3, station: 'hand', needs: { arrow: 3, sap: 1 } },
  // At a campfire
  { id: 'crab_cooked', out: 'crab_cooked', n: 1, station: 'fire', needs: { crab_raw: 1 } },
  { id: 'skewer', out: 'skewer', n: 1, station: 'fire', needs: { mushroom: 2, wood: 1 } },
  { id: 'meat_cooked', out: 'meat_cooked', n: 1, station: 'fire', needs: { meat_raw: 1 } },
  { id: 'corn_roast', out: 'corn_roast', n: 1, station: 'fire', needs: { corn: 1 } },
  { id: 'potato_baked', out: 'potato_baked', n: 1, station: 'fire', needs: { potato: 1 } },
  { id: 'egg_fried', out: 'egg_fried', n: 1, station: 'fire', needs: { egg: 1 } },
  // In a cooking pot by a lit campfire
  {
    id: 'veg_stew',
    out: 'veg_stew',
    n: 1,
    station: 'pot',
    needs: { potato: 1, corn: 1, tomato: 1 },
  },
  {
    id: 'meat_stew',
    out: 'meat_stew',
    n: 1,
    station: 'pot',
    needs: { meat_raw: 1, potato: 1, corn: 1 },
  },
  {
    id: 'pumpkin_soup',
    out: 'pumpkin_soup',
    n: 2,
    station: 'pot',
    needs: { pumpkin: 1, tomato: 1 },
  },
  {
    id: 'omelette',
    out: 'omelette',
    n: 1,
    station: 'pot',
    needs: { egg: 2, tomato: 1, mushroom: 1 },
  },
  {
    id: 'coconut_curry',
    out: 'coconut_curry',
    n: 1,
    station: 'pot',
    needs: { coconut: 1, meat_raw: 1, corn: 1 },
  },
  {
    id: 'watering_can',
    out: 'watering_can',
    n: 1,
    station: 'bench',
    needs: { scrap: 2, cloth: 1 },
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
  { id: 'shovel', out: 'shovel', n: 1, station: 'bench', needs: { scrap: 2, wood: 2, rope: 1 } },
  { id: 'bow', out: 'bow', n: 1, station: 'bench', needs: { wood: 4, rope: 2 } },
  {
    id: 'crossbow',
    out: 'crossbow',
    n: 1,
    station: 'bench',
    needs: { scrap: 4, wood: 3, rope: 2, hide: 1 },
  },
  { id: 'bolt', out: 'bolt', n: 4, station: 'bench', needs: { scrap: 1, wood: 1 } },
  { id: 'medkit', out: 'medkit', n: 1, station: 'bench', needs: { bandage: 1, sap: 2 } },
  // At a Mashbench: monster parts
  {
    id: 'jawblade',
    out: 'jawblade',
    n: 1,
    station: 'mash',
    needs: { snap_tooth: 4, scrap: 2, bloom_tendril: 2 },
  },
  {
    id: 'thornmaul',
    out: 'thornmaul',
    n: 1,
    station: 'mash',
    needs: { thorn_plate: 3, wood: 4, bloom_tendril: 2 },
  },
  { id: 'spore_bomb', out: 'spore_bomb', n: 2, station: 'mash', needs: { spore_sac: 2, cloth: 1 } },
  {
    id: 'petal_mask',
    out: 'petal_mask',
    n: 1,
    station: 'mash',
    needs: { bloom_tendril: 3, cloth: 2, sap: 2 },
  },
  {
    id: 'bloom_tonic',
    out: 'bloom_tonic',
    n: 1,
    station: 'mash',
    needs: { spore_sac: 1, sap: 2, bandage: 1 },
  },
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
  mash: 'Mashbench',
  pot: 'Cooking pot',
};
