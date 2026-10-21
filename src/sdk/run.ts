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
// Player identity.

/** This player's profile id ('' when unknown, e.g. before start-up). */
export function myId(): string {
  try {
    const id = RundotGameAPI.getProfile().id;
    return typeof id === 'string' && id !== 'unknown-user' ? id : '';
  } catch {
    return '';
  }
}

export function myName(): string {
  try {
    return RundotGameAPI.getProfile().username || 'Player';
  } catch {
    return 'Player';
  }
}

/** Shows RUN's sign-in sheet; true once signed in. */
export async function promptLogin(): Promise<boolean> {
  return call('promptLogin', false, async () => {
    const res = await RundotGameAPI.accessGate.promptLogin();
    return Boolean(res?.success);
  });
}

// ---------------------------------------------------------------------------
// UGC (rundot/ugc.config.json): community posts other players can see. Only
// works inside the RUN host; the mock SDK can't store entries, so local dev
// uses src/app/localUgc.ts instead. Rows come from other players: callers must
// validate `data`.

export type UgcFail = 'login' | 'rate' | 'flagged' | 'full' | 'error';

export type UgcResult<T> =
  { ok: true; value: T } | { ok: false; reason: UgcFail; retryAfterMs?: number };

export interface UgcRow {
  id: string;
  contentType: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  status: string;
  data: unknown;
}

export interface UgcPage {
  rows: UgcRow[];
  next?: string;
}

export interface UgcBrowse {
  types: readonly string[];
  authorId?: string;
  limit?: number;
  cursor?: string;
}

/** The community backend: RUN's UGC here, a local stand-in in dev (same contract). */
export interface UgcApi {
  /** The current player's author id ('' when unknown). */
  me(): string;
  create(contentType: string, data: Record<string, unknown>): Promise<UgcResult<UgcRow>>;
  /** Newest first. */
  browse(q: UgcBrowse): Promise<UgcResult<UgcPage>>;
  remove(id: string): Promise<boolean>;
  count(contentType: string): Promise<number | null>;
  report(id: string): Promise<boolean>;
  /** False when RUN's text filter would reject it (fails open). */
  isClean(text: string): Promise<boolean>;
}

function failOf(err: unknown): { reason: UgcFail; retryAfterMs?: number } {
  const e = (err ?? {}) as {
    code?: unknown;
    name?: unknown;
    message?: unknown;
    retryAfterMs?: unknown;
  };
  if (e.code === 'RATE_LIMITED' || e.name === 'RateLimitedError') {
    return {
      reason: 'rate',
      retryAfterMs: typeof e.retryAfterMs === 'number' ? e.retryAfterMs : undefined,
    };
  }
  if (e.name === 'AccessDeniedError') return { reason: 'login' };
  const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  if (/moderat|profan|inappropriate|flagged/.test(msg)) return { reason: 'flagged' };
  if (/max(imum)? entries|entry limit|too many entries|quota/.test(msg)) return { reason: 'full' };
  return { reason: 'error' };
}

function rowOf(e: {
  id?: unknown;
  contentType?: unknown;
  authorId?: unknown;
  authorName?: unknown;
  createdAt?: unknown;
  status?: unknown;
  data?: unknown;
}): UgcRow | null {
  if (!e || typeof e.id !== 'string') return null;
  return {
    id: e.id,
    contentType: typeof e.contentType === 'string' ? e.contentType : '',
    authorId: typeof e.authorId === 'string' ? e.authorId : '',
    authorName: typeof e.authorName === 'string' ? e.authorName : '',
    createdAt: typeof e.createdAt === 'number' ? e.createdAt : 0,
    status: typeof e.status === 'string' ? e.status : 'active',
    data: e.data,
  };
}

async function attempt<T>(label: string, fn: () => Promise<T>): Promise<UgcResult<T>> {
  await ready();
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    warn(label, err);
    return { ok: false, ...failOf(err) };
  }
}

export const ugc: UgcApi = {
  me: myId,

  create: (contentType, data) =>
    attempt('ugc.create', async () => {
      const row = rowOf(await RundotGameAPI.ugc.create({ contentType, data, isPublic: true }));
      if (!row) throw new Error('bad create response');
      return row;
    }),

  browse: (q) =>
    attempt('ugc.browse', async () => {
      const types = [...q.types];
      const res = await RundotGameAPI.ugc.browse({
        contentType: types.length === 1 ? types[0] : types,
        authorId: q.authorId,
        sortBy: 'recent',
        sortOrder: 'desc',
        limit: q.limit ?? 30,
        cursor: q.cursor,
      });
      const rows = (res?.entries ?? []).map(rowOf).filter((r): r is UgcRow => r !== null);
      return { rows, next: res?.nextCursor || undefined };
    }),

  remove: (id) =>
    call('ugc.remove', false, async () => {
      await RundotGameAPI.ugc.delete(id);
      return true;
    }),

  count: (contentType) =>
    call('ugc.count', null, async () => {
      const res = await RundotGameAPI.ugc.count({ contentType });
      return typeof res?.count === 'number' ? res.count : null;
    }),

  report: (id) =>
    call('ugc.report', false, async () => {
      await RundotGameAPI.ugc.report({ id, reason: 'inappropriate' });
      return true;
    }),

  isClean: (text) =>
    call('ugc.checkText', true, async () => {
      const res = await RundotGameAPI.ugc.checkTextAsync(text);
      return res?.clean !== false;
    }),
};

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
