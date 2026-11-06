import { describe, expect, it } from 'vitest';
import { RES_SAMPLE, ResolutionGovernor, stepAtOrBelow } from './resolution';

/** Runs `seconds` of frames at `fps`; returns the ratio at the end. */
function run(gov: ResolutionGovernor, fps: number, seconds: number): number {
  let r = gov.ratio;
  const ms = 1000 / fps;
  for (let t = 0; t < seconds * 1000; t += ms) r = gov.frame(ms);
  return r;
}

/** A phone whose frame rate falls as the picture gets sharper: `fpsAt(ratio)`. */
function phone(gov: ResolutionGovernor, fpsAt: (r: number) => number, seconds: number): number {
  for (let t = 0; t < seconds; t += RES_SAMPLE) run(gov, fpsAt(gov.ratio), RES_SAMPLE);
  return gov.ratio;
}

describe('auto resolution', () => {
  it('stays sharp on a phone that keeps up', () => {
    const gov = new ResolutionGovernor(1, 3, 2);
    expect(run(gov, 60, 30)).toBe(3);
  });

  it('eases off until a slow phone runs smoothly, and stays there', () => {
    // 60 fps at 2× and below, slower above it.
    const gov = new ResolutionGovernor(1, 3);
    const fpsAt = (r: number) => (r <= 2 ? 60 : 60 * (2 / r) ** 2);
    expect(phone(gov, fpsAt, 30)).toBe(2);
    expect(phone(gov, fpsAt, 300)).toBeGreaterThanOrEqual(1.75);
    expect(gov.ratio).toBeLessThanOrEqual(2.5);
  });

  it('takes a step back when a softer picture is no faster (a 30 fps cap)', () => {
    const gov = new ResolutionGovernor(1, 3);
    expect(phone(gov, () => 30, 60)).toBe(3);
  });

  it('keeps fixed resolutions fixed', () => {
    const gov = new ResolutionGovernor(2, 2);
    expect(run(gov, 20, 30)).toBe(2);
  });

  it('works with screens between steps', () => {
    expect(stepAtOrBelow(2.75)).toBe(2.5);
    const gov = new ResolutionGovernor(1, 2.75);
    expect(gov.ratio).toBe(2.75);
    const fpsAt = (r: number) => (r <= 2.5 ? 60 : 40);
    expect(phone(gov, fpsAt, 6)).toBe(2.5);
  });

  it('ignores stalls', () => {
    const gov = new ResolutionGovernor(1, 3);
    for (let i = 0; i < 20; i++) gov.frame(900);
    expect(gov.ratio).toBe(3);
  });
});
