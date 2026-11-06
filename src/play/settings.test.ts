import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  cameraRig,
  gain,
  graphicsFor,
  graphicsOf,
  parseSettings,
  resolutionRange,
  screenToWorld,
} from './settings';

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

  it('repairs the HUD and build settings', () => {
    const s = parseSettings({
      hudOn: false,
      statsAt: 'middle',
      mapSize: 'large',
      quests: 'current',
      hudScale: 300,
      hudOpacity: 5,
      buildGrid: 3,
      buildSnap: false,
    });
    expect(s.hudOn).toBe(false);
    expect(s.statsAt).toBe('auto');
    expect(s.mapSize).toBe('large');
    expect(s.quests).toBe('current');
    expect(s.hudScale).toBe(140);
    expect(s.hudOpacity).toBe(40);
    expect(s.buildGrid).toBe(2);
    expect(s.buildSnap).toBe(false);
  });

  it('picks graphics for the device and curves volumes', () => {
    expect(graphicsFor('auto', true)).toEqual(graphicsFor('medium', true));
    expect(graphicsFor('auto', false)).toEqual(graphicsFor('high', false));
    expect(graphicsFor('low', false).grass).toBe(0);
    expect(gain(0)).toBe(0);
    expect(gain(100)).toBe(1);
    expect(gain(50)).toBeCloseTo(0.25);
  });

  it('reads the graphics rows: Auto follows the quality, the others override it', () => {
    const auto = { ...DEFAULT_SETTINGS };
    expect(graphicsOf(auto, true)).toEqual(graphicsFor('auto', true));
    expect(graphicsOf({ ...auto, quality: 'low' }, true).outlines).toBe(false);
    expect(graphicsOf({ ...auto, quality: 'low', outlines: 'on' }, true).outlines).toBe(true);
    expect(graphicsOf({ ...auto, shadows: 'off' }, false).shadows).toBe(0);
    expect(graphicsOf({ ...auto, shadows: 'low' }, false).shadows).toBe(1024);
    expect(graphicsOf({ ...auto, groundDetail: 'low' }, false).ground).toBe(1);
    const s = parseSettings({ resolution: 'ultra', shadows: 'high', resSettled: 9 });
    expect(s.resolution).toBe('auto');
    expect(s.shadows).toBe('high');
    expect(s.resSettled).toBe(0);
    expect(parseSettings({ resSettled: 2.5 }).resSettled).toBe(2.5);
  });

  it('picks the range a screen is drawn at', () => {
    expect(resolutionRange('auto', 3, 3)).toEqual({ min: 1, max: 3 });
    expect(resolutionRange('auto', 3, 1.5)).toEqual({ min: 1, max: 1.5 });
    expect(resolutionRange('auto', 1, 3)).toEqual({ min: 1, max: 1 });
    expect(resolutionRange('sharp', 3.5, 3)).toEqual({ min: 3, max: 3 });
    expect(resolutionRange('balanced', 3, 3)).toEqual({ min: 2, max: 2 });
    expect(resolutionRange('fast', 2, 3)).toEqual({ min: 1.5, max: 1.5 });
    expect(resolutionRange('fast', 1, 3)).toEqual({ min: 1, max: 1 });
  });

  it('turns the stick with the camera', () => {
    const near = (a: { x: number; z: number }, x: number, z: number) => {
      expect(a.x).toBeCloseTo(x);
      expect(a.z).toBeCloseTo(z);
    };
    // Top-down: up on screen is north.
    near(screenToWorld(0, -1, cameraRig('top').yaw), 0, -1);
    // Isometric: the camera stands south-west, so up is north-east and right is south-east.
    const iso = cameraRig('iso').yaw;
    near(screenToWorld(0, -1, iso), Math.SQRT1_2, -Math.SQRT1_2);
    near(screenToWorld(1, 0, iso), Math.SQRT1_2, Math.SQRT1_2);
    expect(parseSettings({ view: 'sideways' }).view).toBe('iso');
    expect(parseSettings({ view: 'top' }).view).toBe('top');
  });
});
