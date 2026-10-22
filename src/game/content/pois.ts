// Landmarks and the escape chain. Coordinates: x east, z south (north is -z),
// metres from the island centre. Offsets in `boxes`/`spots` are relative.

export type SpotKind =
  | 'note' // a lore note (goes to the journal)
  | 'tag' // a torn luggage tag with one digit of the cargo code
  | 'loot' // a one-time cache
  | 'lock' // the cargo container's 4-digit lock (holds the battery)
  | 'antenna' // up the radio tower, behind the vines
  | 'beacon' // where the emergency radio is used
  | 'heli'; // the rescue helicopter (only once it lands)

export interface Spot {
  id: string;
  kind: SpotKind;
  dx: number;
  dz: number;
  /** Note id (notes.ts) for note/tag spots. */
  note?: string;
  loot?: { item: string; n: number }[];
  /** Tag spots: which code digit (0-3). */
  digit?: number;
}

export interface Box {
  dx: number;
  dz: number;
  w: number;
  d: number;
  /** Radians around y. */
  rot: number;
  h: number;
}

export interface PoiDef {
  id: string;
  name: string;
  x: number;
  z: number;
  /** Terrain is flattened within this radius. */
  flat: number;
  boxes: Box[];
  spots: Spot[];
  /** Shown on the map once discovered (or revealed by a note). */
  icon: string;
}

