import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import * as run from './sdk/run';
import { SAVE_KEY, parseSave, recordVisit, type SaveData } from './game/save';
import { isOwner, newSuggestionCount, openReportCount } from './app/community';
import { usePolling } from './app/usePolling';
import { Logo } from './ui/Logo';
import { Intro } from './screens/Intro';
import { Suggest } from './screens/Suggest';
import { SubPage } from './ui/SubPage';
import { DailyLine, Loading, Play, type PlayChoice } from './screens/Play';
import type { GameClient } from './play/client';
import { chooseSlot } from './play/slots';
import { LATEST, unseenNews } from './game/news';
import { loadRecords } from './play/records';
import { planReminders } from './play/remind';
import { loadOutfits } from './play/outfits';

// The game and the bigger pages load when first needed (the game also in the background a
// few seconds after the title shows), so the title comes up sooner.
const loadGame = () => Promise.all([import('./play/session'), import('./play/Game')]);
const Game = lazy(() => import('./play/Game').then((m) => ({ default: m.Game })));
const Dev = lazy(() => import('./screens/Dev').then((m) => ({ default: m.Dev })));
const Records = lazy(() => import('./screens/Records').then((m) => ({ default: m.Records })));
const Wardrobe = lazy(() => import('./screens/Wardrobe').then((m) => ({ default: m.Wardrobe })));
const PRELOAD_MS = 3000;

/** The title screen, or a page opened from it (each has a back button). */
type Screen = 'play' | 'suggest' | 'dev' | 'records' | 'wardrobe';

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
  const [newIdeas, setNewIdeas] = useState(0);
  // The win screen's "New island" lands on the New island screen.
  const [wantNew, setWantNew] = useState(false);
  // Just through the intro: no island yet means straight onto a ready-made one.
  const [quickStart, setQuickStart] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = recordVisit(parseSave(await run.getItem(SAVE_KEY)));
      if (cancelled) return;
      chooseSlot(next.slot);
      setSave(next);
      void loadRecords();
      void loadOutfits();
      // A visit: the next days' reminders start from now.
      planReminders();
      void run.setItem(SAVE_KEY, JSON.stringify(next));
      run.track('app_loaded', { visits: next.visits });
      run.funnel(1, 'app_loaded');
    })();
    void isOwner().then((yes) => !cancelled && setOwner(yes));
    // The title is up: fetch the game while the player looks at it.
    const preload = setTimeout(() => void loadGame().catch(() => undefined), PRELOAD_MS);
    return () => {
      cancelled = true;
      clearTimeout(preload);
    };
  }, []);

  const clearWantNew = useCallback(() => setWantNew(false), []);
  const quickStarted = useCallback(() => setQuickStart(false), []);

  const commit = (next: SaveData) => {
    setSave(next);
    void run.setItem(SAVE_KEY, JSON.stringify(next));
  };

  const go = (next: Screen) => {
    if (save && !save.introSeen) {
      // A new player has nothing to catch up on.
      commit({ ...save, introSeen: true, newsSeen: LATEST.version });
      run.track('intro_done', { to: next });
      run.funnel(2, 'intro_done');
      if (next === 'play') setQuickStart(true);
    }
    setScreen(next);
  };

  const start = async (choice: PlayChoice) => {
    setPlayError(null);
    setStarting(true);
    let session: Awaited<ReturnType<typeof loadGame>>[0];
    try {
      [session] = await loadGame();
    } catch {
      setStarting(false);
      setPlayError("Couldn't load the game. Check your connection and try again.");
      return;
    }
    const res =
      choice.kind === 'solo'
        ? await session.startSolo(choice.fresh)
        : choice.kind === 'host'
          ? await session.startHost(choice.fresh)
          : choice.kind === 'public'
            ? await session.startPublic()
            : await session.startJoin(choice.code);
    setStarting(false);
    if (!res.ok) {
      setPlayError(session.FAIL_TEXT[res.reason]);
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
    planReminders();
  };

  if (game) {
    return (
      <div className="app game-app">
        <Suspense fallback={<GameLoading />}>
          <Game
            client={game}
            onLeave={() => void leave()}
            onHost={() => void leave().then(() => start({ kind: 'host', fresh: null }))}
            onNewIsland={() =>
              void leave().then(() => {
                setWantNew(true);
                setScreen('play');
              })
            }
          />
        </Suspense>
      </div>
    );
  }

  if (starting) {
    return (
      <div className="app">
        <GameLoading />
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
        <Intro onPlay={() => go('play')} onSuggest={() => go('suggest')} />
      </div>
    );
  }

  return (
    <div className="app">
      {owner && <DevWatch onReports={setOpenReports} onIdeas={setNewIdeas} />}
      <main className="tab-body">
        {screen === 'play' && (
          <Play
            onStart={(c) => void start(c)}
            onSuggest={() => setScreen('suggest')}
            onCharacter={() => setScreen('wardrobe')}
            onDev={owner ? () => setScreen('dev') : undefined}
            devCount={openReports + newIdeas}
            error={playError}
            newIsland={wantNew}
            onNewIslandShown={clearWantNew}
            onSlot={(slot) => commit({ ...save, slot })}
            quickStart={quickStart}
            onQuickStarted={quickStarted}
            news={save.visits > 1 ? unseenNews(save.newsSeen) : null}
            onNewsSeen={() => commit({ ...save, newsSeen: LATEST.version })}
          />
        )}
        {screen === 'suggest' && (
          <SubPage title="💡 Suggestions" onBack={() => setScreen('play')}>
            <Suggest />
          </SubPage>
        )}
        {screen === 'records' && (
          <SubPage title="🏆 Records" onBack={() => setScreen('wardrobe')}>
            <Suspense fallback={<Loading />}>
              <Records />
            </Suspense>
          </SubPage>
        )}
        {screen === 'wardrobe' && (
          <SubPage title="👕 Character" onBack={() => setScreen('play')}>
            <div className="character-daily">
              <DailyLine onRecords={() => setScreen('records')} />
            </div>
            <Suspense fallback={<Loading />}>
              <Wardrobe />
            </Suspense>
          </SubPage>
        )}
        {screen === 'dev' && owner && (
          <SubPage title="🛠️ Dev" onBack={() => setScreen('play')}>
            <Suspense fallback={<Loading />}>
              <Dev onOpenCount={setOpenReports} onNewCount={setNewIdeas} />
            </Suspense>
          </SubPage>
        )}
      </main>
    </div>
  );
}

function GameLoading() {
  return (
    <div className="game-loading">
      <div className="loading-island">🏝️</div>
      <div className="loading-text">Getting the island ready…</div>
    </div>
  );
}

/** Keeps the Dev button's count fresh: open reports and new suggestions (owner only). */
function DevWatch({
  onReports,
  onIdeas,
}: {
  onReports: (n: number) => void;
  onIdeas: (n: number) => void;
}) {
  usePolling(async () => {
    const [reports, ideas] = await Promise.all([openReportCount(), newSuggestionCount()]);
    if (reports !== null) onReports(reports);
    if (ideas !== null) onIdeas(ideas);
  }, REPORT_CHECK_MS);
  return null;
}
