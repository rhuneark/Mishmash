// What grows in a garden plot. Seeds come from suitcases (passengers' seed packets),
// supply pods, washed-up crates, berry bushes and the bunker's seed vault. A crop only
// grows while its plot is wet: water it from a watering can, or let the rain do it.

const DAY = 600;

export interface CropDef {
  id: string;
  name: string;
  /** The seed item that plants it. */
  seed: string;
  /** What a ripe crop gives, and how many (min..max). */
  out: string;
  yield: [number, number];
  /** Seeds that come back with the harvest (min..max). */
  seeds: [number, number];
  /** Seconds of watered growing from seed to ripe. */
  grow: number;
  /** Bushes stay after picking and ripen again from halfway. */
  regrows?: boolean;
}

export const CROPS: CropDef[] = [
  {
    id: 'corn',
    name: 'Corn',
    seed: 'seed_corn',
    out: 'corn',
    yield: [2, 4],
    seeds: [1, 2],
    grow: 1.2 * DAY,
  },
  {
    id: 'potato',
    name: 'Potatoes',
    seed: 'seed_potato',
    out: 'potato',
    yield: [3, 5],
    seeds: [1, 2],
    grow: DAY,
  },
  {
    id: 'tomato',
    name: 'Tomatoes',
    seed: 'seed_tomato',
    out: 'tomato',
    yield: [2, 4],
    seeds: [1, 2],
    grow: DAY,
  },
  {
    id: 'pumpkin',
    name: 'Pumpkins',
    seed: 'seed_pumpkin',
    out: 'pumpkin',
    yield: [1, 2],
    seeds: [1, 3],
    grow: 1.6 * DAY,
  },
  {
    id: 'berry',
    name: 'Berries',
    seed: 'seed_berry',
    out: 'berries',
    yield: [3, 5],
    seeds: [0, 1],
    grow: 0.8 * DAY,
    regrows: true,
  },
];

export const CROP_BY_ID: Record<string, CropDef> = Object.fromEntries(CROPS.map((c) => [c.id, c]));

/** The crop a seed item plants. */
export function cropForSeed(item: string): CropDef | undefined {
  return CROPS.find((c) => c.seed === item);
}

/** Seconds a watering (or a shower) keeps a plot wet. */
export const WET_SECONDS = 0.45 * DAY;

/** Growth 0..1 → 0 sprout, 1 growing, 2 nearly there, 3 ripe. */
export function cropStage(grow: number): number {
  return grow >= 1 ? 3 : grow >= 0.6 ? 2 : grow >= 0.25 ? 1 : 0;
}
