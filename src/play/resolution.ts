// Auto resolution: the island is drawn as sharp as the screen allows (up to 3 pixels per
// point), one step softer while the game runs slow and one step sharper again once it runs
// smoothly. A phone held back by something else (a 30 fps battery saver, a busy CPU) gains
// nothing from a softer picture, so a step down that doesn't speed it up is taken back.
// Pure: Game.tsx feeds it frame times and draws at what it says.

/** The pixel ratios it steps between, sharpest first. */
export const RES_STEPS = [3, 2.5, 2, 1.75, 1.5, 1.25, 1];

/** Slower than this (frames a second) for a sample: a step softer. */
export const RES_LOW_FPS = 45;
/** This smooth for `RES_UP_SAMPLES` samples in a row: a step sharper. */
export const RES_HIGH_FPS = 56;
export const RES_UP_SAMPLES = 4;
/** One sample: this many seconds of frames. */
export const RES_SAMPLE = 1.5;
/** A step down has to speed it up this much to stay. */
const GAIN = 1.08;

/** The step at or below `r` (the softest step for anything below it). */
export function stepAtOrBelow(r: number): number {
  return RES_STEPS.find((s) => s <= r + 1e-6) ?? (RES_STEPS[RES_STEPS.length - 1] as number);
}

export class ResolutionGovernor {
  ratio: number;
  private min: number;
  private max: number;
  private ms = 0;
  private frames = 0;
  private smooth = 0;
  /** The step down being tried: where it came from and how fast it ran there. */
  private trial: { from: number; fps: number } | null = null;
  /** No step sharper than `cap` until `capUntil` (seconds of play). */
  private cap = Infinity;
  private capUntil = 0;
  private capFor = 20;
  /** No step softer until then (a step down didn't help: something else holds it back). */
  private holdUntil = 0;
  private holdFps = 0;
  private clock = 0;

  constructor(min: number, max: number, start = max) {
    this.min = min;
    this.max = max;
    this.ratio = this.clamp(start);
  }

  /** New limits (a setting changed): starts again from `start`. */
  setRange(min: number, max: number, start = max): void {
    this.min = min;
    this.max = max;
    this.ratio = this.clamp(start);
    this.reset();
  }

  /**
   * One frame took `ms` milliseconds. Returns the pixel ratio to draw at (it changes only
   * at the end of a sample, at most one step at a time).
   */
  frame(ms: number): number {
    // A stall (loading, a tab switch) says nothing about the picture.
    if (ms > 250) return this.ratio;
    this.ms += ms;
    this.frames++;
    if (this.ms < RES_SAMPLE * 1000) return this.ratio;
    const fps = (this.frames * 1000) / this.ms;
    this.clock += this.ms / 1000;
    this.ms = 0;
    this.frames = 0;
    this.judge(fps);
    return this.ratio;
  }

  private judge(fps: number): void {
    if (this.min >= this.max) return;
    const trial = this.trial;
    if (trial) {
      this.trial = null;
      if (fps < trial.fps * GAIN && fps < RES_LOW_FPS) {
        // Softer didn't help: back to where it was, and leave it there a while.
        this.ratio = trial.from;
        this.holdUntil = this.clock + 60;
        this.holdFps = trial.fps;
        return;
      }
      if (fps < RES_LOW_FPS) {
        this.stepDown(fps);
        return;
      }
    }
    if (fps < RES_LOW_FPS) {
      this.smooth = 0;
      // Held: only a clearly worse frame rate tries again.
      if (this.clock < this.holdUntil && fps > this.holdFps * 0.8) return;
      this.stepDown(fps);
      return;
    }
    if (fps >= RES_HIGH_FPS) {
      this.smooth++;
      const ceiling = this.clock < this.capUntil ? this.cap : Infinity;
      if (this.smooth >= RES_UP_SAMPLES && this.ratio < this.max) {
        const up = this.clamp(this.next(this.ratio, -1));
        if (up <= ceiling) {
          this.ratio = up;
          this.smooth = 0;
        }
      }
    } else this.smooth = 0;
  }

  private stepDown(fps: number): void {
    if (this.ratio <= this.min) return;
    const from = this.ratio;
    this.ratio = this.clamp(this.next(from, 1));
    this.trial = { from, fps };
    // Don't come straight back up past where it was too slow, longer each time.
    this.cap = this.ratio;
    this.capUntil = this.clock + this.capFor;
    this.capFor = Math.min(240, this.capFor * 2);
  }

  /** The next step softer (+1) or sharper (-1) than `r`. */
  private next(r: number, dir: 1 | -1): number {
    const at = stepAtOrBelow(r);
    const i = RES_STEPS.indexOf(at);
    // Between steps (a screen at 2.75): the step below is the next one down.
    if (dir === 1) {
      if (at < r - 1e-6) return at;
      return RES_STEPS[Math.min(RES_STEPS.length - 1, i + 1)] as number;
    }
    return RES_STEPS[Math.max(0, i - 1)] as number;
  }

  private clamp(r: number): number {
    const v = Math.min(this.max, Math.max(this.min, r));
    // On the steps, except the screen's own ratio at the top.
    return v >= this.max - 1e-6 ? this.max : Math.max(this.min, stepAtOrBelow(v));
  }

  private reset(): void {
    this.ms = 0;
    this.frames = 0;
    this.smooth = 0;
    this.trial = null;
    this.cap = Infinity;
    this.capUntil = 0;
    this.capFor = 20;
    this.holdUntil = 0;
  }
}

/** What the island is drawn at right now (for the settings page and the FPS readout). */
export const liveResolution = { ratio: 0 };
