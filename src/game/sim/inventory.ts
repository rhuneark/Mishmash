// Inventory: a fixed array of slots; the first HOTBAR slots are the hotbar.

import { ITEMS } from '../content/items';
import type { Slot } from './protocol';

export const INV_SIZE = 24;
export const HOTBAR = 6;

export type Inv = (Slot | null)[];

export function emptyInv(): Inv {
  return new Array<Slot | null>(INV_SIZE).fill(null);
}

export function stackOf(id: string): number {
  return ITEMS[id]?.stack ?? 1;
}

export function count(inv: Inv, id: string): number {
  let n = 0;
  for (const s of inv) if (s && s.id === id) n += s.n;
  return n;
}

export function hasAll(inv: Inv, needs: Record<string, number>): boolean {
  return Object.entries(needs).every(([id, n]) => count(inv, id) >= n);
}

/** Adds items (stacking first); returns how many didn't fit. */
export function add(inv: Inv, id: string, n: number, d?: number): number {
  const max = stackOf(id);
  const durable = ITEMS[id]?.durability !== undefined;
  let left = n;
  if (!durable) {
    for (const s of inv) {
      if (left <= 0) break;
      if (s && s.id === id && s.n < max) {
        const k = Math.min(max - s.n, left);
        s.n += k;
        left -= k;
      }
    }
  }
  for (let i = 0; i < inv.length && left > 0; i++) {
    if (inv[i]) continue;
    const k = durable ? 1 : Math.min(max, left);
    const slot: Slot = { id, n: k };
    if (durable) slot.d = d ?? ITEMS[id]?.durability;
    inv[i] = slot;
    left -= k;
  }
  return left;
}

/** Can all of these fit at once? */
export function fits(inv: Inv, items: { id: string; n: number }[]): boolean {
  const copy = inv.map((s) => (s ? { ...s } : null));
  return items.every((it) => add(copy, it.id, it.n) === 0);
}

/** Removes n of an item (from the back, so hotbar picks stay put); false if short. */
export function remove(inv: Inv, id: string, n: number): boolean {
  if (count(inv, id) < n) return false;
  let left = n;
  for (let i = inv.length - 1; i >= 0 && left > 0; i--) {
    const s = inv[i];
    if (!s || s.id !== id) continue;
    const k = Math.min(s.n, left);
    s.n -= k;
    left -= k;
    if (s.n <= 0) inv[i] = null;
  }
  return true;
}

export function removeAll(inv: Inv, needs: Record<string, number>): boolean {
  if (!hasAll(inv, needs)) return false;
  for (const [id, n] of Object.entries(needs)) remove(inv, id, n);
  return true;
}

/** Moves or merges slot `from` onto slot `to` (swap if different items). */
export function moveSlot(inv: Inv, from: number, to: number): void {
  if (from === to || from < 0 || to < 0 || from >= inv.length || to >= inv.length) return;
  const a = inv[from] ?? null;
  const b = inv[to] ?? null;
  if (!a) return;
  if (b && b.id === a.id && b.d === undefined && a.d === undefined) {
    const k = Math.min(stackOf(a.id) - b.n, a.n);
    b.n += k;
    a.n -= k;
    if (a.n <= 0) inv[from] = null;
    return;
  }
  inv[from] = b;
  inv[to] = a;
}

/** Uses one point of durability from a slot; returns true if it broke. */
export function wear(inv: Inv, slot: number, amount = 1): boolean {
  const s = inv[slot];
  if (!s || s.d === undefined) return false;
  s.d -= amount;
  if (s.d > 0) return false;
  s.n -= 1;
  if (s.n <= 0) inv[slot] = null;
  else s.d = ITEMS[s.id]?.durability;
  return true;
}

/** A valid, cleaned inventory from untrusted data (saves, other players). */
export function cleanInv(data: unknown): Inv {
  const inv = emptyInv();
  if (!Array.isArray(data)) return inv;
  for (let i = 0; i < Math.min(INV_SIZE, data.length); i++) {
    const s = data[i] as Partial<Slot> | null;
    if (!s || typeof s.id !== 'string' || !ITEMS[s.id] || typeof s.n !== 'number') continue;
    const n = Math.max(1, Math.min(stackOf(s.id), Math.floor(s.n)));
    const slot: Slot = { id: s.id, n };
    const max = ITEMS[s.id]?.durability;
    if (max !== undefined) slot.d = typeof s.d === 'number' && s.d > 0 ? Math.min(max, s.d) : max;
    inv[i] = slot;
  }
  return inv;
}
