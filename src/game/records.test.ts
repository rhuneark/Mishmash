import { describe, expect, it } from 'vitest';
import { newRecords, noteRecords, parseRecords } from './records';
import { REMINDER_IDS, reminderPlan, reminderTime } from './reminders';
import { DAY_MS } from './daily';

describe('records across islands', () => {
  it('keeps the best and adds up the rest', () => {
    let r = newRecords();
    r = noteRecords(r, { island: true, day: 3 });
    r = noteRecords(r, { day: 2, slain: 4, nights: 1, crafted: 5 });
    r = noteRecords(r, { escapedOn: 9 });
    r = noteRecords(r, { escapedOn: 6 });
    expect(r).toMatchObject({
      islands: 1,
      bestDay: 3,
      slain: 4,
      nights: 1,
      crafted: 5,
      escapes: 2,
      fastestEscape: 6,
    });
    // Daily goals: once a day, a streak for days in a row.
    r = noteRecords(r, { dailyOn: 100 });
    r = noteRecords(r, { dailyOn: 100 });
    r = noteRecords(r, { dailyOn: 101 });
    expect([r.dailies, r.daily.streak, r.daily.best]).toEqual([2, 2, 2]);
    expect(parseRecords(JSON.stringify(r))).toEqual(r);
  });

  it('reads broken records as none', () => {
    expect(parseRecords('{nope')).toEqual(newRecords());
    expect(parseRecords(JSON.stringify({ slain: -5, bestDay: 'x', daily: 7 }))).toEqual(
      newRecords(),
    );
  });
});

describe('daily reminders', () => {
  const noon = Date.UTC(2026, 9, 30, 12);

  it('keeps out of the night on the player clock', () => {
    // 23:30 local (UTC+0) moves back to 21:30; 03:00 moves on to 08:00.
    const late = Date.UTC(2026, 9, 30, 23, 30);
    expect(new Date(reminderTime(late, 1, 0)).getUTCHours()).toBe(21);
    const early = Date.UTC(2026, 9, 30, 3);
    expect(new Date(reminderTime(early, 1, 0)).getUTCHours()).toBe(8);
    expect(reminderTime(noon, 2, 0)).toBe(noon + 2 * DAY_MS);
  });

  it('plans a few days, fewer on the web, naming the streak and the island', () => {
    const island = { name: 'Mango Reach', day: 4 };
    const today = Math.floor(noon / DAY_MS);
    const plan = reminderPlan({ island, daily: { day: today, streak: 3 } }, noon, 0, false);
    expect(plan.map((r) => r.id)).toEqual([...REMINDER_IDS]);
    expect(plan[0]?.title).toContain('3-day streak');
    expect(plan[1]?.title).toContain('Mango Reach');
    expect(
      reminderPlan({ island: null, daily: { day: 0, streak: 0 } }, noon, 0, true),
    ).toHaveLength(2);
  });
});
