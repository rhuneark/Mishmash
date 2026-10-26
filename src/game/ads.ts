// Ads that belong on the island. Every one is a rewarded video the player chooses to watch
// (never forced, no interstitials), framed as part of the world, and each does something
// no other part of the game does, once per island day per survivor:
// - the seatback screens of MX207 still run on the emergency battery: the in-flight channel
//   shows a sponsor (a Verdance AirDrop pod comes down near you, the Bloom it wakes included)
//   or Island Explorer, a travel show that finds the nearest place you haven't been;
// - Second wind, when the Bloom takes you: a Verdance med-drone wakes you where you fell,
//   with your bag, and its flash throws the Bloom back.

import { DAY } from './sim/time';

export type RewardKind = 'drop' | 'guide' | 'wind';
export const REWARD_KINDS: RewardKind[] = ['drop', 'guide', 'wind'];

export interface RewardDef {
  icon: string;
  name: string;
  desc: string;
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
};

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
