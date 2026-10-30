import { describe, expect, it } from 'vitest';
import { DAILY_GOALS, dailyGoal, liveStreak, nextStreak, parseDaily, utcDay } from './daily';

describe('the daily goal', () => {
  it('is the same for everyone on a day, and moves on the next', () => {
    const day = utcDay(Date.UTC(2026, 9, 30, 15));
    expect(dailyGoal(day)).toBe(dailyGoal(day));
    expect(dailyGoal(day + 1).id).not.toBe(dailyGoal(day).id);
    // Every goal comes round.
    const seen = new Set<string>();
    for (let d = day; d < day + DAILY_GOALS.length; d++) seen.add(dailyGoal(d).id);
    expect(seen.size).toBe(DAILY_GOALS.length);
  });

  it('keeps a streak going day to day, and breaks it after a missed day', () => {
    let s = { day: 0, streak: 0, best: 0 };
    s = nextStreak(s, 100);
    expect(s).toEqual({ day: 100, streak: 1, best: 1 });
    s = nextStreak(s, 100);
    expect(s.streak).toBe(1);
    s = nextStreak(s, 101);
    s = nextStreak(s, 102);
    expect(s).toEqual({ day: 102, streak: 3, best: 3 });
    expect(liveStreak(s, 103)).toBe(3);
    expect(liveStreak(s, 104)).toBe(0);
    s = nextStreak(s, 105);
    expect(s).toEqual({ day: 105, streak: 1, best: 3 });
  });

  it('reads saved progress safely', () => {
    expect(parseDaily({ day: 5, n: 3, done: true })).toEqual({ day: 5, n: 3, done: true });
    expect(parseDaily({ day: 5, n: 'x' })).toEqual({ day: 5, n: 0, done: false });
    expect(parseDaily({ day: -1 })).toBeUndefined();
    expect(parseDaily('junk')).toBeUndefined();
  });
});
