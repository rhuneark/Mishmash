import { useEffect, useState } from 'react';
import * as run from './sdk/run';
import { SAVE_KEY, parseSave, recordVisit, type SaveData } from './game/save';

const LETTERS = 'MISHMASH'.split('');

// Placeholder screen until the game exists: it shows the name and proves the
// save round-trip works in the RUN host (the visit count goes up on each open).
export default function App() {
  const [save, setSave] = useState<SaveData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = recordVisit(parseSave(await run.getItem(SAVE_KEY)));
      if (cancelled) return;
      setSave(next);
      void run.setItem(SAVE_KEY, JSON.stringify(next));
      run.track('app_loaded', { visits: next.visits });
      run.funnel(1, 'app_loaded');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app">
      <main className="screen">
        <h1 className="wordmark" aria-label="Mishmash">
          {LETTERS.map((letter, i) => (
            <span key={i} className={`tile tile-${i % 4}`} aria-hidden="true">
              {letter}
            </span>
          ))}
        </h1>
        <p className="tagline">Coming soon</p>
        <p className="status">
          {save ? `Opened ${save.visits} ${save.visits === 1 ? 'time' : 'times'}` : 'Loading…'}
          {run.isMock() ? ' · local preview' : ''}
        </p>
      </main>
    </div>
  );
}
