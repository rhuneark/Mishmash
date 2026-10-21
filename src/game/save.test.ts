import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, newSave, parseSave, recordVisit } from './save';

describe('parseSave', () => {
  it('starts fresh without a save', () => {
    expect(parseSave(null)).toEqual(newSave());
    expect(parseSave('')).toEqual(newSave());
  });

  it('falls back to defaults on broken data', () => {
    expect(parseSave('{not json')).toEqual(newSave());
    expect(parseSave('42')).toEqual(newSave());
    expect(parseSave('{"visits":-3}')).toEqual(newSave());
    expect(parseSave('{"visits":"7"}')).toEqual(newSave());
    expect(parseSave('{"introSeen":"yes"}').introSeen).toBe(false);
  });

  it('reads a stored save', () => {
    expect(parseSave(JSON.stringify({ v: SAVE_VERSION, visits: 4, introSeen: true }))).toEqual({
      v: SAVE_VERSION,
      visits: 4,
      introSeen: true,
    });
  });

  it('accepts saves from before the intro', () => {
    expect(parseSave(JSON.stringify({ v: 1, visits: 2 }))).toEqual({
      v: SAVE_VERSION,
      visits: 2,
      introSeen: false,
    });
  });

  it('round-trips through recordVisit', () => {
    const once = recordVisit(parseSave(null));
    expect(parseSave(JSON.stringify(once)).visits).toBe(1);
  });
});
