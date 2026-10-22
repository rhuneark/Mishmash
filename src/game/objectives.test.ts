import { describe, expect, it } from 'vitest';
import { cargoCode } from './content/notes';
import { currentObjective, knownCode, objectives, tagsFound, type Progress } from './objectives';

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