export const POIS: PoiDef[] = [
  {
    id: 'crash',
    name: 'Crash site',
    x: 0,
    z: 250,
    flat: 26,
    icon: '✈️',
    boxes: [
      { dx: 0, dz: 0, w: 14, d: 4.4, rot: 0.12, h: 4 },
      { dx: 9, dz: -7, w: 8, d: 1.6, rot: -0.5, h: 1.2 },
      { dx: -10, dz: 6, w: 3, d: 2.5, rot: 0.8, h: 2 },
    ],
    spots: [
      { id: 'crash_note', kind: 'note', dx: -3, dz: 4.5, note: 'boarding' },
      { id: 'tag_0', kind: 'tag', dx: 13, dz: 9, note: 'tag', digit: 0 },
      { id: 'tag_1', kind: 'tag', dx: -16, dz: -9, note: 'tag', digit: 1 },
      { id: 'tag_2', kind: 'tag', dx: 21, dz: -13, note: 'tag', digit: 2 },
      { id: 'tag_3', kind: 'tag', dx: -11, dz: 17, note: 'tag', digit: 3 },
    ],
  },
  {
    id: 'cockpit',
    name: 'Cockpit',
    x: -70,
    z: 150,
    flat: 12,
    icon: '🛩️',
    boxes: [{ dx: 0, dz: 0, w: 5.5, d: 3.4, rot: -0.4, h: 3 }],
    spots: [
      { id: 'cockpit_log', kind: 'note', dx: 2.5, dz: 2.6, note: 'captain' },
      { id: 'cockpit_transcript', kind: 'note', dx: 0, dz: -3.5, note: 'transcript' },
      {
        id: 'cockpit_kit',
        kind: 'loot',
        dx: -2.8,
        dz: 2.2,
        loot: [
          { item: 'bandage', n: 2 },
          { item: 'torch', n: 2 },
          { item: 'water_bottle', n: 1 },
        ],
      },
    ],
  },
  {
    id: 'tail',
    name: 'Tail section',
    x: -250,
    z: -10,
    flat: 16,
    icon: '🧳',
    boxes: [
      { dx: -3, dz: 0, w: 8, d: 3.6, rot: 0.3, h: 5 },
      { dx: 5, dz: 2, w: 6, d: 2.6, rot: 0.3, h: 2.6 },
    ],
    spots: [
      {
        id: 'cargo_lock',
        kind: 'lock',
        dx: 5.6,
        dz: 4,
        loot: [
          { item: 'battery', n: 1 },
          { item: 'rope', n: 2 },
          { item: 'ration', n: 2 },
          { item: 'cloth', n: 2 },
        ],
      },
      { id: 'tail_manifest', kind: 'note', dx: -3, dz: 3.5, note: 'manifest' },
      { id: 'tail_diary', kind: 'note', dx: -8, dz: 4.5, note: 'diary31a' },
    ],
  },
  {
    id: 'tower',
    name: 'Radio tower',
    x: 150,
    z: -175,
    flat: 18,
    icon: '📡',
    boxes: [
      { dx: 0, dz: 0, w: 3, d: 3, rot: 0, h: 18 },
      { dx: 6, dz: 3, w: 4, d: 3, rot: 0, h: 2.8 },
    ],
    spots: [
      { id: 'tower_antenna', kind: 'antenna', dx: 0, dz: 2.4 },
      { id: 'tower_memo', kind: 'note', dx: 6, dz: 5, note: 'memo' },
      { id: 'tower_log', kind: 'note', dx: -4, dz: -3.5, note: 'relaylog' },
      { id: 'tower_beacon', kind: 'beacon', dx: 3.8, dz: 3.2 },
      { id: 'tower_heli', kind: 'heli', dx: 14, dz: -12 },
    ],
  },
  {
    id: 'station',
    name: 'Kessler Station',
    x: 215,
    z: 95,
    flat: 30,
    icon: '🔬',
    boxes: [
      { dx: -12, dz: -14, w: 10, d: 6, rot: 0, h: 4 },
      { dx: 12, dz: -14, w: 8, d: 6, rot: 0, h: 4 },
      { dx: 16, dz: 8, w: 4, d: 10, rot: 0, h: 3 },
    ],
    spots: [
      { id: 'station_journal', kind: 'note', dx: -12, dz: -10.4, note: 'kessler' },
      { id: 'station_memo', kind: 'note', dx: 12, dz: -10.4, note: 'specimen' },
      { id: 'station_brief', kind: 'note', dx: -6, dz: -10.5, note: 'briefing' },
      { id: 'station_order', kind: 'note', dx: -16, dz: -9.5, note: 'directive' },
    ],
  },
  {
    id: 'camp_nw',
    name: 'Old camp',
    x: -150,
    z: -190,
    flat: 10,
    icon: '⛺',
    boxes: [{ dx: 0, dz: -2, w: 3.4, d: 2.6, rot: 0.2, h: 2 }],
    spots: [
      { id: 'camp_nw_note', kind: 'note', dx: 2.5, dz: 1.5, note: 'castaway1' },
      {
        id: 'camp_nw_cache',
        kind: 'loot',
        dx: -2.5,
        dz: 1,
        loot: [
          { item: 'scrap', n: 4 },
          { item: 'rope', n: 2 },
          { item: 'firebomb', n: 1 },
        ],
      },
    ],
  },
  {
    id: 'camp_mid',
    name: 'Lookout camp',
    x: 40,
    z: -20,
    flat: 10,
    icon: '⛺',
    boxes: [{ dx: 0, dz: -2, w: 3.4, d: 2.6, rot: -0.3, h: 2 }],
    spots: [
      { id: 'camp_mid_note', kind: 'note', dx: 2.5, dz: 1.5, note: 'castaway2' },
      {
        id: 'camp_mid_cache',
        kind: 'loot',
        dx: -2.5,
        dz: 1,
        loot: [
          { item: 'cloth', n: 3 },
          { item: 'bandage', n: 2 },
          { item: 'scrap', n: 2 },
        ],
      },
    ],
  },
];

export const POI_BY_ID: Record<string, PoiDef> = Object.fromEntries(POIS.map((p) => [p.id, p]));

/** Where new survivors wake up (next to the fuselage). */
export const SPAWN = { x: 0, z: 258 };

/** The Mother Bloom grows in the station courtyard. */
export const MOTHER_SPOT = { x: 215, z: 95 };

/** Vines grown over the tower base: all must be cut to reach the antenna. */
export const TOWER_VINES: { dx: number; dz: number }[] = [
  { dx: -2.6, dz: 2.6 },
  { dx: 0, dz: 3.6 },
  { dx: 2.6, dz: 2.6 },
  { dx: -3.4, dz: 0 },
  { dx: 3.4, dz: 0 },
];

/** Seconds from calling for help until the helicopter lands. */
export const RESCUE_SECONDS = 180;
