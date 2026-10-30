import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { dailyGoal, liveStreak, utcDay } from '../game/daily';
import { recordsStore } from '../play/records';
import {
  CLASSIC,
  JOIN_LEN,
  cleanJoinCode,
  showJoinCode,
  specKey,
  type IslandSpec,
} from '../game/islands';
import type { IslandSave } from '../game/sim/types';
import { JAM_URL, copyText } from '../app/links';
import * as run from '../sdk/run';
import { HowTo, SettingsPanel } from '../play/hud/Menu';
import {
  currentSlot,
  deleteIsland,
  describeSave,
  islandFor,
  listIslands,
  playerId,
  quickIsland,
  chooseSlot,
  type NewIsland,
} from '../play/session';
import { NEWS, type News } from '../game/news';
import { CLIMATE_NAMES } from '../game/islands';
import { TitleScene } from '../play/TitleScene';
import { Logo } from '../ui/Logo';
import { NewIslandScreen } from './NewIsland';
import { STEPS } from './Intro';

export type PlayChoice =
  | { kind: 'solo'; fresh: NewIsland | null }
  | { kind: 'host'; fresh: NewIsland | null }
  | { kind: 'join'; code: string }
  /** A public island with strangers. */
  | { kind: 'public' };

/** The island behind the title when there's no save yet (autumn, for October). */
const SHOWCASE: IslandSpec = { seed: 7207, ...CLASSIC, climate: 'autumn' };

const isPc = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches;

