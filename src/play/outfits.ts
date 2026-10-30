// The outfit the player wears (game/outfits.ts) and the shop sets they own: the look is
// kept in appStorage and goes to every island in `hello`; owned sets come from RUN's
// entitlements (mirrored in appStorage, so the wardrobe shows them offline too). Buying
// a set uses one idempotency key per intended purchase, so a retry never charges twice.

import * as run from '../sdk/run';
import { DEFAULT_LOOK, lookCode, parseLook, wearable, type Look } from '../game/outfits';
import { SETS, packGrants, type Pack } from '../game/shop';
import { recordsStore } from './records';

const LOOK_KEY = 'mishmash_look';
const OWNED_KEY = 'mishmash_outfits';

let look: Look = { ...DEFAULT_LOOK };
let owned: ReadonlySet<string> = new Set();
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
let snap = { look, owned };

function notify(): void {
  snap = { look, owned };
  for (const cb of listeners) cb();
}

export const outfitStore = {
  get: () => snap,
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

export function loadOutfits(): Promise<void> {
  loaded ??= (async () => {
    look = parseLook(await run.getItem(LOOK_KEY));
    try {
      const raw = await run.getItem(OWNED_KEY);
      const list: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list))
        owned = new Set(list.filter((s): s is string => (SETS as readonly string[]).includes(s)));
    } catch {
      owned = new Set();
    }
    notify();
    void syncOwned();
  })();
  return loaded;
}

/** What to wear on an island now (anything not the player's any more comes off). */
export function wornLook(): string {
  return lookCode(wearable(look, recordsStore.get(), owned));
}

export function wear(next: Look): void {
  look = { ...next };
  void run.setItem(LOOK_KEY, lookCode(look));
  run.track('outfit_wear', { hat: look.hat, coat: look.coat });
  notify();
}

/** The sets RUN says the player owns (kept as they were when it can't be reached). */
export async function syncOwned(): Promise<void> {
  const list = await run.listOwned();
  if (!list) return;
  const next = new Set(
    list
      .filter((o) => o.quantity > 0 && (SETS as readonly string[]).includes(o.id))
      .map((o) => o.id),
  );
  if ([...next].sort().join() === [...owned].sort().join()) return;
  owned = next;
  void run.setItem(OWNED_KEY, JSON.stringify([...owned]));
  notify();
}

const keys = new Map<string, string>();

function newKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

export async function buyPack(pack: Pack): Promise<run.PurchaseOutcome> {
  const key = keys.get(pack.id) ?? newKey();
  keys.set(pack.id, key);
  run.track('shop_item_click_purchase', { item_id: pack.id, price: pack.bits });
  const outcome = await run.shopPurchase(pack.id, key, packGrants(pack));
  // A pending or failed attempt keeps its key: retrying it can't charge twice.
  if (outcome === 'done' || outcome === 'cancelled') keys.delete(pack.id);
  if (outcome === 'done') {
    run.track('shop_purchase_done', { item_id: pack.id, price: pack.bits });
    await syncOwned();
  }
  return outcome;
}
