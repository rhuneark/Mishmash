// Daily reminders: what to schedule after a visit and when. One a day for the next few
// days (fewer on the web, where ones that came due while the page was closed arrive
// together), at the hour of the visit, never in the night on the player's clock. Each one
// names that day's goal, the streak, or the island waiting. Pure: the app passes the clock
// and the device's UTC offset; the schedule is replaced on every visit.

import { DAY_MS, dailyGoal, utcDay } from './daily';

const HOUR_MS = 3_600_000;

/** Days after a visit that get a reminder. */
export const REMINDER_DAYS: readonly number[] = [1, 2, 3];
export const WEB_REMINDER_DAYS: readonly number[] = [1, 3];
/** No reminders from 22:00 to 08:00 on the player's clock. */
export const QUIET_FROM = 22;
export const QUIET_TO = 8;

/** Stable ids, so a new plan replaces the old one. */
export const REMINDER_IDS: readonly string[] = ['bloom_r1', 'bloom_r2', 'bloom_r3'];

export interface Reminder {
  id: string;
  /** Wall clock (ms). */
  at: number;
  title: string;
  body: string;
}

export interface ReminderSource {
  /** The island played last (null: none yet). */
  island: { name: string; day: number } | null;
  /** The daily streak (records.ts). */
  daily: { day: number; streak: number };
}

/** `days` after `at`, moved out of quiet hours (`tzMin`: minutes ahead of UTC). */
export function reminderTime(at: number, days: number, tzMin: number): number {
  const t = at + days * DAY_MS;
  const tz = tzMin * 60_000;
  const dayStart = Math.floor((t + tz) / DAY_MS) * DAY_MS - tz;
  const hour = (t - dayStart) / HOUR_MS;
  if (hour >= QUIET_FROM) return dayStart + (QUIET_FROM - 0.5) * HOUR_MS;
  if (hour < QUIET_TO) return dayStart + QUIET_TO * HOUR_MS;
  return t;
}

export function reminderPlan(
  s: ReminderSource,
  now: number,
  tzMin: number,
  web: boolean,
): Reminder[] {
  const days = web ? WEB_REMINDER_DAYS : REMINDER_DAYS;
  return days.map((d, i) => {
    const at = reminderTime(now, d, tzMin);
    const goal = dailyGoal(utcDay(at));
    // A streak is only worth a reminder when today's goal is done (it carries into tomorrow).
    const streak = s.daily.day === utcDay(now) ? s.daily.streak : 0;
    const where = s.island ? ` on ${s.island.name}` : '';
    let title: string;
    let body: string;
    if (d === 1 && streak > 0) {
      title = `🔥 Keep your ${streak}-day streak`;
      body = `Today's goal${where}: ${goal.text.toLowerCase()}.`;
    } else if (d === 2 && s.island) {
      title = `🌙 Night is coming on ${s.island.name}`;
      body = `Your campfire is waiting. Day ${s.island.day} goes on without you…`;
    } else {
      title = `${goal.icon} New daily goal`;
      body = `${goal.text}${where}, for a care package.`;
    }
    return { id: REMINDER_IDS[i] ?? `bloom_r${i + 1}`, at, title, body };
  });
}