export function Play({
  onStart,
  onSuggest,
  onRecords,
  onWardrobe,
  onDev,
  devCount = 0,
  error,
  newIsland,
  onNewIslandShown,
  onSlot,
  quickStart = false,
  onQuickStarted,
  news = null,
  onNewsSeen,
}: {
  onStart: (c: PlayChoice) => void;
  onSuggest: () => void;
  onRecords: () => void;
  onWardrobe: () => void;
  /** The owner's Dev area (absent for everyone else). */
  onDev?: () => void;
  /** Open reports and new suggestions waiting in the Dev area. */
  devCount?: number;
  error: string | null;
  /** Open straight on the New island screen (from the win screen). */
  newIsland: boolean;
  onNewIslandShown: () => void;
  /** The island slot picked (the hub save remembers it). */
  onSlot: (slot: number) => void;
  /** Just through the intro: no island yet means straight onto a ready-made one. */
  quickStart?: boolean;
  onQuickStarted?: () => void;
  /** What's new since the player's last visit (shown once). */
  news?: News | null;
  onNewsSeen?: () => void;
}) {
  const [islands, setIslands] = useState<(IslandSave | null)[] | undefined>(undefined);
  const [slot, setSlot] = useState(currentSlot);
  const [view, setView] = useState<'title' | 'new'>(newIsland ? 'new' : 'title');
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const [dialog, setDialog] = useState<'settings' | 'howto' | 'islands' | 'news' | null>(null);
  const [jam, setJam] = useState<'idle' | 'copied' | 'shown'>('idle');
  // The slot a new island goes into: a free one first, else the one played now.
  const [target, setTarget] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listIslands().then((list) => !cancelled && setIslands(list));
    return () => {
      cancelled = true;
    };
  }, []);

  const save = islands === undefined ? undefined : (islands[slot - 1] ?? null);
  const pick = (n: number) => {
    chooseSlot(n);
    setSlot(n);
    onSlot(n);
  };
  const freeSlot = islands ? islands.findIndex((s) => !s) + 1 : 0;
  const newTarget = target ?? (freeSlot || slot);
  const fresh = (f: NewIsland, friends: boolean) => {
    pick(newTarget);
    setTarget(null);
    onStart({ kind: friends ? 'host' : 'solo', fresh: f });
  };

  // Just through the intro with no island yet: straight onto a ready-made one.
  useEffect(() => {
    if (!quickStart || islands === undefined) return;
    onQuickStarted?.();
    if (!islands[slot - 1]) onStart({ kind: 'solo', fresh: quickIsland() });
  }, [quickStart, islands, slot, onStart, onQuickStarted]);

  useEffect(() => {
    if (newIsland) {
      setView('new');
      onNewIslandShown();
    }
  }, [newIsland, onNewIslandShown]);

  const info = save ? describeSave(save, playerId()) : null;

  if (view === 'new') {
    const there = islands?.[newTarget - 1];
    const old = there ? describeSave(there, playerId()) : null;
    return (
      <NewIslandScreen
        replacing={old && { day: old.day, name: old.name }}
        onBack={() => {
          setTarget(null);
          setView('title');
        }}
        onStart={fresh}
      />
    );
  }

  const voteJam = () => {
    run.track('jam_vote_tap', {});
    void copyText(JAM_URL).then((ok) => setJam(ok ? 'copied' : 'shown'));
  };

  return (
    <div className="title-screen">
      {save !== undefined && <Backdrop spec={info?.spec ?? SHOWCASE} />}
      <div className="title-shade" aria-hidden="true" />
      <div className="title-scroll">
        <header className="title-logo">
          <div className="title-kicker">A game the players build</div>
          <Logo />
          <div className="title-tag">Flight MX207 went down. Something here is growing.</div>
        </header>

        <div className="title-menu">
          {error && <div className="notice title-notice">{error}</div>}
          {news && save !== undefined && (
            <div className="card news-card" role="status" aria-label="What's new">
              <div className="news-head">
                📰 What’s new in v{news.version}: <b>{news.title}</b>
              </div>
              <ul className="news-items">
                {news.items.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <button className="btn small primary" onClick={onNewsSeen}>
                Got it
              </button>
            </div>
          )}
          {save === undefined ? (
            <p className="muted center">Loading your island…</p>
          ) : (
            <>
              {info ? (
                <button
                  className="menu-btn primary title-continue"
                  aria-label={`Continue · Day ${info.day} on ${info.name}`}
                  onClick={() => onStart({ kind: 'solo', fresh: null })}
                >
                  <span>▶ Continue</span>
                  <span className="title-continue-sub">
                    {info.name} · Day {info.day}
                    {info.escaped ? ' · escaped' : ''}
                  </span>
                </button>
              ) : (
                <button
                  className="menu-btn primary"
                  onClick={() => onStart({ kind: 'solo', fresh: quickIsland() })}
                >
                  ▶ Start surviving
                </button>
              )}
              <button className="menu-btn" onClick={() => setView('new')}>
                {info ? '🏝️ New island' : '🏝️ Choose your island'}
              </button>
              {islands?.some(Boolean) && (
                <button className="menu-btn" onClick={() => setDialog('islands')}>
                  🗂️ Your islands ({islands.filter(Boolean).length}/{islands.length})
                </button>
              )}
              <DailyLine onRecords={onRecords} />
              <button
                className="menu-btn title-friends"
                onClick={() => (info ? onStart({ kind: 'host', fresh: null }) : setView('new'))}
              >
                <span>👥 Play with friends</span>
                {info?.code && (
                  <span className="title-continue-sub">
                    Open {info.name} · code {showJoinCode(info.code)}
                  </span>
                )}
              </button>
              {joining ? (
                <form
                  className="card join"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (cleanJoinCode(code)) onStart({ kind: 'join', code });
                  }}
                >
                  <label className="label" htmlFor="room-code">
                    Your friend's island code (it's on their ⚙️ menu › Play with friends)
                  </label>
                  <input
                    id="room-code"
                    className="code-input"
                    value={code}
                    maxLength={JOIN_LEN + 1}
                    autoCapitalize="characters"
                    autoComplete="off"
                    onChange={(e) =>
                      setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
                    }
                    placeholder="ABC-234"
                  />
                  <div className="row">
                    <button
                      className="btn small primary"
                      type="submit"
                      disabled={!cleanJoinCode(code)}
                    >
                      Join
                    </button>
                    <button className="btn small" type="button" onClick={() => setJoining(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button className="menu-btn" onClick={() => setJoining(true)}>
                  🔑 Join a friend
                </button>
              )}
              <button
                className="menu-btn title-friends"
                onClick={() => onStart({ kind: 'public' })}
              >
                <span>🌍 Play with strangers</span>
                <span className="title-continue-sub">A public island, up to 4 survivors</span>
              </button>
              <button className="menu-btn" onClick={onWardrobe}>
                👕 Wardrobe
              </button>
              <div className="title-row">
                <button className="menu-btn" onClick={() => setDialog('settings')}>
                  ⚙️ Settings
                </button>
                <button className="menu-btn" onClick={() => setDialog('howto')}>
                  ❓ How to play
                </button>
              </div>
              <div className="title-row">
                <button className="menu-btn" onClick={onSuggest}>
                  💡 Suggest an update
                </button>
                <button className="menu-btn" onClick={() => setDialog('news')}>
                  📰 What’s new
                </button>
              </div>
              <button className="menu-btn jam-btn" onClick={voteJam}>
                🎃 Vote for us in October Jam
              </button>
              {jam !== 'idle' && <JamLink copied={jam === 'copied'} />}
              {onDev && (
                <button className="menu-btn" onClick={onDev}>
                  🛠️ Dev{devCount > 0 ? ` · ${devCount} to check` : ''}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {dialog === 'settings' && (
        <Dialog title="⚙️ Settings" name="settings" onClose={() => setDialog(null)}>
          <SettingsPanel />
          <p className="muted small-text">
            Keys for a keyboard and mouse are under Menu › Settings › Controls in a game.
          </p>
        </Dialog>
      )}
      {dialog === 'islands' && islands && (
        <Dialog title="🗂️ Your islands" name="your islands" onClose={() => setDialog(null)}>
          <IslandSlots
            islands={islands}
            slot={slot}
            onPlay={(n) => {
              pick(n);
              setDialog(null);
              onStart({ kind: 'solo', fresh: null });
            }}
            onNew={(n) => {
              setTarget(n);
              setDialog(null);
              setView('new');
            }}
            onDelete={(n) =>
              void deleteIsland(n).then(() =>
                setIslands((list) => list?.map((s, i) => (i === n - 1 ? null : s))),
              )
            }
          />
        </Dialog>
      )}
      {dialog === 'news' && (
        <Dialog title="📰 What’s new" name="what's new" onClose={() => setDialog(null)}>
          {NEWS.map((n) => (
            <section key={n.version} className="news-section">
              <div className="label">
                v{n.version} · {n.title}
              </div>
              <ul className="tips">
                {n.items.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          ))}
        </Dialog>
      )}
      {dialog === 'howto' && (
        <Dialog title="❓ How to play" name="how to play" onClose={() => setDialog(null)}>
          <HowTo pc={isPc()} bloomEvery={7} />
          <p className="muted small-text">
            Every island can have its own rules: pick them on the New island screen.
          </p>
          <div className="label">A game the players build</div>
          <ul className="tips">
            {STEPS.map((s) => (
              <li key={s.name}>
                {s.icon} <b>{s.name}</b>: {s.text}
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </div>
  );
}

/** Today's goal and the streak, under the island buttons; opens 🏆 Records. */
function DailyLine({ onRecords }: { onRecords: () => void }) {
  const r = useSyncExternalStore(recordsStore.subscribe, recordsStore.get);
  const today = utcDay(Date.now());
  const goal = dailyGoal(today);
  const streak = liveStreak(r.daily, today);
  const done = r.daily.day === today;
  return (
    <button className="menu-btn title-daily" onClick={onRecords}>
      <span>
        {done ? '✓ Daily goal done' : `🗓️ Today: ${goal.text}`}
        {streak > 0 ? ` · 🔥 ${streak}-day streak` : ''}
      </span>
      <span className="title-continue-sub">🏆 Records and leaderboards</span>
    </button>
  );
}

/** The island slots: play one, start a new one in an empty slot, or throw one away. */
function IslandSlots({
  islands,
  slot,
  onPlay,
  onNew,
  onDelete,
}: {
  islands: (IslandSave | null)[];
  slot: number;
  onPlay: (n: number) => void;
  onNew: (n: number) => void;
  onDelete: (n: number) => void;
}) {
  const [asking, setAsking] = useState<number | null>(null);
  return (
    <div className="slots">
      {islands.map((save, i) => {
        const n = i + 1;
        const info = save ? describeSave(save, playerId()) : null;
        return (
          <div key={n} className={`card slot-card${n === slot ? ' on' : ''}`}>
            {info ? (
              <>
                <div className="slot-name">
                  {info.name}
                  {n === slot && <span className="slot-tag">last played</span>}
                </div>
                <div className="muted small-text">
                  {CLIMATE_NAMES[info.spec.climate]} · Day {info.day}
                  {info.escaped ? ' · escaped' : ''}
                  {info.friends > 0
                    ? ` · ${info.friends} friend${info.friends > 1 ? 's' : ''}`
                    : ''}
                </div>
                {asking === n ? (
                  <div className="row">
                    <span className="small-text">Delete {info.name} for good?</span>
                    <button
                      className="btn small danger"
                      onClick={() => {
                        setAsking(null);
                        onDelete(n);
                      }}
                    >
                      Delete
                    </button>
                    <button className="btn small" onClick={() => setAsking(null)}>
                      Keep
                    </button>
                  </div>
                ) : (
                  <div className="row">
                    <button className="btn small primary" onClick={() => onPlay(n)}>
                      ▶ Play
                    </button>
                    <button className="btn small" onClick={() => setAsking(n)}>
                      🗑️ Delete
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="slot-name muted">Empty slot {n}</div>
                <button className="btn small" onClick={() => onNew(n)}>
                  ＋ New island here
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The jam page's link, copied for the player to open in their browser. */
function JamLink({ copied: first }: { copied: boolean }) {
  const [copied, setCopied] = useState<boolean | null>(first || null);
  return (
    <div className="card jam-link" role="status">
      <p className="small-text">
        {first
          ? '📋 Link copied! Paste it into your browser to vote for Bloom Island in the October Jam.'
          : 'Open this link in your browser to vote for Bloom Island in the October Jam:'}
      </p>
      <input
        className="jam-url"
        readOnly
        value={JAM_URL}
        aria-label="October Jam link"
        onFocus={(e) => e.currentTarget.select()}
      />
      <button
        className="btn small"
        onClick={() => void copyText(JAM_URL).then((ok) => setCopied(ok))}
      >
        {copied
          ? '✓ Copied'
          : copied === false
            ? 'Select the link above to copy it'
            : '📋 Copy link'}
      </button>
    </div>
  );
}

function Dialog({
  title,
  name,
  onClose,
  children,
}: {
  title: string;
  name: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="menu-screen hub-settings" role="dialog" aria-label={name}>
      <div className="menu-card wide">
        <div className="menu-head">
          <div className="menu-head-title">{title}</div>
          <button className="round-btn" onClick={onClose} aria-label={`Close ${name}`}>
            ✕
          </button>
        </div>
        <div className="menu-scroll">{children}</div>
      </div>
    </div>
  );
}

/** The 3D island behind the menu (a gradient if WebGL isn't there). */
function Backdrop({ spec }: { spec: IslandSpec }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  // A new scene only when the island itself changes.
  const code = specKey(spec);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let scene: TitleScene | null = null;
    // Let the menu paint first: making the island takes a moment.
    const timer = setTimeout(() => {
      try {
        scene = new TitleScene(canvas, islandFor(spec));
        scene.start();
        setReady(true);
      } catch {
        scene = null;
      }
    }, 60);
    return () => {
      clearTimeout(timer);
      scene?.dispose();
    };
  }, [code]);
  return (
    <canvas
      ref={ref}
      className={`title-bg${ready ? ' on' : ''}`}
      aria-hidden="true"
      data-testid="title-bg"
    />
  );
}
