import { describe, expect, it } from 'vitest';
import { NODE } from './content/nodes';
import { RECIPES } from './content/recipes';
import { BUILDINGS } from './content/buildings';
import { emptyInv, add } from './sim/inventory';
import { TUTORIAL, TUT_DONE, TUT_VERSION, hasFood, parseTut, type TutView } from './tutorial';

function view(items: [string, number][] = [], extra: Partial<TutView> = {}): TutView {
  const inv = emptyInv();
  for (const [id, n] of items) add(inv, id, n);
  return { inv, notes: new Set(), built: new Set(), did: new Set(), xp: 0, perks: {}, ...extra };
}

const step = (id: string) => {
  const s = TUTORIAL.find((t) => t.id === id);
  if (!s) throw new Error(id);
  return s;
};

describe('survival basics', () => {
  it('has a clear step for each thing, with how to do it on a phone and a PC', () => {
    const ids = new Set(TUTORIAL.map((s) => s.id));
    expect(ids.size).toBe(TUTORIAL.length);
    for (const s of TUTORIAL) {
      expect(s.title.length).toBeGreaterThan(3);
      expect(s.touch.length).toBeGreaterThan(10);
      expect(s.pc.length).toBeGreaterThan(10);
      expect(s.xp).toBeGreaterThan(0);
      if (s.recipe) expect(RECIPES[s.recipe]).toBeDefined();
      if (s.piece) expect(BUILDINGS[s.piece]).toBeDefined();
    }
    expect(TUT_DONE).toBe(TUTORIAL.length);
    expect(TUTORIAL[TUTORIAL.length - 1]?.id).toBe('end');
  });

  it('checks each step from what you carry, read and built', () => {
    expect(step('note').done(view())).toBe(false);
    expect(step('note').done(view([], { notes: new Set(['crash_note']) }))).toBe(true);
    const sticks = step('sticks');
    expect(sticks.done(view([['wood', 3]]))).toBe(false);
    expect(
      sticks.done(
        view([
          ['wood', 3],
          ['stone', 2],
        ]),
      ),
    ).toBe(true);
    // Each goal ticks off by itself, with how many so far.
    const goals = sticks.goals(view([['wood', 5]]));
    expect(goals.map((g) => [g.count, g.done])).toEqual([
      [[3, 3], true],
      [[0, 2], false],
    ]);
    // Branches first, then loose stones.
    expect(sticks.target?.(view())).toEqual({ kind: 'node', types: [NODE.branch] });
    expect(sticks.target?.(view([['wood', 3]]))).toEqual({ kind: 'node', types: [NODE.pebble] });
    expect(step('axe').done(view([['axe_stone', 1]]))).toBe(true);
    // Steps you're already past count as done (an axe made before the sticks were counted).
    expect(sticks.done(view([['axe_stone', 1]]))).toBe(true);
    expect(step('campfire').done(view([], { built: new Set(['campfire']) }))).toBe(true);
    expect(step('bedroll').done(view([], { built: new Set(['bed']) }))).toBe(true);
    expect(step('bedroll').done(view([], { built: new Set(['campfire']) }))).toBe(false);
  });

  it("doesn't get stuck on eating when there's nothing to eat", () => {
    expect(hasFood(view([['ration', 1]]).inv)).toBe(true);
    expect(step('eat').done(view([['ration', 1]]))).toBe(false);
    expect(step('eat').done(view([['ration', 1]], { did: new Set(['eat']) }))).toBe(true);
    expect(step('eat').done(view([['wood', 4]]))).toBe(true);
  });

  it('ticks off what the screen shows, and asks for a skill once there is a point', () => {
    const fire = step('campfire');
    expect(fire.goals(view()).map((g) => g.done)).toEqual([false, false, false]);
    expect(
      fire.goals(view([], { seen: new Set(['build', 'piece:campfire']) })).map((g) => g.done),
    ).toEqual([true, true, false]);
    const skills = step('skills');
    // Level 2 (100 XP): a point to spend.
    expect(skills.done(view([], { xp: 120 }))).toBe(false);
    expect(skills.done(view([], { xp: 120, perks: { lumberjack: 1 } }))).toBe(true);
    // Nothing to spend yet: nothing to learn here.
    expect(skills.done(view([], { xp: 40 }))).toBe(true);
  });

  it('reads saved steps safely', () => {
    expect(parseTut(3, 0, TUT_VERSION)).toBe(3);
    expect(parseTut(99, 0, TUT_VERSION)).toBe(TUT_DONE);
    expect(parseTut(-4, 0, TUT_VERSION)).toBe(0);
    expect(parseTut('x', TUT_DONE, TUT_VERSION)).toBe(TUT_DONE);
    // v1.23 saves (no version): 12 meant finished; the skills step came in before the last.
    expect(parseTut(12, 0, undefined)).toBe(TUT_DONE);
    expect(parseTut(11, 0, undefined)).toBe(11);
    expect(parseTut(12, 0, TUT_VERSION)).toBe(12);
  });
});
