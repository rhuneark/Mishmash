// Landscape on phones. RUN keeps the game upright (portrait), so Landscape turns
// the whole game a quarter turn inside the upright screen and the player turns
// the phone to match. Screen points (clientX/Y) then need turning back into the
// game's own coordinates (toLocal), and the safe areas move round with it.

import type { Orientation } from './settings';

/** Degrees the game is turned (clockwise). */
export type Rotation = 0 | 90 | -90;

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** How to turn the game for the setting on a w×h screen (only phones turn). */
export function rotationFor(
  orientation: Orientation,
  flip: boolean,
  w: number,
  h: number,
  touch: boolean,
): Rotation {
  if (!touch || orientation !== 'landscape' || w >= h) return 0;
  return flip ? -90 : 90;
}

/** Screen insets as the turned game sees them. */
export function turnInsets(i: Insets, r: Rotation): Insets {
  if (r === 90) return { top: i.right, right: i.bottom, bottom: i.left, left: i.top };
  if (r === -90) return { top: i.left, right: i.top, bottom: i.right, left: i.bottom };
  return i;
}

/** A screen point in the turned game's coordinates (w×h: the screen). */
export function turnPoint(
  x: number,
  y: number,
  r: Rotation,
  w: number,
  h: number,
): { x: number; y: number } {
  if (r === 90) return { x: y, y: w - x };
  if (r === -90) return { x: h - y, y: x };
  return { x, y };
}

let current: { r: Rotation; w: number; h: number } = { r: 0, w: 0, h: 0 };

/** The game tells us how it's turned (Game.tsx). */
export function setRotation(r: Rotation, w: number, h: number): void {
  current = { r, w, h };
}

/** clientX/clientY → the game's own coordinates. */
export function toLocal(x: number, y: number): { x: number; y: number } {
  return turnPoint(x, y, current.r, current.w, current.h);
}
