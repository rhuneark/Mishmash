// Host lifecycle events (pause, resume, sleep, quit) for whoever is listening.

import type { LifecycleHandlers } from '../sdk/run';

const listeners = new Set<LifecycleHandlers>();

export const appEvents = {
  on(h: LifecycleHandlers): () => void {
    listeners.add(h);
    return () => listeners.delete(h);
  },
  emit(name: keyof LifecycleHandlers): void {
    for (const h of listeners) h[name]?.();
  },
};
