// Survivor levels and the skill tree. Everything you do earns XP (the authority grants it:
// sim.ts `gainXp`); each level brings a skill point to spend on a perk. Four branches, three
// tiers each: a tier opens once you've put enough points into its branch. The authority
// applies the perks (`rankOf`), the client shows them (hud/Character.tsx).

export type BranchId = 'gather' | 'fight' | 'survive' | 'build';

export interface BranchDef {
  id: BranchId;
  name: string;
  /** Item picture used for the branch. */
  icon: string;
  blurb: string;
}

export const BRANCHES: BranchDef[] = [
  { id: 'gather', name: 'Gatherer', icon: 'axe_stone', blurb: 'Chop, mine and scavenge more.' },
  {
    id: 'fight',
    name: 'Fighter',
    icon: 'machete',
    blurb: 'Hit harder, shoot straighter, last longer.',
  },
  {
    id: 'survive',
    name: 'Survivor',
    icon: 'medkit',
    blurb: 'Hunger, thirst and wounds bother you less.',
  },
  {
    id: 'build',
    name: 'Homesteader',
    icon: 'watering_can',
    blurb: 'Build cheaper and stronger, farm and tame better.',
  },
];

export type PerkId =
  | 'lumberjack'
  | 'miner'
  | 'forager'
  | 'scavenger'
  | 'brawler'
  | 'marksman'
  | 'thick_skin'
  | 'executioner'
  | 'iron_stomach'
  | 'field_medic'
  | 'runner'
  | 'night_owl'
  | 'carpenter'
  | 'sturdy'
  | 'green_thumb'
  | 'tinkerer'
  | 'animal_friend';

export interface PerkDef {
  id: PerkId;
  name: string;
  branch: BranchId;
  /** 1, 2 or 3: tier 2 needs TIER_POINTS[1] points in the branch, tier 3 TIER_POINTS[2]. */
  tier: 1 | 2 | 3;
  max: number;
  /** Item picture. */
  icon: string;
  /** What it does at a rank (1..max). */
  text: (rank: number) => string;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** How strong each perk is per rank (the authority and the texts both read these). */
export const PERK_STEP = {
  lumberjack: 0.25,
  miner: 0.25,
  forager: 0.25,
  scavenger: 1,
  brawler: 0.1,
  marksman: 0.15,
  thick_skin: 0.08,
  executioner: 0.2,
  iron_stomach: 0.15,
  field_medic: 0.25,
  runner: 0.2,
  night_owl: 0.25,
  carpenter: 0.15,
  sturdy: 0.25,
  green_thumb: 0.2,
  tinkerer: 0.2,
  animal_friend: 1,
} as const satisfies Record<PerkId, number>;

export const PERKS: PerkDef[] = [
  // Gatherer
  {
    id: 'lumberjack',
    name: 'Lumberjack',
    branch: 'gather',
    tier: 1,
    max: 3,
    icon: 'axe_stone',
    text: (r) => `Axes chop ${pct(PERK_STEP.lumberjack * r)} faster.`,
  },
  {
    id: 'miner',
    name: 'Miner',
    branch: 'gather',
    tier: 1,
    max: 3,
    icon: 'pick_stone',
    text: (r) => `Pickaxes break rock and scrap ${pct(PERK_STEP.miner * r)} faster.`,
  },
  {
    id: 'forager',
    name: 'Forager',
    branch: 'gather',
    tier: 2,
    max: 2,
    icon: 'berries',
    text: (r) =>
      `${pct(PERK_STEP.forager * r)} chance of one more from bushes, branches and stones.`,
  },
  {
    id: 'scavenger',
    name: 'Scavenger',
    branch: 'gather',
    tier: 3,
    max: 1,
    icon: 'scrap',
    text: () => 'Suitcases and wreckage give one more find.',
  },
  // Fighter
  {
    id: 'brawler',
    name: 'Brawler',
    branch: 'fight',
    tier: 1,
    max: 3,
    icon: 'club',
    text: (r) => `Melee hits do ${pct(PERK_STEP.brawler * r)} more damage.`,
  },
  {
    id: 'marksman',
    name: 'Marksman',
    branch: 'fight',
    tier: 1,
    max: 3,
    icon: 'bow',
    text: (r) => `Arrows, bolts and stones do ${pct(PERK_STEP.marksman * r)} more damage.`,
  },
  {
    id: 'thick_skin',
    name: 'Thick skin',
    branch: 'fight',
    tier: 2,
    max: 3,
    icon: 'hide',
    text: (r) => `Take ${pct(PERK_STEP.thick_skin * r)} less damage from the Bloom.`,
  },
  {
    id: 'executioner',
    name: 'Executioner',
    branch: 'fight',
    tier: 3,
    max: 1,
    icon: 'thornmaul',
    text: () =>
      `Hits on a wounded monster (under half health) do ${pct(PERK_STEP.executioner)} more.`,
  },
  // Survivor
  {
    id: 'iron_stomach',
    name: 'Iron stomach',
    branch: 'survive',
    tier: 1,
    max: 2,
    icon: 'ration',
    text: (r) => `Hunger and thirst grow ${pct(PERK_STEP.iron_stomach * r)} slower.`,
  },
  {
    id: 'field_medic',
    name: 'Field medic',
    branch: 'survive',
    tier: 1,
    max: 2,
    icon: 'bandage',
    text: (r) => `Bandages, medicine and meals heal ${pct(PERK_STEP.field_medic * r)} more.`,
  },
  {
    id: 'runner',
    name: 'Runner',
    branch: 'survive',
    tier: 2,
    max: 3,
    icon: 'water_bottle',
    text: (r) => `Sprint ${pct(PERK_STEP.runner * r)} longer before you're out of breath.`,
  },
  {
    id: 'night_owl',
    name: 'Night owl',
    branch: 'survive',
    tier: 3,
    max: 1,
    icon: 'torch',
    text: () => `Roaming monsters notice you ${pct(PERK_STEP.night_owl)} closer at night.`,
  },
  // Homesteader
  {
    id: 'carpenter',
    name: 'Carpenter',
    branch: 'build',
    tier: 1,
    max: 2,
    icon: 'wall_wood',
    text: (r) => `Build-menu pieces cost ${pct(PERK_STEP.carpenter * r)} less.`,
  },
  {
    id: 'green_thumb',
    name: 'Green thumb',
    branch: 'build',
    tier: 1,
    max: 2,
    icon: 'seed_corn',
    text: (r) =>
      `Your crops grow ${pct(PERK_STEP.green_thumb * r)} faster${r >= 2 ? ', and harvests give one more' : ''}.`,
  },
  {
    id: 'sturdy',
    name: 'Sturdy build',
    branch: 'build',
    tier: 2,
    max: 2,
    icon: 'wall_stone',
    text: (r) => `What you build is ${pct(PERK_STEP.sturdy * r)} tougher.`,
  },
  {
    id: 'tinkerer',
    name: 'Tinkerer',
    branch: 'build',
    tier: 2,
    max: 2,
    icon: 'workbench',
    text: (r) => `Tools and weapons wear out ${pct(PERK_STEP.tinkerer * r)} slower.`,
  },
  {
    id: 'animal_friend',
    name: 'Animal friend',
    branch: 'build',
    tier: 3,
    max: 1,
    icon: 'egg',
    text: () => 'Animals trust you one feeding sooner, and pets give eggs and milk twice as often.',
  },
];

export const PERK_BY_ID = Object.fromEntries(PERKS.map((p) => [p.id, p])) as Record<
  PerkId,
  PerkDef
>;

/** Points spent in a branch that open its tiers 1, 2 and 3. */
export const TIER_POINTS = [0, 2, 5] as const;

export const MAX_LEVEL = 30;

/** Total XP to reach a level (level 1 = 0, 2 = 100, 3 = 300, 4 = 600 …). */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return 50 * (l - 1) * l;
}

