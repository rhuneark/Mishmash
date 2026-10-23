import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, gain, graphicsFor, parseSettings } from './settings';

describe('settings', () => {
  it('repairs saved settings', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('junk')).toEqual(DEFAULT_SETTINGS);
    const s = parseSettings({
      autoTool: false,
      master: 250,
      music: -4,
      sfx: 'loud',
      orientation: 'sideways',
      quality: 'high',
      camera: 10,
      hud: 'large',
    });
    expect(s.autoTool).toBe(false);
    expect(s.master).toBe(100);
    expect(s.music).toBe(0);
    expect(s.sfx).toBe(DEFAULT_SETTINGS.sfx);
    expect(s.orientation).toBe('portrait');
    expect(s.quality).toBe('high');
    expect(s.camera).toBe(80);
    expect(s.hud).toBe('large');
  });

  it('picks graphics for the device and curves volumes', () => {
    expect(graphicsFor('auto', true)).toEqual(graphicsFor('medium', true));
    expect(graphicsFor('auto', false)).toEqual(graphicsFor('high', false));
    expect(graphicsFor('low', false).grass).toBe(0);
    expect(gain(0)).toBe(0);
    expect(gain(100)).toBe(1);
    expect(gain(50)).toBeCloseTo(0.25);
  });
});
