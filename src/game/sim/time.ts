// Island clock. A day is 10 minutes: 6 of daylight, 4 of night. Every 7th
// night the Bloom wakes (a horde night).

export const DAY = 600;
export const DUSK = 0.75;
export const NIGHT_START = 0.8;
export const NIGHT_END = 0.2;
export const START_TIME = DAY * 0.3;
export const BLOOM_EVERY = 7;

export interface DayInfo {
  /** 1-based day number. */
  day: number;
  /** 0..1 through the day (0 = midnight). */
  phase: number;
  night: boolean;
  /** The day this night belongs to. */
  nightOf: number;
  bloom: boolean;
}

export function dayInfo(t: number): DayInfo {
  const day = Math.floor(t / DAY) + 1;
  const phase = (t - (day - 1) * DAY) / DAY;
  const night = phase >= NIGHT_START || phase < NIGHT_END;
  const nightOf = phase >= NIGHT_START ? day : day - 1;
  const bloom = night && nightOf > 0 && nightOf % BLOOM_EVERY === 0;
  return { day, phase, night, nightOf, bloom };
}

/** Daylight 0..1 for a phase (smooth dawn and dusk). */
export function daylight(phase: number): number {
  const up = (phase - (NIGHT_END - 0.03)) / 0.1;
  const down = (NIGHT_START + 0.03 - phase) / 0.1;
  return Math.max(0, Math.min(1, up, down));
}

/** "Day 3 · 14:20" style clock for the HUD. */
export function clockLabel(t: number): string {
  const { day, phase } = dayInfo(t);
  const minutes = Math.floor(phase * 24 * 60);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(Math.floor((minutes % 60) / 10) * 10).padStart(2, '0');
  return `Day ${day} · ${hh}:${mm}`;
}
