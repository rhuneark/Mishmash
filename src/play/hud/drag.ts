// Drag and drop for item slots (mouse and touch): hotbar, bag, quick panel and
// storage boxes. Slots carry data-slot="inv:3" / "box:0"; dropping on the
// game view itself drops the item on the ground.

import type { PointerEvent as ReactPointerEvent } from 'react';
import { toLocal } from '../screen';

export interface SlotRef {
  area: 'inv' | 'box';
  index: number;
}

export type DropTarget = SlotRef | 'ground';

export interface DragState {
  from: SlotRef;
  id: string;
  n: number;
  x: number;
  y: number;
  over: DropTarget | null;
}

let state: DragState | null = null;
let endedAt = 0;
const subs = new Set<() => void>();

function notify(): void {
  for (const cb of subs) cb();
}

export const drag = {
  get: (): DragState | null => state,
  subscribe(cb: () => void): () => void {
    subs.add(cb);
    return () => subs.delete(cb);
  },
  /** A drag just ended: swallow the click the browser sends after it. */
  justEnded: (): boolean => performance.now() - endedAt < 250,
};

export function slotKey(ref: SlotRef): string {
  return `${ref.area}:${ref.index}`;
}

function targetAt(x: number, y: number): DropTarget | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return null;
  const slot = el.closest<HTMLElement>('[data-slot]');
  const key = slot?.dataset['slot'];
  if (key) {
    const [area, i] = key.split(':');
    if ((area === 'inv' || area === 'box') && i !== undefined) return { area, index: Number(i) };
  }
  if (el.classList.contains('game-canvas') || el.classList.contains('joy-zone')) return 'ground';
  return null;
}

/**
 * pointerdown on a slot: a press that moves a few pixels becomes a drag; `onDrop` gets the
 * slot or 'ground' it was let go over. A plain tap stays a click.
 */
export function startSlotDrag(
  e: ReactPointerEvent,
  from: SlotRef,
  item: { id: string; n: number } | null,
  onDrop: (from: SlotRef, to: DropTarget) => void,
): void {
  if (!item || e.button !== 0) return;
  const pid = e.pointerId;
  const sx = e.clientX;
  const sy = e.clientY;
  let dragging = false;
  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== pid) return;
    if (!dragging) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 7) return;
      dragging = true;
    }
    ev.preventDefault();
    // The ghost lives inside the (maybe turned) game; hit-testing uses screen points.
    const at = toLocal(ev.clientX, ev.clientY);
    state = {
      from,
      id: item.id,
      n: item.n,
      x: at.x,
      y: at.y,
      over: targetAt(ev.clientX, ev.clientY),
    };
    notify();
  };
  const end = (ev: PointerEvent) => {
    if (ev.pointerId !== pid) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    if (!dragging) return;
    const to = ev.type === 'pointerup' ? targetAt(ev.clientX, ev.clientY) : null;
    state = null;
    endedAt = performance.now();
    notify();
    if (to) onDrop(from, to);
  };
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}
