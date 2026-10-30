// The player's records across every island: what carries over when an island is new (the
// island's own level and skills stay with that island). Kept in appStorage on the device
// and posted to RUN's leaderboards. Pure: the app feeds it what the island tells it.

import { nextStreak } from './daily';

export const RECORDS_KEY = 'mishmash_records';

export interface Records {
  v: 1;
  /** The furthest day reached alive on one island. */
  bestDay: number;
  /** Helicopter rides home. */
  escapes: number;
  /** Fewest island days to escape (0: not yet). */
  fastestEscape: number;
  /** The Bloom slain, all islands. */
  slain: number;
  /** Nights survived, all islands. */
  nights: number;
  crafted: number;
  /** Islands started. */
  islands: number;
  /** Daily goals done, and the streak of days in a row. */
  dailies: number;
  daily: { day: number; streak: number; best: number };
}

export function newRecords(): Records {
  return {
    v: 1,
    bestDay: 0,
    escapes: 0,
    fastestEscape: 0,
    slain: 0,
    nights: 0,
    crafted: 0,
    islands: 0,
    dailies: 0,
    daily: { day: 0, streak: 0, best: 0 },
  };
}

const count = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(1e9, Math.floor(v)) : 0;

/** Stored records (untrusted); anything broken counts as none. */
export function parseRecords(raw: string | null): Records {
  const r = newRecords();
  if (!raw) return r;
  let d: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return r;
    d = parsed as Record<string, unknown>;
  } catch {
    return r;
  }
  r.bestDay = count(d['bestDay']);
  r.escapes = count(d['escapes']);
  r.fastestEscape = count(d['fastestEscape']);
  r.slain = count(d['slain']);
  r.nights = count(d['nights']);
  r.crafted = count(d['crafted']);
  r.islands = count(d['islands']);
  r.dailies = count(d['dailies']);
  const daily = (d['daily'] && typeof d['daily'] === 'object' ? d['daily'] : {}) as Record<
    string,
    unknown
  >;
  r.daily = {
    day: count(daily['day']),
    streak: count(daily['streak']),
    best: count(daily['best']),
  };
  r.daily.best = Math.max(r.daily.best, r.daily.streak);
  return r;
}

/** What the island says happened, as changes since the last look. */
export interface Happened {
  /** The day reached (alive). */
  day?: number;
  slain?: number;
  nights?: number;
  crafted?: number;
  /** Escaped on this island day. */
  escapedOn?: number;
  /** Started a new island. */
  island?: boolean;
  /** Today's daily goal done (UTC day). */
  dailyOn?: number;
}

export function noteRecords(r: Records, h: Happened): Records {
  const next: Records = { ...r, daily: { ...r.daily } };
  if (h.day) next.bestDay = Math.max(next.bestDay, h.day);
  next.slain += h.slain ?? 0;
  next.nights += h.nights ?? 0;
  next.crafted += h.crafted ?? 0;
  if (h.island) next.islands++;
  if (h.escapedOn) {
    next.escapes++;
    next.fastestEscape = next.fastestEscape
      ? Math.min(next.fastestEscape, h.escapedOn)
      : h.escapedOn;
  }
  if (h.dailyOn !== undefined && h.dailyOn !== r.daily.day) {
    next.dailies++;
    next.daily = nextStreak(r.daily, h.dailyOn);
  }
  return next;
}

/** The leaderboards (rundot/leaderboard.config.json modes) and the record each one shows. */
export const BOARDS = [
  { id: 'days', name: 'Days survived', icon: '📅', score: (r: Records) => r.bestDay },
  { id: 'slain', name: 'Bloom slain', icon: '⚔️', score: (r: Records) => r.slain },
  { id: 'escapes', name: 'Escapes', icon: '🚁', score: (r: Records) => r.escapes },
] as const;

export type BoardId = (typeof BOARDS)[number]['id'];
