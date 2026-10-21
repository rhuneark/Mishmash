import { useEffect, useState } from 'react';
import * as run from './sdk/run';
import { SAVE_KEY, parseSave, recordVisit, type SaveData } from './game/save';
import { Logo } from './ui/Logo';
import { Intro } from './screens/Intro';
import { Vote } from './screens/Vote';
import { Chat } from './screens/Chat';

type Tab = 'vote' | 'chat' | 'about';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'vote', icon: '🗳️', label: 'Vote' },
  { id: 'chat', icon: '💬', label: 'Chat' },
  { id: 'about', icon: '❓', label: 'About' },
];

export default function App() {
  const [save, setSave] = useState<SaveData | null>(null);
  const [tab, setTab] = useState<Tab>('vote');

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
        <Intro first onVote={() => go('vote')} onChat={() => go('chat')} />
      </div>
    );
  }

  return (
    <div className="app">
      <main className="tab-body">
        {tab === 'vote' && <Vote onChat={() => setTab('chat')} />}
        {tab === 'chat' && <Chat />}
        {tab === 'about' && <Intro onVote={() => setTab('vote')} onChat={() => setTab('chat')} />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? ' active' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
