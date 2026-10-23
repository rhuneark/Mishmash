// Every item in the game. Add an item here (and a recipe in recipes.ts, or a
// drop in nodes.ts/monsters.ts) and it works everywhere: inventory, crafting,
// hotbar and the server's checks.

export type ToolKind = 'hand' | 'axe' | 'pick' | 'machete';

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  stack: number;
  /** Harvesting power against nodes of this tool kind (hand power is 10). */
  tool?: { kind: ToolKind; power: number };
  /** Melee stats when held. */
  weapon?: { damage: number; reach: number; cooldown: number; burn?: number };
  /** Uses before it breaks (items that `wear`: seconds while held). */
  durability?: number;
  /** Durability runs down every second it's held (torch, petal mask). */
  wears?: boolean;
  /** While held, roaming monsters only notice you up close (not on Bloom nights). */
  stealth?: boolean;
  food?: { food: number; water: number };
  heal?: { hp: number; seconds: number };
  /** Building it places (buildings.ts). */
  place?: string;
  /** Light radius while held. */
  light?: number;
  /** Thrown: area damage and burning. */
  throwable?: { damage: number; radius: number; range: number; burn: number };
  quest?: boolean;
}

const list: ItemDef[] = [
  // Materials
  {
    id: 'wood',
    name: 'Wood',
    icon: '🪵',
    stack: 50,
    desc: 'Chop trees with an axe, or pick up fallen branches.',
  },
  {
    id: 'stone',
    name: 'Stone',
    icon: '🪨',
    stack: 50,
    desc: 'Loose stones lie on beaches; mine rocks with a pickaxe.',
  },
  {
    id: 'fiber',
    name: 'Plant fiber',
    icon: '🌾',
    stack: 50,
    desc: 'Pulled from bushes. Twist it into rope.',
  },
  {
    id: 'rope',
    name: 'Rope',
    icon: '🪢',
    stack: 20,
    desc: 'Twisted fiber. Holds tools and builds together.',
  },
  {
    id: 'scrap',
    name: 'Scrap metal',
    icon: '🔩',
    stack: 30,
    desc: 'Torn from the wreckage. Better tools need it.',
  },
  {
    id: 'cloth',
    name: 'Cloth',
    icon: '🧵',
    stack: 20,
    desc: 'From luggage, or the clothes of the taken.',
  },
  {
    id: 'sap',
    name: 'Bloom sap',
    icon: '🧪',
    stack: 20,
    desc: 'Glowing sap from the Bloom. It burns hot.',
  },
  // Food and drink
  {
    id: 'berries',
    name: 'Berries',
    icon: '🫐',
    stack: 20,
    food: { food: 8, water: 3 },
    desc: 'Sweet and safe.',
  },
  {
    id: 'coconut',
    name: 'Coconut',
    icon: '🥥',
    stack: 10,
    food: { food: 6, water: 20 },
    desc: 'Food and water in one shell.',
  },
  {
    id: 'mushroom',
    name: 'Mushroom',
    icon: '🍄',
    stack: 20,
    food: { food: 4, water: 0 },
    desc: 'Better cooked on a skewer.',
  },
  {
    id: 'crab_raw',
    name: 'Raw crab',
    icon: '🦀',
    stack: 10,
    food: { food: 6, water: 0 },
    desc: 'Cook it over a campfire.',
  },
  {
    id: 'crab_cooked',
    name: 'Grilled crab',
    icon: '🍤',
    stack: 10,
    food: { food: 34, water: 0 },
    desc: 'A proper meal.',
  },
  {
    id: 'skewer',
    name: 'Mushroom skewer',
    icon: '🍢',
    stack: 10,
    food: { food: 24, water: 2 },
    desc: 'Roasted mushrooms.',
  },
  {
    id: 'ration',
    name: 'Flight ration',
    icon: '🍫',
    stack: 10,
    food: { food: 30, water: 8 },
    desc: 'Airline snack box.',
  },
  {
    id: 'water_bottle',
    name: 'Water bottle',
    icon: '💧',
    stack: 5,
    food: { food: 0, water: 40 },
    desc: 'Clean water.',
  },
  // Healing
  {
    id: 'bandage',
    name: 'Bandage',
    icon: '🩹',
    stack: 10,
    heal: { hp: 25, seconds: 4 },
    desc: 'Heals 25 over 4 seconds.',
  },
  {
    id: 'medkit',
    name: 'Bloom salve',
    icon: '💊',
    stack: 5,
    heal: { hp: 60, seconds: 3 },
    desc: 'Sap turned to medicine. Heals 60.',
  },
  // Tools and weapons
  {
    id: 'axe_stone',
    name: 'Stone axe',
    icon: '🪓',
    stack: 1,
    durability: 120,
    tool: { kind: 'axe', power: 25 },
    weapon: { damage: 10, reach: 2.1, cooldown: 0.7 },
    desc: 'Chops trees.',
  },
  {
    id: 'pick_stone',
    name: 'Stone pickaxe',
    icon: '⛏️',
    stack: 1,
    durability: 120,
    tool: { kind: 'pick', power: 25 },
    weapon: { damage: 9, reach: 2.1, cooldown: 0.7 },
    desc: 'Breaks rocks and scrap.',
  },
  {
    id: 'axe_scrap',
    name: 'Scrap axe',
    icon: '🪓',
    stack: 1,
    durability: 300,
    tool: { kind: 'axe', power: 50 },
    weapon: { damage: 17, reach: 2.2, cooldown: 0.65 },
    desc: 'Chops twice as fast.',
  },
  {
    id: 'pick_scrap',
    name: 'Scrap pickaxe',
    icon: '⛏️',
    stack: 1,
    durability: 300,
    tool: { kind: 'pick', power: 50 },
    weapon: { damage: 15, reach: 2.2, cooldown: 0.65 },
    desc: 'Mines twice as fast.',
  },
  {
    id: 'machete',
    name: 'Machete',
    icon: '🗡️',
    stack: 1,
    durability: 250,
    tool: { kind: 'machete', power: 40 },
    weapon: { damage: 26, reach: 2.3, cooldown: 0.55 },
    desc: 'Cuts through Bloom vines. Your best blade.',
  },
  {
    id: 'club',
    name: 'Wooden club',
    icon: '🏏',
    stack: 1,
    durability: 80,
    weapon: { damage: 14, reach: 2.0, cooldown: 0.7 },
    desc: 'Heavy and simple.',
  },
  {
    id: 'spear',
    name: 'Spear',
    icon: '🔱',
    stack: 1,
    durability: 100,
    weapon: { damage: 20, reach: 3.0, cooldown: 0.8 },
    desc: 'Keep them at a distance.',
  },
  {
    id: 'torch',
    name: 'Torch',
    icon: '🔦',
    stack: 5,
    durability: 240,
    wears: true,
    light: 8,
    weapon: { damage: 7, reach: 2.0, cooldown: 0.7, burn: 4 },
    desc: 'Lights the dark. The taken fear fire. Burns for 4 minutes in hand.',
  },
  {
    id: 'firebomb',
    name: 'Fire bomb',
    icon: '💣',
    stack: 5,
    throwable: { damage: 35, radius: 3.5, range: 12, burn: 6 },
    desc: 'Sap and cloth. Throw it at the Bloom and watch it burn.',
  },
  // Buildings
  {
    id: 'campfire',
    name: 'Campfire',
    icon: '🏕️',
    stack: 5,
    place: 'campfire',
    desc: 'Light, warmth and cooking. The taken keep away from it.',
  },
  {
    id: 'workbench',
    name: 'Workbench',
    icon: '🛠️',
    stack: 1,
    place: 'workbench',
    desc: 'Craft walls, metal tools and more nearby.',
  },
  {
    id: 'wall_wood',
    name: 'Wooden wall',
    icon: '🟫',
    stack: 20,
    place: 'wall_wood',
    desc: 'Keeps things out. For a while.',
  },
  {
    id: 'door_wood',
    name: 'Wooden door',
    icon: '🚪',
    stack: 10,
    place: 'door_wood',
    desc: 'A wall you can open.',
  },
  {
    id: 'wall_stone',
    name: 'Stone wall',
    icon: '🧱',
    stack: 20,
    place: 'wall_stone',
    desc: 'Much harder to break.',
  },
  {
    id: 'wall_half',
    name: 'Short wall',
    icon: '🟫',
    stack: 20,
    place: 'wall_half',
    desc: 'Half a wooden wall (1 m): fills the gaps.',
  },
  {
    id: 'wall_window',
    name: 'Window wall',
    icon: '🪟',
    stack: 20,
    place: 'wall_window',
    desc: 'A wooden wall with a window to keep watch through.',
  },
  {
    id: 'post_wood',
    name: 'Wooden post',
    icon: '🪵',
    stack: 20,
    place: 'post_wood',
    desc: 'A corner post: walls meet neatly on it.',
  },
  {
    id: 'gate_wood',
    name: 'Wooden gate',
    icon: '🚧',
    stack: 5,
    place: 'gate_wood',
    desc: 'A double-wide door (4 m) for a bigger camp.',
  },
  {
    id: 'wall_stone_half',
    name: 'Short stone wall',
    icon: '🧱',
    stack: 20,
    place: 'wall_stone_half',
    desc: 'Half a stone wall (1 m).',
  },
  {
    id: 'pillar_stone',
    name: 'Stone pillar',
    icon: '🗿',
    stack: 20,
    place: 'pillar_stone',
    desc: 'A heavy corner pillar.',
  },
  {
    id: 'spikes',
    name: 'Spike barricade',
    icon: '🪤',
    stack: 10,
    place: 'spikes',
    desc: 'Hurts whatever pushes against it.',
  },
  {
    id: 'torch_post',
    name: 'Torch post',
    icon: '🏮',
    stack: 10,
    place: 'torch_post',
    desc: 'A light that never goes out.',
  },
  {
    id: 'storage',
    name: 'Storage box',
    icon: '📦',
    stack: 5,
    place: 'storage',
    desc: 'Holds 12 stacks. Shared with your crew.',
  },
  {
    id: 'bedroll',
    name: 'Bedroll',
    icon: '🛏️',
    stack: 1,
    place: 'bedroll',
    desc: 'You wake up here after you fall.',
  },
  {
    id: 'rain_collector',
    name: 'Rain collector',
    icon: '🪣',
    stack: 5,
    place: 'rain_collector',
    desc: 'Fills with clean water over time.',
  },
  // Monster parts (drops) and what the Mashbench makes of them
  {
    id: 'bloom_tendril',
    name: 'Husk tendril',
    icon: '🌿',
    stack: 20,
    desc: 'Root threads pulled from a Husk. Tough as rope, and still twitching.',
  },
  {
    id: 'snap_tooth',
    name: 'Snapjaw tooth',
    icon: '🦷',
    stack: 20,
    desc: 'A curved thorn-tooth from a Snapjaw. Sharper than steel.',
  },
  {
    id: 'spore_sac',
    name: 'Spore sac',
    icon: '🫧',
    stack: 10,
    desc: "A Puffer's spore bag, taken before it could burst. Handle gently.",
  },
  {
    id: 'thorn_plate',
    name: 'Thorn plate',
    icon: '🛡️',
    stack: 10,
    desc: "A slab of a Thornback's armoured hide, bristling with spines.",
  },
  {
    id: 'bloom_heart',
    name: 'Heart of the Bloom',
    icon: '💗',
    stack: 1,
    desc: "The Mother Bloom's heart. It still beats. A Mashbench can make it into a lantern the Bloom won't come near.",
  },
  {
    id: 'mashbench',
    name: 'Mashbench',
    icon: '⚗️',
    stack: 1,
    place: 'mashbench',
    desc: 'Salvage and Bloom parts mashed together. Turns monster parts into special gear.',
  },
  {
    id: 'jawblade',
    name: 'Jawblade',
    icon: '🗡️',
    stack: 1,
    durability: 320,
    tool: { kind: 'machete', power: 45 },
    weapon: { damage: 34, reach: 2.4, cooldown: 0.55 },
    desc: 'Snapjaw teeth set in scrap. Fast, vicious, and it cuts Bloom vines too.',
  },
  {
    id: 'thornmaul',
    name: 'Thornmaul',
    icon: '🔨',
    stack: 1,
    durability: 260,
    weapon: { damage: 46, reach: 2.3, cooldown: 0.95 },
    desc: 'Thornback plates on a heavy handle. Slow, and it hits like a falling tree.',
  },
  {
    id: 'spore_bomb',
    name: 'Spore bomb',
    icon: '🦠',
    stack: 5,
    throwable: { damage: 14, radius: 4.5, range: 12, burn: 9 },
    desc: 'Their own spores, turned on them: a wide cloud that rots the Bloom from inside.',
  },
  {
    id: 'petal_mask',
    name: 'Petal mask',
    icon: '🎭',
    stack: 1,
    durability: 300,
    wears: true,
    stealth: true,
    desc: "Wear the Bloom's smell. Hold it and roaming monsters only notice you up close. Useless on Bloom nights. Wilts in 5 minutes of wearing.",
  },
  {
    id: 'bloom_tonic',
    name: 'Bloom tonic',
    icon: '🧉',
    stack: 5,
    heal: { hp: 80, seconds: 4 },
    desc: 'Spores boiled clean. Heals 80 and clears poison.',
  },
  {
    id: 'thorn_wall',
    name: 'Thorn wall',
    icon: '🌵',
    stack: 10,
    place: 'thorn_wall',
    desc: 'A wall of Thornback plates. Very hard to break, and it cuts whatever pushes on it.',
  },
  {
    id: 'snap_trap',
    name: 'Snap trap',
    icon: '🪤',
    stack: 5,
    place: 'snap_trap',
    desc: 'Snapjaw teeth on a spring. Bites the first monster to step on it and holds it in place. Re-arms itself.',
  },
  {
    id: 'heart_lantern',
    name: 'Heart lantern',
    icon: '🏮',
    stack: 1,
    place: 'heart_lantern',
    desc: "The Mother's heart in a cage. No Bloom will step into its light, not even on a Bloom night.",
  },
  // Escape
  {
    id: 'battery',
    name: 'Aircraft battery',
    icon: '🔋',
    stack: 1,
    quest: true,
    desc: 'From the cargo hold. Still has charge.',
  },
  {
    id: 'antenna',
    name: 'Antenna',
    icon: '📡',
    stack: 1,
    quest: true,
    desc: 'From the radio tower on the peak.',
  },
  {
    id: 'transmitter',
    name: 'Transmitter board',
    icon: '📟',
    stack: 1,
    quest: true,
    desc: 'From the research station.',
  },
  {
    id: 'radio',
    name: 'Emergency radio',
    icon: '📻',
    stack: 1,
    quest: true,
    desc: 'Take it to the beacon on the peak and call for rescue.',
  },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((d) => [d.id, d]));
export const ITEM_IDS = list.map((d) => d.id);

export function item(id: string): ItemDef | undefined {
  return ITEMS[id];
}

/** Harvest power of whatever is held against a node needing `kind`. */
export function powerFor(held: ItemDef | undefined, kind: ToolKind): number {
  if (kind === 'hand') return held?.tool && held.tool.kind !== 'hand' ? 15 : 10;
  if (held?.tool?.kind === kind) return held.tool.power;
  return 0;
}
