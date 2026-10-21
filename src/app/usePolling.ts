import { useEffect, useRef } from 'react';

/**
 * Runs `task` now and then every `everyMs` while the page is visible (paused
 * in the background, run again on return). The task may return a delay in ms
 * to use once instead, e.g. a server's rate-limit wait.
 */
export function usePolling(task: () => Promise<number | void>, everyMs: number): void {
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (ms: number) => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => void tick(), ms);
    };
    const tick = async () => {
      timer = undefined;
      if (stopped || running) return;
      if (document.visibilityState === 'hidden') return;
      running = true;
      let next: number | void = undefined;
      try {
        next = await taskRef.current();
      } catch {
        // tasks report their own failures; keep polling
      }
      running = false;
      if (!stopped) schedule(typeof next === 'number' && next > 0 ? next : everyMs);
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || running) return;
      if (timer !== undefined) clearTimeout(timer);
      void tick();
    };

    void tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [everyMs]);
}
