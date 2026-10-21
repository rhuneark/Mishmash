// The only module that talks to the RUN SDK. Every call waits for the SDK to
// finish starting, and every failure is caught here: callers get null/false
// instead of a rejection (an unhandled rejection crashes the RUN host).

import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

const READY_TIMEOUT_MS = 8000;

let readyPromise: Promise<boolean> | null = null;
let isReady = false;

function warn(label: string, err: unknown): void {
  try {
    console.warn(`[run] ${label}:`, err);
  } catch {
    // console can't fail in practice; stay defensive
  }
}

/** Resolves true once the SDK has started (false if it timed out or failed). Never rejects. */
export function ready(): Promise<boolean> {
  if (!readyPromise) {
    readyPromise = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), READY_TIMEOUT_MS);
      let init: Promise<unknown>;
      try {
        init = RundotGameAPI.initializeAsync();
      } catch (err) {
        warn('init', err);
        clearTimeout(timer);
        resolve(false);
        return;
      }
      init.then(
        () => {
          clearTimeout(timer);
          isReady = true;
          resolve(true);
        },
        (err) => {
          warn('init', err);
          clearTimeout(timer);
          resolve(false);
        },
      );
    });
  }
  return readyPromise;
}

/** Run an SDK call after start-up; any throw or rejection becomes `fallback`. */
async function call<T>(label: string, fallback: T, fn: () => Promise<T> | T): Promise<T> {
  await ready();
  try {
    return await fn();
  } catch (err) {
    warn(label, err);
    return fallback;
  }
}

/** Fire-and-forget variant for calls whose result we don't need. */
function fire(label: string, fn: () => unknown): void {
  void call(label, undefined, async () => {
    await fn();
  });
}

// Last-resort net: a missed rejection must not crash the host.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    warn('unhandled rejection', event.reason);
    event.preventDefault();
  });
}

// ---------------------------------------------------------------------------
// Environment.

/** True outside the RUN host (local `npm run dev`), where the SDK is mocked. */
export function isMock(): boolean {
  try {
    return RundotGameAPI.isMock();
  } catch {
    return true;
  }
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Safe-area insets. Only meaningful after ready(); zeros before. */
export function safeArea(): Insets {
  if (!isReady) return { top: 0, right: 0, bottom: 0, left: 0 };
  try {
    const s = RundotGameAPI.system.getSafeArea();
    return { top: s.top || 0, right: s.right || 0, bottom: s.bottom || 0, left: s.left || 0 };
  } catch (err) {
    warn('safeArea', err);
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
}

/** Player's font scale preference (1 = default). */
export function fontScale(): number {
  if (!isReady) return 1;
  try {
    const fs = RundotGameAPI.system.getDevice().fontScale;
    return typeof fs === 'number' && fs > 0 ? Math.min(1.6, fs) : 1;
  } catch {
    return 1;
  }
}

// ---------------------------------------------------------------------------
// Storage (appStorage: per game, per player, cloud-synced). Browser storage is
// blocked inside the RUN host, so saves go through here.

export async function getItem(key: string): Promise<string | null> {
  return call('getItem', null, () => RundotGameAPI.appStorage.getItem(key));
}

/** Coalescing writer: keeps only the newest value per key while a write is in flight. */
const pending = new Map<string, string>();
const writing = new Set<string>();

export function setItem(key: string, value: string): Promise<boolean> {
  pending.set(key, value);
  return flush(key);
}

async function flush(key: string): Promise<boolean> {
  if (writing.has(key)) return true;
  writing.add(key);
  let ok = true;
  try {
    while (pending.has(key)) {
      const value = pending.get(key) as string;
      pending.delete(key);
      ok = await call('setItem', false, async () => {
        await RundotGameAPI.appStorage.setItem(key, value);
        return true;
      });
    }
  } finally {
    writing.delete(key);
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Analytics and lifecycle.

export function track(event: string, payload?: Record<string, string | number | boolean>): void {
  fire('analytics', () => RundotGameAPI.analytics.recordCustomEvent(event, payload));
}

export function funnel(step: number, name: string): void {
  fire('funnel', () => RundotGameAPI.analytics.trackFunnelStep(step, name, 'first_session', 1));
}

export interface LifecycleHandlers {
  pause?: () => void;
  resume?: () => void;
  sleep?: () => void;
  quit?: () => void;
}

/** Subscribes to host lifecycle events (each one is also tracked). */
export function onLifecycle(handlers: LifecycleHandlers): void {
  const hook = (label: keyof LifecycleHandlers, subscribe: (cb: () => void) => unknown) => {
    try {
      subscribe(() => {
        track(`game_${label}`);
        try {
          handlers[label]?.();
        } catch (err) {
          warn(label, err);
        }
      });
    } catch (err) {
      warn(`on ${label}`, err);
    }
  };
  hook('pause', (cb) => RundotGameAPI.lifecycles.onPause(cb));
  hook('resume', (cb) => RundotGameAPI.lifecycles.onResume(cb));
  hook('sleep', (cb) => RundotGameAPI.lifecycles.onSleep(cb));
  hook('quit', (cb) => RundotGameAPI.lifecycles.onQuit(cb));
}
