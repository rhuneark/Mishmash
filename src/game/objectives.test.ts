import { describe, expect, it } from 'vitest';
import { cargoCode, noteText } from './content/notes';
import {
  currentObjective,
  knownCode,
  mainQuest,
  objectives,
  starterQuest,
  tagsFound,
  type Progress,
} from './objectives';

const progress = (
  flags: string[],
  notes: string[],
  carrying: string[] = [],
  phase: Progress['rescue']['phase'] = 'none',
): Progress => ({
  flags: new Set(flags),
  notes: new Set(notes),
  carrying: new Set(carrying),
  rescue: { phase, left: 0 },
});

describe('escape objectives', () => {
  it('starts at the wreckage and opens up as notes are read', () => {
    expect(currentObjective(progress([], []))?.id).toBe('crash');
    expect(currentObjective(progress([], ['crash_note']))?.id).toBe('cockpit');
    const parts = objectives(progress([], ['crash_note', 'cockpit_log'])).map((o) => o.id);
    expect(parts).toEqual(['crash', 'cockpit', 'battery', 'antenna', 'transmitter']);
  });

  it('asks for the radio once all three parts are found, then the beacon and the helicopter', () => {
    const notes = ['crash_note', 'cockpit_log'];
    const parts = ['cargo_open', 'antenna_taken', 'mother_dead'];
    expect(
      currentObjective(progress(parts, notes, ['battery', 'antenna', 'transmitter']))?.id,
    ).toBe('radio');
    expect(currentObjective(progress([...parts, 'radio_built'], notes, ['radio']))?.id).toBe(
      'call',
    );
    expect(
      currentObjective(
        progress([...parts, 'radio_built', 'radio_called'], notes, ['radio'], 'calling'),
      )?.id,
    ).toBe('hold');
    expect(
      currentObjective(
        progress([...parts, 'radio_built', 'radio_called'], notes, ['radio'], 'landed'),
      )?.id,
    ).toBe('board');
    expect(
      currentObjective(
        progress([...parts, 'radio_built', 'radio_called'], notes, ['radio'], 'gone'),
      )?.id,
    ).toBe('again');
    expect(
      currentObjective(
        progress([...parts, 'radio_built', 'radio_called', 'escaped'], notes, ['radio'], 'landed'),
      ),
    ).toBeNull();
  });

  it('counts a part as found when someone carries it (co-op)', () => {
    const list = objectives(
      progress(['cargo_open'], ['crash_note', 'cockpit_log'], ['transmitter']),
    );
    expect(list.find((o) => o.id === 'battery')?.done).toBe(true);
    expect(list.find((o) => o.id === 'transmitter')?.done).toBe(true);
    expect(list.find((o) => o.id === 'antenna')?.done).toBe(false);
  });

  it('reveals cargo code digits tag by tag', () => {
    const seed = 12345;
    const code = cargoCode(seed);
    expect(code).toMatch(/^\d{4}$/);
    expect(knownCode(seed, new Set())).toBe('____');
    expect(knownCode(seed, new Set(['tag_1', 'tag_3']))).toBe(`_${code[1]}_${code[3]}`);
    expect(tagsFound(new Set(['tag_0', 'tag_2', 'crash_note']))).toBe(2);
  });
});

describe('texts on a turned island', () => {
  it('points the checklist and the notes the right way, with the Bloom as the rules have it', () => {
    const turned = {
      turn: 1 as const,
      mirror: false,
      climate: 'tropic' as const,
      terrain: 'classic' as const,
    };
    const cockpit = objectives({ ...progress([], ['crash_note']), parts: turned })[1];
    expect(cockpit?.text).toBe('Find the cockpit in the jungle to the north-east');
    const plain = objectives(progress([], ['crash_note']))[1];
    expect(plain?.text).toBe('Find the cockpit in the jungle to the north-west');
    const text = noteText('kessler', 1, undefined, { parts: turned, bloomEvery: 3 });
    expect(text).toMatch(/Every third night/);
    expect(noteText('kessler', 1)).toMatch(/seventh/);
  });
});

describe('quests', () => {
  it('lists the chapter you are on, its done steps ticked', () => {
    const start = mainQuest(objectives(progress([], ['crash_note'])));
    expect(start?.title).toContain('MX207');
    expect(start?.steps.map((s) => [s.id, s.done])).toEqual([
      ['crash', true],
      ['cockpit', false],
    ]);
    const parts = mainQuest(objectives(progress(['cargo_open'], ['crash_note', 'cockpit_log'])));
    expect(parts?.id).toBe('parts');
    expect(parts?.steps.find((s) => s.id === 'battery')?.done).toBe(true);
    expect(parts?.steps.every((s) => s.text.length < 60)).toBe(true);
  });

  it('gives a first-night quest until the camp is set up, and only on the first days', () => {
    const q = starterQuest({ axe: true, campfire: false, bedroll: false, day: 1 });
    expect(q?.steps.map((s) => s.done)).toEqual([true, false, false]);
    expect(starterQuest({ axe: true, campfire: true, bedroll: true, day: 1 })).toBeNull();
    expect(starterQuest({ axe: false, campfire: false, bedroll: false, day: 4 })).toBeNull();
  });
});
