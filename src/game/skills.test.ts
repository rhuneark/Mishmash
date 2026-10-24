import { describe, expect, it } from 'vitest';
import {
  MAX_LEVEL,
  PERKS,
  cantLearn,
  levelFor,
  parsePerks,
  pointsFor,
  spent,
  xpForLevel,
} from './skills';

describe('levels and the skill tree', () => {
  it('climbs levels on a steady curve and gives a point a level', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
    expect(levelFor(0)).toBe(1);
    expect(levelFor(99)).toBe(1);
    expect(levelFor(100)).toBe(2);
    expect(levelFor(10 ** 9)).toBe(MAX_LEVEL);
    expect(pointsFor(1)).toBe(0);
    expect(pointsFor(5)).toBe(4);
    // More ranks than a maxed survivor can buy: choices matter.
    expect(PERKS.reduce((n, p) => n + p.max, 0)).toBeGreaterThan(pointsFor(MAX_LEVEL));
  });

  it('opens a tier once enough points are in its branch', () => {
    const xp = xpForLevel(8);
    expect(cantLearn({}, 0, 'lumberjack')).toMatch(/No skill points/);
    expect(cantLearn({}, xp, 'lumberjack')).toBeNull();
    expect(cantLearn({}, xp, 'forager')).toMatch(/Put 2 points into Gatherer/);
    expect(cantLearn({ lumberjack: 2 }, xp, 'forager')).toBeNull();
    expect(cantLearn({ lumberjack: 2, forager: 2 }, xp, 'scavenger')).toMatch(/Put 5 points/);
    expect(cantLearn({ lumberjack: 3 }, xp, 'lumberjack')).toBe('Fully learned.');
  });

  it('repairs perks from a save: no unknown skills, no more than earned', () => {
    const p = parsePerks({ lumberjack: 9, miner: 2, wizardry: 3, forager: 'x' }, xpForLevel(4));
    expect(p).toEqual({ lumberjack: 3 });
    expect(spent(parsePerks({ brawler: 3, marksman: 3 }, xpForLevel(30)))).toBe(6);
    expect(parsePerks(null, 500)).toEqual({});
  });
});
