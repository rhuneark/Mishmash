import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { box } from './geo';
import { repaintGeometry } from './paint';
import { STYLE_PAINT, TIMBER, flameMap } from '../../game/paints';

const colorsOf = (g: THREE.BufferGeometry) =>
  Array.from((g.getAttribute('color') as THREE.BufferAttribute).array as Float32Array);

describe('painting', () => {
  it('repaints the colours of a style, keeping each face’s shade, and leaves the rest', () => {
    const wood = box(1, 1, 1, TIMBER);
    const painted = repaintGeometry(wood, STYLE_PAINT['cabin']!);
    expect(painted).not.toBe(wood);
    const want = new THREE.Color(STYLE_PAINT['cabin']![TIMBER]!);
    const before = colorsOf(wood);
    const after = colorsOf(painted);
    // Same shade per face: after / want == before / timber.
    const t = new THREE.Color(TIMBER);
    expect(after[0]! / want.r).toBeCloseTo(before[0]! / t.r, 4);
    expect(after[1]! / want.g).toBeCloseTo(before[1]! / t.g, 4);
    // The original isn't touched (models share cached geometry).
    expect(colorsOf(wood)).toEqual(before);
    const brass = box(1, 1, 1, 0xd0c060);
    expect(repaintGeometry(brass, STYLE_PAINT['cabin']!)).toBe(brass);
  });

  it('has a full paint for every style and every flame', () => {
    const keys = Object.keys(STYLE_PAINT['outpost']!);
    for (const style of ['driftwood', 'cabin'])
      expect(Object.keys(STYLE_PAINT[style]!).sort()).toEqual([...keys].sort());
    expect(flameMap('fire')).toBeNull();
    for (const f of ['blue', 'green', 'violet', 'white']) expect(flameMap(f)).not.toBeNull();
  });
});
