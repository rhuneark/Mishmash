import { useCallback, useEffect, useState } from 'react';
import * as run from './sdk/run';
import { SAVE_KEY, parseSave, recordVisit, type SaveData } from './game/save';
import { isOwner, openReportCount } from './app/community';
import { usePolling } from './app/usePolling';
import { Logo } from './ui/Logo';
import { Intro } from './screens/Intro';
import { Vote } from './screens/Vote';
import { Chat } from './screens/Chat';
import { Dev } from './screens/Dev';
import { Play, type PlayChoice } from './screens/Play';
import { Game } from './play/Game';
import type { GameClient } from './play/client';
import { FAIL_TEXT, startHost, startJoin, startSolo } from './play/session';

type Tab = 'play' | 'vote' | 'chat' | 'about' | 'dev';

const TABS: { id: Tab; icon: string; label: string; ownerOnly?: boolean }[] = [
  { id: 'play', icon: '🏝️', label: 'Play' },
  { id: 'vote', icon: '🗳️', label: 'Vote' },
  { id: 'chat', icon: '💬', label: 'Chat' },
  { id: 'about', icon: '❓', label: 'About' },
  { id: 'dev', icon: '🛠️', label: 'Dev', ownerOnly: true },
];

const REPORT_CHECK_MS = 5 * 60_000;

export default function App() {
  const [save, setSave] = useState<SaveData | null>(null);
  const [tab, setTab] = useState<Tab>('play');
  const [game, setGame] = useState<GameClient | null>(null);
  const [starting, setStarting] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  // The Dev tab only exists for the game's owner (RUN checks the account).
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

  const go = (next: Tab) => {
    if (save && !save.introSeen) {
      commit({ ...save, introSeen: true });
      run.track('intro_done', { to: next });
      run.funnel(2, 'intro_done');
    }
    setTab(next);
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
      setTab('play');
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
              setTab('play');
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
        <Intro
          first
          onPlay={() => go('play')}
          onVote={() => go('vote')}
          onChat={() => go('chat')}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {owner && <ReportWatch onCount={setOpenReports} />}
      <main className="tab-body">
        {tab === 'play' && (
          <Play
            onStart={(c) => void start(c)}
            onVote={() => setTab('vote')}
            error={playError}
            newIsland={wantNew}
            onNewIslandShown={clearWantNew}
          />
        )}
        {tab === 'vote' && <Vote onChat={() => setTab('chat')} />}
        {tab === 'chat' && <Chat />}
        {tab === 'about' && (
          <Intro
            onPlay={() => setTab('play')}
            onVote={() => setTab('vote')}
            onChat={() => setTab('chat')}
          />
        )}
        {tab === 'dev' && owner && <Dev onOpenCount={setOpenReports} />}
      </main>
      <nav className="tabbar">
        {TABS.filter((t) => owner || !t.ownerOnly).map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? ' active' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon" aria-hidden="true">
              {t.icon}
              {t.id === 'dev' && openReports > 0 && (
                <span className="tab-badge">{openReports > 99 ? '99+' : openReports}</span>
              )}
            </span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/** Keeps the Dev tab's open-report count fresh (owner only). */
function ReportWatch({ onCount }: { onCount: (n: number) => void }) {
  usePolling(async () => {
    const n = await openReportCount();
    if (n !== null) onCount(n);
  }, REPORT_CHECK_MS);
  return null;
}
