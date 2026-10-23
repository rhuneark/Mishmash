// The player's settings while the app runs: loaded once from appStorage, saved
// shortly after every change, and readable from React (usePrefs).

import { useSyncExternalStore } from 'react';
import * as run from '../sdk/run';
import { DEFAULT_SETTINGS, SETTINGS_KEY, parseSettings, type Settings } from './settings';

let current: Settings = { ...DEFAULT_SETTINGS };
/** Changes made before the saved settings arrived (they win over the saved ones). */
let early: Partial<Settings> = {};
let loading: Promise<Settings> | null = null;
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const subs = new Set<() => void>();

function notify(): void {
  for (const cb of subs) cb();
}

export const prefs = {
  get: (): Settings => current,

  subscribe(cb: () => void): () => void {
    subs.add(cb);
    return () => subs.delete(cb);
  },

  load(): Promise<Settings> {
    loading ??= run
      .getItem(SETTINGS_KEY)
      .then((raw) => {
        let saved: unknown = null;
        try {
          saved = raw ? JSON.parse(raw) : null;
        } catch {
          saved = null;
        }
        current = parseSettings({ ...parseSettings(saved), ...early });
        return current;
      })
      .catch(() => current)
      .finally(() => {
        loaded = true;
        notify();
      });
    return loading;
  },

  set(patch: Partial<Settings>): void {
    if (!loaded) early = { ...early, ...patch };
    current = parseSettings({ ...current, ...patch });
    notify();
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void run.setItem(SETTINGS_KEY, JSON.stringify(current));
    }, 400);
  },

  reset(keys: (keyof Settings)[]): void {
    const patch: Partial<Settings> = {};
    for (const k of keys) (patch as Record<string, unknown>)[k] = DEFAULT_SETTINGS[k];
    prefs.set(patch);
  },
};

export function usePrefs(): Settings {
  return useSyncExternalStore(prefs.subscribe, prefs.get);
}

/** A device with touch and no mouse (phones and tablets). */
export function isTouch(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = !!window.matchMedia?.('(pointer: coarse)').matches;
  const fine = !!window.matchMedia?.('(pointer: fine)').matches;
  return coarse || (!fine && navigator.maxTouchPoints > 0);
}

/** A vibration, when the player wants them. */
export function buzz(style: run.Haptic): void {
  if (current.vibration) run.haptic(style);
}
