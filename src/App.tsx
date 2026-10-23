import { useCallback, useEffect, useState } from 'react';
import * as run from './sdk/run';
import { SAVE_KEY, parseSave, recordVisit, type SaveData } from './game/save';
import { isOwner, openReportCount } from './app/community';
import { usePolling } from './app/usePolling';
import { Logo } from './ui/Logo';
import { Intro } from './screens/Intro';
import { Vote } from './screens/Vote';
import { Dev } from './screens/Dev';
import { SubPage } from './ui/SubPage';
import { Play, type PlayChoice } from './screens/Play';
import { Game } from './play/Game';
import type { GameClient } from './play/client';
import { FAIL_TEXT, startHost, startJoin, startSolo } from './play/session';

/** The title screen, or a page opened from it (each has a back button). */
type Screen = 'play' | 'vote' | 'dev';

const REPORT_CHECK_MS = 5 * 60_000;

export default function App() {
  const [save, setSave] = useState<SaveData | null>(null);
  const [screen, setScreen] = useState<Screen>('play');
  const [game, setGame] = useState<GameClient | null>(null);
  const [starting, setStarting] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  // The Dev area only exists for the game's owner (RUN checks the account).
  const [owner, setOwner] = useState(false);
  const [openReports, setOpenReports] = useState(0);
  // The win screen's "New island" lands on the New island screen.
  const [wantNew, setWantNew] = useState(false);

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
    void isOwner().then((yes) => !cancelled && setOwner(yes));
    return () => {
      cancelled = true;
    };
  }, []);

  const clearWantNew = useCallback(() => setWantNew(false), []);

  const commit = (next: SaveData) => {
    setSave(next);
    void run.setItem(SAVE_KEY, JSON.stringify(next));
  };

  const go = (next: Screen) => {
    if (save && !save.introSeen) {
      commit({ ...save, introSeen: true });
      run.track('intro_done', { to: next });
      run.funnel(2, 'intro_done');
    }
    setScreen(next);
  };

  const start = async (choice: PlayChoice) => {
    setPlayError(null);
    setStarting(true);
    const res =
      choice.kind === 'solo'
        ? await startSolo(choice.fresh)
        : choice.kind === 'host'
          ? await startHost()
          : await startJoin(choice.code);
    setStarting(false);
    if (!res.ok) {
      setPlayError(FAIL_TEXT[res.reason]);
      setScreen('play');
      return;
    }
    setGame(res.client);
  };

  const leave = async () => {
    const g = game;
    setGame(null);
    setStarting(true);
    await g?.close();
    setStarting(false);
  };

  if (game) {
    return (
      <div className="app game-app">
        <Game
          client={game}
          onLeave={() => void leave()}
          onHost={() => void leave().then(() => start({ kind: 'host' }))}
          onNewIsland={() =>
            void leave().then(() => {
              setWantNew(true);
              setScreen('play');
            })
          }
        />
      </div>
    );
  }

  if (starting) {
    return (
      <div className="app">
        <div className="game-loading">
          <div className="loading-island">🏝️</div>
          <div className="loading-text">Getting the island ready…</div>
        </div>
      </div>
    );
  }

  if (!save) {
    return (
      <div className="app">
        <main className="loading">
          <Logo />
        </main>
      </div>
    );
  }

  if (!save.introSeen) {
    return (
      <div className="app">
        <Intro onPlay={() => go('play')} onVote={() => go('vote')} />
      </div>
    );
  }

  return (
    <div className="app">
      {owner && <ReportWatch onCount={setOpenReports} />}
      <main className="tab-body">
        {screen === 'play' && (
          <Play
            onStart={(c) => void start(c)}
            onVote={() => setScreen('vote')}
            onDev={owner ? () => setScreen('dev') : undefined}
            openReports={openReports}
            error={playError}
            newIsland={wantNew}
            onNewIslandShown={clearWantNew}
          />
        )}
        {screen === 'vote' && (
          <SubPage title="🗳️ Vote on updates" onBack={() => setScreen('play')}>
            <Vote />
          </SubPage>
        )}
        {screen === 'dev' && owner && (
          <SubPage title="🛠️ Dev" onBack={() => setScreen('play')}>
            <Dev onOpenCount={setOpenReports} />
          </SubPage>
        )}
      </main>
    </div>
  );
}

/** Keeps the Dev area's open-report count fresh (owner only). */
function ReportWatch({ onCount }: { onCount: (n: number) => void }) {
  usePolling(async () => {
    const n = await openReportCount();
    if (n !== null) onCount(n);
  }, REPORT_CHECK_MS);
  return null;
}
