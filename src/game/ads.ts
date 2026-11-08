// Ads that belong on the island. Every one is a rewarded video the player chooses to watch
// (never forced, no interstitials), framed as part of the world, and each does something
// no other part of the game does, once per island day per survivor:
// - the seatback screens of MX207 still run on the emergency battery: the in-flight channel
//   shows a sponsor (a Verdance AirDrop pod comes down near you, the Bloom it wakes included)
//   or Island Explorer, a travel show that finds the nearest place you haven't been;
// - Second wind, when the Bloom takes you: a Verdance med-drone wakes you where you fell,
//   with your bag, and its flash throws the Bloom back.
// And offered on the HUD when their moment comes (the island says which are open, `offers`):
// - the dawn repair crew, the morning after a Bloom night: every damaged piece on the island
//   back to full;
// - the crew care package, at dusk and by night in co-op: supplies at every survivor's feet;
// - the vet drone, after your pet dies: it carries it home to your bedroll, alive;
// - the bonus shipment, once today's daily goal is done: its care package and XP again.
// A Verdance Gold Card (shop.ts) claims any of them without the video, still once a day.

import { DAY, DUSK, NIGHT_END, dayInfo } from './sim/time';
import type { Slot } from './sim/protocol';

export type RewardKind = 'drop' | 'guide' | 'wind' | 'repair' | 'crew' | 'vet' | 'bonus';
export const REWARD_KINDS: RewardKind[] = [
  'drop',
  'guide',
  'wind',
  'repair',
  'crew',
  'vet',
  'bonus',
];
/** The ones the HUD offers when their moment comes, most pressing first. */
export const OFFERED: RewardKind[] = ['vet', 'repair', 'bonus', 'crew'];

export interface RewardDef {
  icon: string;
  name: string;
  desc: string;
  /** One line for the HUD's offer card (`{pet}`: the pet's name). */
  short?: string;
  /** Placement for RUN's ad attribution. */
  adId: string;
}

export const REWARDS: Record<RewardKind, RewardDef> = {
  drop: {
    icon: '📦',
    name: 'Sponsor drop',
    desc: 'Verdance AirDrop: "a word from our sponsor". A sponsored supply pod comes down near you. Whatever its crash wakes comes too.',
    adId: 'sponsor_drop',
  },
  guide: {
    icon: '🧭',
    name: 'Island Explorer',
    desc: "A travel show that somehow films this island. Today's episode visits the nearest place you haven't found, and it goes on the map.",
    adId: 'island_explorer',
  },
  wind: {
    icon: '🚁',
    name: 'Second wind',
    desc: 'A Verdance med-drone finds you: wake up where you fell with your bag, and its flash throws the Bloom back.',
    adId: 'second_wind',
  },
  repair: {
    icon: '🛠️',
    name: 'Dawn repair crew',
    desc: 'The Bloom chewed on your base last night. A Verdance repair crew patches every damaged piece back to full.',
    short: 'Every damaged piece back to full.',
    adId: 'repair_crew',
  },
  crew: {
    icon: '🎁',
    name: 'Crew care package',
    desc: 'Night is coming. A care package lands at every survivor’s feet: a ration, water and a bandage each.',
    short: 'Supplies at every survivor’s feet.',
    adId: 'crew_package',
  },
  vet: {
    icon: '🩺',
    name: 'Vet drone',
    desc: 'A Verdance vet drone finds your pet and carries it home to your bedroll, alive.',
    short: 'Bring {pet} home, alive.',
    adId: 'vet_drone',
  },
  bonus: {
    icon: '📦',
    name: 'Bonus shipment',
    desc: 'Daily goal done! A second care package and the XP again.',
    short: 'Today’s care package and XP again.',
    adId: 'bonus_shipment',
  },
};

/** What the crew care package drops at each survivor's feet. */
export const CREW_KIT: Slot[] = [
  { id: 'ration', n: 1 },
  { id: 'water_bottle', n: 1 },
  { id: 'bandage', n: 1 },
];

/** How long after a pet dies the vet drone can still bring it back (seconds). */
export const VET_WINDOW = DAY;

/** The day after a Bloom night, until dusk: the repair crew's moment. */
export function afterBloomNight(time: number, bloomEvery: number): boolean {
  const i = dayInfo(time, bloomEvery);
  const last = i.day - 1;
  return bloomEvery > 0 && !i.night && i.phase < DUSK && last > 0 && last % bloomEvery === 0;
}

/** Dusk and night: the crew care package's moment. */
export function crewHour(time: number): boolean {
  const phase = dayInfo(time).phase;
  return phase >= DUSK || phase < NIGHT_END;
}

/** The island day a reward was last used, per kind (kept per survivor). */
export type RewardDays = Partial<Record<RewardKind, number>>;

export function islandDay(time: number): number {
  return Math.floor(time / DAY);
}

/** Each reward once per island day. */
export function rewardReady(days: RewardDays, kind: RewardKind, time: number): boolean {
  return days[kind] !== islandDay(time);
}

export function isRewardKind(v: unknown): v is RewardKind {
  return typeof v === 'string' && (REWARD_KINDS as string[]).includes(v);
}

/** Repairs saved reward days (untrusted). */
export function parseRewardDays(raw: unknown): RewardDays {
  const out: RewardDays = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isRewardKind(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0)
      out[k] = Math.floor(v);
  }
  return out;
}