export function levelFor(xp: number): number {
  let l = 1;
  while (l < MAX_LEVEL && xp >= xpForLevel(l + 1)) l++;
  return l;
}

/** Skill points a level brings in total (one per level after the first). */
export function pointsFor(level: number): number {
  return Math.max(0, Math.floor(level) - 1);
}

export type Perks = Partial<Record<PerkId, number>>;

export function rankOf(perks: Perks, id: PerkId): number {
  return perks[id] ?? 0;
}

export function spent(perks: Perks, branch?: BranchId): number {
  let n = 0;
  for (const p of PERKS) if (!branch || p.branch === branch) n += perks[p.id] ?? 0;
  return n;
}

/** Why a perk can't be learned (null: it can). */
export function cantLearn(perks: Perks, xp: number, id: PerkId): string | null {
  const def = PERK_BY_ID[id];
  if (!def) return 'Unknown skill.';
  if (rankOf(perks, id) >= def.max) return 'Fully learned.';
  if (spent(perks) >= pointsFor(levelFor(xp)))
    return 'No skill points left. Level up to earn more.';
  const need = TIER_POINTS[def.tier - 1] ?? 0;
  if (spent(perks, def.branch) < need)
    return `Put ${need} points into ${BRANCHES.find((b) => b.id === def.branch)?.name ?? 'this branch'} first.`;
  return null;
}

/** Repairs perks from a save or a message: known ids, ranks in range, no more than earned. */
export function parsePerks(raw: unknown, xp: number): Perks {
  const out: Perks = {};
  if (!raw || typeof raw !== 'object') return out;
  const budget = pointsFor(levelFor(xp));
  let used = 0;
  // Lower tiers first, so a trimmed save keeps what the higher ones stand on.
  for (const def of [...PERKS].sort((a, b) => a.tier - b.tier)) {
    const v = (raw as Record<string, unknown>)[def.id];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const n = Math.min(def.max, Math.max(0, Math.floor(v)), budget - used);
    if (n <= 0) continue;
    out[def.id] = n;
    used += n;
  }
  return out;
}

/** XP for what you do (the authority's `gainXp` calls). */
export const XP = {
  /** A tree, rock or wreck brought down. */
  fell: 4,
  /** A bush, branch or stone picked. */
  pick: 1,
  luggage: 4,
  craft: 3,
  craftBench: 6,
  build: 3,
  plant: 2,
  harvest: 6,
  tame: 30,
  note: 6,
  page: 20,
  /** The night survived (at dawn, everyone alive). */
  dawn: 25,
  bloomDawn: 80,
  /** A lock, the generator, a treasure, the antenna: puzzle steps. */
  secret: 60,
  /** Killing one (by kind). */
  kill: {
    husk: 12,
    snapjaw: 15,
    puffer: 10,
    thornback: 30,
    mother: 400,
    crab: 3,
    boar: 8,
    goat: 5,
    fowl: 3,
    dog: 8,
  } as Record<string, number>,
} as const;
