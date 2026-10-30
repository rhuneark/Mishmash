// The daily goal: one small thing to do each real day (UTC), the same for everyone, counted
// by the island's authority from what survivors actually do, with a care package for it.
// Doing one each day keeps a streak going (kept with the player's records, across islands).
// Pure: the links hand the authority the wall clock.

import type { Slot } from './sim/protocol';

/** What the authority counts towards a goal. */
export type DailyKind =
  'fell' | 'pick' | 'search' | 'craft' | 'cook' | 'build' | 'slay' | 'hunt' | 'night';

export interface DailyGoal {
  id: string;
  kind: DailyKind;
  need: number;
  icon: string;
  text: string;
}

/** The rotation. Append only: a day's goal is picked by its place in this list. */
export const DAILY_GOALS: DailyGoal[] = [
  { id: 'fell', kind: 'fell', need: 10, icon: '🪓', text: 'Fell 10 trees or rocks' },
  { id: 'craft', kind: 'craft', need: 8, icon: '🔨', text: 'Craft 8 things' },
  { id: 'slay', kind: 'slay', need: 8, icon: '⚔️', text: 'Slay 8 of the Bloom' },
  { id: 'pick', kind: 'pick', need: 25, icon: '🌿', text: 'Gather 25 things by hand' },
  { id: 'build', kind: 'build', need: 6, icon: '🏠', text: 'Build 6 pieces' },
  { id: 'search', kind: 'search', need: 4, icon: '🧳', text: 'Search 4 suitcases' },
  { id: 'cook', kind: 'cook', need: 3, icon: '🍲', text: 'Cook 3 meals' },
  { id: 'night', kind: 'night', need: 1, icon: '🌙', text: 'Survive a night' },
  { id: 'hunt', kind: 'hunt', need: 2, icon: '🐗', text: 'Hunt 2 island animals' },
];

export const DAY_MS = 86_400_000;

/** Days since 1970 (UTC): the daily goal's day. */
export function utcDay(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

/** The goal of a day: a fixed shuffle of the rotation, so neighbouring days differ. */
export function dailyGoal(day: number): DailyGoal {
  const n = DAILY_GOALS.length;
  const i = (((day * 7 + 3) % n) + n) % n;
  return DAILY_GOALS[i] as DailyGoal;
}

/** What finishing one gives, with its XP. */
export const DAILY_XP = 120;
export const DAILY_GIFT: Slot[] = [
  { id: 'bandage', n: 2 },
  { id: 'water_bottle', n: 1 },
];

/** A survivor's progress on today's goal (saved with them on the island). */
export interface DailyProgress {
  day: number;
  n: number;
  done: boolean;
}

/** Saved progress (untrusted); anything broken is a fresh start. */
export function parseDaily(raw: unknown): DailyProgress | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const day = o['day'];
  const n = o['n'];
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 0) return undefined;
  return {
    day,
    n: typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(999, Math.floor(n))) : 0,
    done: o['done'] === true,
  };
}

/** The streak after doing a goal on `day` (kept from the day before, else a fresh one). */
export function nextStreak(
  s: { day: number; streak: number; best: number },
  day: number,
): { day: number; streak: number; best: number } {
  if (s.day === day) return s;
  const streak = s.day === day - 1 ? s.streak + 1 : 1;
  return { day, streak, best: Math.max(s.best, streak) };
}

/** The streak as it stands today (broken if yesterday's goal wasn't done). */
export function liveStreak(s: { day: number; streak: number }, today: number): number {
  return s.day >= today - 1 ? s.streak : 0;
}
