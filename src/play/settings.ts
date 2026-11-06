// Player settings (Menu › Settings): gameplay helpers, volumes, screen, graphics.
// Saved in appStorage under SETTINGS_KEY; parseSettings repairs whatever was saved.

export const SETTINGS_KEY = 'mishmash_settings';

export type Quality = 'auto' | 'low' | 'medium' | 'high';
/**
 * How sharp the island is drawn: 'auto' up to the screen's full sharpness, easing off while
 * the game runs slow (resolution.ts); the others are fixed.
 */
export type Resolution = 'auto' | 'sharp' | 'balanced' | 'fast';
/** The sun's shadows ('auto': by quality). */
export type ShadowSetting = 'auto' | 'off' | 'low' | 'high';
/** Ink lines round trees, rocks, buildings and creatures ('auto': by quality). */
export type OutlineSetting = 'auto' | 'on' | 'off';
/** The painted ground and how sharp it stays into the distance ('auto': by quality). */
export type DetailSetting = 'auto' | 'low' | 'high';
export type Orientation = 'portrait' | 'landscape';
export type HudSize = 'small' | 'normal' | 'large';
/** Isometric (diagonal and low, like Project Zomboid) or top-down (north up, steep). */
export type CameraView = 'iso' | 'top';
/** Where health, food and water sit ('auto': bottom left on PC and sideways, else top left). */
export type StatsAt = 'auto' | 'top' | 'bottom';
export type MapSize = 'small' | 'normal' | 'large';
/** The quest list under the minimap: every step, only the next one, or hidden. */
export type QuestMode = 'full' | 'current' | 'off';

export interface Settings {
  /** Switch to the right tool for trees, rocks and vines. */
  autoTool: boolean;
  /** Switch to your best weapon when you attack. */
  autoWeapon: boolean;
  /** Go back to what you held once the job is done. */
  autoBack: boolean;
  /** 🎒 opens the survivor menu, or the small window by your survivor (plays on). */
  bagWindow: boolean;
  /** Survival basics (tutorial.ts) guides the first steps on an island. */
  tutorial: boolean;
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
  resolution: Resolution;
  shadows: ShadowSetting;
  outlines: OutlineSetting;
  groundDetail: DetailSetting;
  /** Auto resolution: where it settled last time on this device (a pixel ratio, 0 = not yet). */
  resSettled: number;
  /** Daily reminders (local notifications) after a visit. */
  reminders: boolean;
  /** Auto quality: levels stepped down on this device because it couldn't keep up (0–2). */
  autoDrop: number;
  /** Grass, birds, butterflies and fireflies. */
  life: boolean;
  fps: boolean;
  /** HUD: everything over the island (the controls and ⚙️ always stay). */
  hudOn: boolean;
  stats: boolean;
  statsAt: StatsAt;
  clock: boolean;
  minimap: boolean;
  mapSize: MapSize;
  /** The minimap turns with the camera (off: north up). */
  mapTurn: boolean;
  quests: QuestMode;
  /** Size of the bars, clock, quests and minimap, 80–140 (%). */
  hudScale: number;
  /** How solid the HUD's panels are, 40–100 (%). */
  hudOpacity: number;
  /** Key hints on buttons (PC). */
  keyHints: boolean;
  /** Build mode: snap to the grid, its cell size (m) and showing it. */
  buildSnap: boolean;
  buildGrid: number;
  buildGridShow: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autoTool: true,
  autoWeapon: true,
  autoBack: true,
  bagWindow: false,
  tutorial: true,
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
  resolution: 'auto',
  shadows: 'auto',
  outlines: 'auto',
  groundDetail: 'auto',
  resSettled: 0,
  reminders: true,
  autoDrop: 0,
  life: true,
  fps: false,
  hudOn: true,
  stats: true,
  statsAt: 'auto',
  clock: true,
  minimap: true,
  mapSize: 'normal',
  mapTurn: true,
  quests: 'full',
  hudScale: 100,
  hudOpacity: 100,
  keyHints: true,
  buildSnap: true,
  buildGrid: 2,
  buildGridShow: true,
};

export const BUILD_GRIDS = [1, 2];

