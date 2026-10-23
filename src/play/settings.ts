// Player settings (Menu › Settings): gameplay helpers, volumes, screen, graphics.
// Saved in appStorage under SETTINGS_KEY; parseSettings repairs whatever was saved.

export const SETTINGS_KEY = 'mishmash_settings';

export type Quality = 'auto' | 'low' | 'medium' | 'high';
export type Orientation = 'portrait' | 'landscape';
export type HudSize = 'small' | 'normal' | 'large';
/** Isometric (diagonal and low, like Project Zomboid) or top-down (north up, steep). */
export type CameraView = 'iso' | 'top';

export interface Settings {
  /** Switch to the right tool for trees, rocks and vines. */
  autoTool: boolean;
  /** Switch to your best weapon when you attack. */
  autoWeapon: boolean;
  /** Go back to what you held once the job is done. */
  autoBack: boolean;
  /** Volumes, 0–100. */
  master: number;
  sfx: number;
  ambience: number;
  music: number;
  /** Phones: play upright or sideways. */
  orientation: Orientation;
  /** Sideways the other way round. */
  flip: boolean;
  /** Stick on the right, buttons on the left. */
  leftHanded: boolean;
  hud: HudSize;
  view: CameraView;
  /** Camera distance, 80–130 (%). */
  camera: number;
  shake: boolean;
  damageNumbers: boolean;
  vibration: boolean;
  quality: Quality;
  /** Grass, birds, butterflies and fireflies. */
  life: boolean;
  fps: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autoTool: true,
  autoWeapon: true,
  autoBack: true,
  master: 80,
  sfx: 90,
  ambience: 70,
  music: 55,
  orientation: 'portrait',
  flip: false,
  leftHanded: false,
  hud: 'normal',
  view: 'iso',
  camera: 100,
  shake: true,
  damageNumbers: true,
  vibration: true,
  quality: 'auto',
  life: true,
  fps: false,
};

const QUALITIES: Quality[] = ['auto', 'low', 'medium', 'high'];
const ORIENTATIONS: Orientation[] = ['portrait', 'landscape'];
const HUD_SIZES: HudSize[] = ['small', 'normal', 'large'];
const VIEWS: CameraView[] = ['iso', 'top'];

function num(v: unknown, def: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v)
    ? Math.round(Math.min(max, Math.max(min, v)))
    : def;
}

function bool(v: unknown, def: boolean): boolean {
  return typeof v === 'boolean' ? v : def;
}

function pick<T extends string>(v: unknown, list: T[], def: T): T {
  return list.includes(v as T) ? (v as T) : def;
}

/** Settings from saved (untrusted) data: unknown or broken fields get their defaults. */
export function parseSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (!raw || typeof raw !== 'object') return { ...d };
  const o = raw as Record<string, unknown>;
  return {
    autoTool: bool(o['autoTool'], d.autoTool),
    autoWeapon: bool(o['autoWeapon'], d.autoWeapon),
    autoBack: bool(o['autoBack'], d.autoBack),
    master: num(o['master'], d.master, 0, 100),
    sfx: num(o['sfx'], d.sfx, 0, 100),
    ambience: num(o['ambience'], d.ambience, 0, 100),
    music: num(o['music'], d.music, 0, 100),
    orientation: pick(o['orientation'], ORIENTATIONS, d.orientation),
    flip: bool(o['flip'], d.flip),
    leftHanded: bool(o['leftHanded'], d.leftHanded),
    hud: pick(o['hud'], HUD_SIZES, d.hud),
    view: pick(o['view'], VIEWS, d.view),
    camera: num(o['camera'], d.camera, 80, 130),
    shake: bool(o['shake'], d.shake),
    damageNumbers: bool(o['damageNumbers'], d.damageNumbers),
    vibration: bool(o['vibration'], d.vibration),
    quality: pick(o['quality'], QUALITIES, d.quality),
    life: bool(o['life'], d.life),
    fps: bool(o['fps'], d.fps),
  };
}

export interface GraphicsLevel {
  /** Highest device pixel ratio drawn. */
  pixelRatio: number;
  /** Terrain chunks drawn around you (32 m each). */
  terrain: number;
  /** Node chunks drawn around you. */
  nodes: number;
  /** Grass tufts per 32 m chunk (0 = none). */
  grass: number;
  /** Fog distance, × the normal one. */
  fog: number;
  particles: number;
}

const LEVELS: Record<Exclude<Quality, 'auto'>, GraphicsLevel> = {
  low: { pixelRatio: 1, terrain: 2, nodes: 2, grass: 0, fog: 0.8, particles: 0.5 },
  medium: { pixelRatio: 1.5, terrain: 3, nodes: 2, grass: 180, fog: 1, particles: 0.8 },
  high: { pixelRatio: 2, terrain: 3, nodes: 2, grass: 320, fog: 1.1, particles: 1 },
};

/** What a quality setting means on this device ('auto': medium on phones, high with a mouse). */
export function graphicsFor(q: Quality, touch: boolean): GraphicsLevel {
  if (q === 'auto') return LEVELS[touch ? 'medium' : 'high'];
  return LEVELS[q];
}

/** Volume 0–100 → gain (a curve, so the slider feels even). */
export function gain(v: number): number {
  const k = Math.min(100, Math.max(0, v)) / 100;
  return k * k;
}

export interface CameraRig {
  /** Where the camera stands around the survivor (radians; 0 = due south, looking north). */
  yaw: number;
  /** Angle down from level. */
  pitch: number;
  /** Vertical field of view (degrees): narrow looks flatter, more isometric. */
  fov: number;
  /** Distance to what it looks at (× 1.3 upright, × 1.05 sideways, × the camera setting). */
  dist: number;
  /** How far ahead of the survivor it looks, so they sit below the HUD's top rows. */
  ahead: number;
}

export function cameraRig(view: CameraView): CameraRig {
  return view === 'iso'
    ? { yaw: -Math.PI / 4, pitch: (40 * Math.PI) / 180, fov: 30, dist: 41, ahead: 5 }
    : { yaw: 0, pitch: Math.atan2(22, 11.5), fov: 48, dist: Math.hypot(22, 11.5), ahead: 3.5 };
}

/**
 * A stick or keys on screen (x right, z down) → a direction on the island for a camera
 * at `yaw`: up on screen is straight away from the camera.
 */
export function screenToWorld(x: number, z: number, yaw: number): { x: number; z: number } {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: x * c + z * s, z: -x * s + z * c };
}
