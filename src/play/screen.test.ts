import { describe, expect, it } from 'vitest';
import { rotationFor, turnInsets, turnPoint } from './screen';

describe('landscape on phones', () => {
  it('turns only phones held upright that asked for landscape', () => {
    expect(rotationFor('portrait', false, 375, 667, true)).toBe(0);
    expect(rotationFor('landscape', false, 375, 667, true)).toBe(90);
    expect(rotationFor('landscape', true, 375, 667, true)).toBe(-90);
    expect(rotationFor('landscape', false, 667, 375, true)).toBe(0);
    expect(rotationFor('landscape', false, 375, 667, false)).toBe(0);
  });

  it('maps screen corners onto the turned game', () => {
    // Turned clockwise: the game is 667 wide and 375 tall; its top-left sits at the
    // screen's top-right.
    expect(turnPoint(375, 0, 90, 375, 667)).toEqual({ x: 0, y: 0 });
    expect(turnPoint(375, 667, 90, 375, 667)).toEqual({ x: 667, y: 0 });
    expect(turnPoint(0, 0, 90, 375, 667)).toEqual({ x: 0, y: 375 });
    // Anticlockwise: its top-left sits at the screen's bottom-left.
    expect(turnPoint(0, 667, -90, 375, 667)).toEqual({ x: 0, y: 0 });
    expect(turnPoint(0, 0, -90, 375, 667)).toEqual({ x: 667, y: 0 });
    expect(turnPoint(10, 20, 0, 375, 667)).toEqual({ x: 10, y: 20 });
  });

  it('moves the safe areas round with the game', () => {
    const i = { top: 44, right: 0, bottom: 34, left: 0 };
    expect(turnInsets(i, 90)).toEqual({ top: 0, right: 34, bottom: 0, left: 44 });
    expect(turnInsets(i, -90)).toEqual({ top: 0, right: 44, bottom: 0, left: 34 });
    expect(turnInsets(i, 0)).toBe(i);
  });
});