const QUALITIES: Quality[] = ['auto', 'low', 'medium', 'high'];
const RESOLUTIONS: Resolution[] = ['auto', 'sharp', 'balanced', 'fast'];
const SHADOWS: ShadowSetting[] = ['auto', 'off', 'low', 'high'];
const OUTLINES: OutlineSetting[] = ['auto', 'on', 'off'];
const DETAILS: DetailSetting[] = ['auto', 'low', 'high'];
const ORIENTATIONS: Orientation[] = ['portrait', 'landscape'];
const HUD_SIZES: HudSize[] = ['small', 'normal', 'large'];
const VIEWS: CameraView[] = ['iso', 'top'];
const STATS_AT: StatsAt[] = ['auto', 'top', 'bottom'];
const MAP_SIZES: MapSize[] = ['small', 'normal', 'large'];
const QUEST_MODES: QuestMode[] = ['full', 'current', 'off'];

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
    bagWindow: bool(o['bagWindow'], d.bagWindow),
    tutorial: bool(o['tutorial'], d.tutorial),
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
    resolution: pick(o['resolution'], RESOLUTIONS, d.resolution),
    shadows: pick(o['shadows'], SHADOWS, d.shadows),
    outlines: pick(o['outlines'], OUTLINES, d.outlines),
    groundDetail: pick(o['groundDetail'], DETAILS, d.groundDetail),
    resSettled:
      typeof o['resSettled'] === 'number' && o['resSettled'] >= 1 && o['resSettled'] <= 3
        ? o['resSettled']
        : d.resSettled,
    autoDrop: Math.round(num(o['autoDrop'], d.autoDrop, 0, 2)),
    reminders: bool(o['reminders'], d.reminders),
    life: bool(o['life'], d.life),
    fps: bool(o['fps'], d.fps),
    hudOn: bool(o['hudOn'], d.hudOn),
    stats: bool(o['stats'], d.stats),
    statsAt: pick(o['statsAt'], STATS_AT, d.statsAt),
    clock: bool(o['clock'], d.clock),
    minimap: bool(o['minimap'], d.minimap),
    mapSize: pick(o['mapSize'], MAP_SIZES, d.mapSize),
    mapTurn: bool(o['mapTurn'], d.mapTurn),
    quests: pick(o['quests'], QUEST_MODES, d.quests),
    hudScale: num(o['hudScale'], d.hudScale, 80, 140),
    hudOpacity: num(o['hudOpacity'], d.hudOpacity, 40, 100),
    keyHints: bool(o['keyHints'], d.keyHints),
    buildSnap: bool(o['buildSnap'], d.buildSnap),
    buildGrid: BUILD_GRIDS.includes(o['buildGrid'] as number)
      ? (o['buildGrid'] as number)
      : d.buildGrid,
    buildGridShow: bool(o['buildGridShow'], d.buildGridShow),
  };
}

export interface GraphicsLevel {
  /** Highest device pixel ratio drawn (Resolution: Auto). */
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
  /** Sun shadow map size in pixels (0 = no shadows). */
  shadows: number;
  /** Ground detail: 1 = one texture read a pixel, 2 = full. */
  ground: number;
  /** Texture filtering of the ground at a slant (anisotropy; capped by the device). */
  anisotropy: number;
  /** Ink lines round what stands on the island. */
  outlines: boolean;
}

const LEVELS: Record<Exclude<Quality, 'auto'>, GraphicsLevel> = {
  low: {
    pixelRatio: 1.5,
    terrain: 2,
    nodes: 2,
    grass: 0,
    fog: 0.8,
    particles: 0.5,
    shadows: 0,
    ground: 1,
    anisotropy: 4,
    outlines: false,
  },
  medium: {
    pixelRatio: 3,
    terrain: 3,
    nodes: 2,
    grass: 180,
    fog: 1,
    particles: 0.8,
    shadows: 2048,
    ground: 2,
    anisotropy: 16,
    outlines: true,
  },
  high: {
    pixelRatio: 3,
    terrain: 3,
    nodes: 2,
    grass: 320,
    fog: 1.1,
    particles: 1,
    shadows: 2048,
    ground: 2,
    anisotropy: 16,
    outlines: true,
  },
};

/** Shadow map sizes for the Shadows setting. */
export const SHADOW_SIZES: Record<Exclude<ShadowSetting, 'auto'>, number> = {
  off: 0,
  low: 1024,
  high: 2048,
};

/**
 * What the settings mean on this device: the quality level, with Shadows, Outlines and
 * Ground detail set by hand where they aren't on Auto.
 */
export function graphicsOf(
  s: Pick<Settings, 'quality' | 'autoDrop' | 'shadows' | 'outlines' | 'groundDetail'>,
  touch: boolean,
): GraphicsLevel {
  const g = { ...graphicsFor(s.quality, touch, s.autoDrop) };
  if (s.shadows !== 'auto') g.shadows = SHADOW_SIZES[s.shadows];
  if (s.outlines !== 'auto') g.outlines = s.outlines === 'on';
  if (s.groundDetail === 'low') {
    g.ground = 1;
    g.anisotropy = 4;
  } else if (s.groundDetail === 'high') {
    g.ground = 2;
    g.anisotropy = 16;
  }
  return g;
}

/** Fixed resolutions: the most pixels per screen point each draws. */
const FIXED_RATIO: Record<Exclude<Resolution, 'auto'>, number> = {
  sharp: 3,
  balanced: 2,
  fast: 1.5,
};

/**
 * The pixel ratios the island may be drawn at on a screen with `dpr` pixels per point:
 * fixed for Sharp / Balanced / Fast, and for Auto anything from 1 up to the screen's own
 * (or the quality's cap).
 */
export function resolutionRange(
  res: Resolution,
  dpr: number,
  cap: number,
): { min: number; max: number } {
  const screen = Math.max(1, Math.min(3, dpr || 1));
  if (res !== 'auto') {
    const r = Math.min(screen, FIXED_RATIO[res]);
    return { min: r, max: r };
  }
  const max = Math.max(1, Math.min(screen, cap));
  return { min: Math.min(1, max), max };
}

/**
 * What a quality setting means on this device ('auto': medium on phones, high with a mouse,
 * stepped down `drop` levels on a device that couldn't keep up).
 */
export function graphicsFor(q: Quality, touch: boolean, drop = 0): GraphicsLevel {
  return LEVELS[q === 'auto' ? autoLevel(touch, drop) : q];
}

export function autoLevel(touch: boolean, drop: number): Exclude<Quality, 'auto'> {
  const order = ['low', 'medium', 'high'] as const;
  return order[Math.max(0, (touch ? 1 : 2) - drop)] ?? 'low';
}

/** Auto quality steps down after this long under this frame rate. */
export const SLOW_FPS = 24;
export const SLOW_SECONDS = 12;

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
