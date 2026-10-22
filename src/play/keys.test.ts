import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  bind,
  bindable,
  defaultBindings,
  keyHint,
  keyLabel,
  parseBindings,
  reverse,
  unbind,
} from './keys';

describe('key bindings', () => {
  it('defaults never give one key two jobs', () => {
    const seen = new Set<string>();
    for (const a of ACTIONS) {
      for (const c of a.def) {
        expect(seen.has(c), c).toBe(false);
        expect(bindable(c), c).toBe(true);
        seen.add(c);
      }
    }
  });

  it('repairs saved tables: defaults for missing actions, junk dropped, duplicates removed', () => {
    const b = parseBindings({
      use: ['KeyX', 42, 'NotAKey', 'Escape', 'KeyY'],
      up: ['KeyX'],
      down: 'nope',
    });
    // 'up' is listed before 'use', so it keeps KeyX.
    expect(b.up).toEqual(['KeyX']);
    expect(b.use).toEqual(['KeyY']);
    expect(b.down).toEqual(defaultBindings().down);
    expect(parseBindings(null)).toEqual(defaultBindings());
  });

  it('moves a key from the action that had it', () => {
    const { bindings, took } = bind(defaultBindings(), 'eat', 0, 'KeyE');
    expect(took).toBe('use');
    expect(bindings.eat[0]).toBe('KeyE');
    expect(bindings.use).not.toContain('KeyE');
    expect(reverse(bindings).get('KeyE')).toEqual(['eat']);
  });

  it('adds, replaces and clears slots', () => {
    let b = defaultBindings();
    b = bind(b, 'map', 1, 'KeyN').bindings;
    expect(b.map).toEqual(['KeyM', 'KeyN']);
    b = bind(b, 'map', 0, 'Mouse2').bindings;
    expect(b.map).toEqual(['Mouse2', 'KeyN']);
    b = unbind(b, 'map', 0);
    expect(b.map).toEqual(['KeyN']);
    expect(bind(b, 'map', 0, 'Escape').bindings).toBe(b);
  });

  it('names keys for people', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('Digit3')).toBe('3');
    expect(keyLabel('Mouse0')).toBe('Left click');
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyHint(defaultBindings(), 'use')).toBe('Space');
    expect(keyHint({ ...defaultBindings(), use: ['Mouse0'] }, 'use')).toBe('');
  });
});
