import { Icon, type IconName } from '../ui/Icon';
import {
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { dailyGoal, liveStreak, utcDay } from '../game/daily';
import { recordsStore } from '../play/records';
import {
  CLASSIC,
  JOIN_LEN,
  cleanJoinCode,
  newJoinCode,
  randomParts,
  showJoinCode,
  specKey,
  type IslandSpec,
} from '../game/islands';
import { randomSeed } from '../game/rng';
import { PRESETS } from '../game/rules';
import type { IslandSave } from '../game/sim/types';
import { JAM_URL, copyText } from '../app/links';
import * as run from '../sdk/run';
import {
  currentSlot,
  deleteIsland,
  describeSave,
  listIslands,
  playerId,
  quickIsland,
  chooseSlot,
  type NewIsland,
} from '../play/slots';
import { loadOutfits, outfitStore } from '../play/outfits';
import { NEWS, type News } from '../game/news';
import { CLIMATE_NAMES } from '../game/islands';
import type { TitleScene } from '../play/TitleScene';
import { Logo } from '../ui/Logo';

// The game's own parts load when they're first needed, so the title shows sooner.
const NewIslandScreen = lazy(() =>
  import('./NewIsland').then((m) => ({ default: m.NewIslandScreen })),
);
const SettingsPanel = lazy(() =>
  import('../play/hud/Menu').then((m) => ({ default: m.SettingsPanel })),
);
const HowTo = lazy(() => import('../play/hud/Menu').then((m) => ({ default: m.HowTo })));

/** What shows while a part of the game loads. */
export function Loading() {
  return <p className="muted center loading-part">Loading…</p>;
}

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

/** The ready-made worlds: a preset's rules on a new island, straight in. */
const KINDS: { id: string; icon: IconName }[] = [
  { id: 'relaxed', icon: 'sun' },
  { id: 'normal', icon: 'fist' },
  { id: 'nightmare', icon: 'flame' },
];

/** A new island with a preset's rules (Beginner gets a gentle tropical one). */
function presetWorld(id: string, code?: string): NewIsland {
  const preset = PRESETS.find((p) => p.id === id) ?? PRESETS[1];
  const r = Math.random;
  const parts =
    id === 'relaxed' ? randomParts(r, { climate: 'tropic', terrain: 'classic' }) : randomParts(r);
  return { seed: randomSeed(r), parts, rules: { ...preset!.rules }, ...(code ? { code } : {}) };
}

type View = 'title' | 'solo' | 'multi' | 'create' | 'join' | 'new';

export function Play({
  onStart,
  onSuggest,
  onCharacter,
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
  /** The survivor's page: outfits, records and the daily goal. */
  onCharacter: () => void;
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
  /** What's new since the player's last visit (a badge on News until it's opened). */
  news?: News | null;
  onNewsSeen?: () => void;
}) {
  const [islands, setIslands] = useState<(IslandSave | null)[] | undefined>(undefined);
  const [slot, setSlot] = useState(currentSlot);
  const [view, setView] = useState<View>(newIsland ? 'new' : 'title');
  // The New island screen (Custom) for yourself or for a world with friends.
  const [custom, setCustom] = useState<'solo' | 'host'>('solo');
  const [code, setCode] = useState('');
  // The room code a world created for friends gets (shown before it starts).
  const [roomCode, setRoomCode] = useState(() => newJoinCode(Math.random));
  const [dialog, setDialog] = useState<'settings' | 'howto' | 'islands' | 'news' | null>(null);
  const [jam, setJam] = useState<'idle' | 'copied' | 'shown'>('idle');
  // A ready-made world waiting for "replace" when all the island slots are taken.
  const [pending, setPending] = useState<{ fresh: NewIsland; friends: boolean } | null>(null);
  // The slot a new island goes into: a free one first, else the one played now.
  const [target, setTarget] = useState<number | null>(null);

  // Six slots once the shop's three more islands are owned.
  const { owned } = useSyncExternalStore(outfitStore.subscribe, outfitStore.get);
  const moreIslands = owned.has('more_islands');
  useEffect(() => {
    void loadOutfits();
  }, []);
  useEffect(() => {
    let cancelled = false;
    void listIslands().then((list) => !cancelled && setIslands(list));
    return () => {
      cancelled = true;
    };
  }, [moreIslands]);

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
    setPending(null);
    onStart({ kind: friends ? 'host' : 'solo', fresh: f });
  };
  /** A ready-made world: straight in, unless it would replace an island. */
  const ready = (id: string, friends: boolean) => {
    const f = presetWorld(id, friends ? roomCode : undefined);
    if (!freeSlot && islands?.[newTarget - 1]) setPending({ fresh: f, friends });
    else fresh(f, friends);
  };
  const go = (v: View) => {
    setPending(null);
    if (v === 'create') setRoomCode(newJoinCode(Math.random));
    setView(v);
  };

  // Just through the intro with no island yet: straight onto a ready-made one.
  useEffect(() => {
    if (!quickStart || islands === undefined) return;
    onQuickStarted?.();
    if (!islands[slot - 1]) onStart({ kind: 'solo', fresh: quickIsland() });
  }, [quickStart, islands, slot, onStart, onQuickStarted]);

  useEffect(() => {
    if (newIsland) {
      setCustom('solo');
      setView('new');
      onNewIslandShown();
    }
  }, [newIsland, onNewIslandShown]);

  const info = save ? describeSave(save, playerId()) : null;
  const used = islands?.filter(Boolean).length ?? 0;

  if (view === 'new') {
    const there = islands?.[newTarget - 1];
    const old = there ? describeSave(there, playerId()) : null;
    return (
      <Suspense fallback={<Loading />}>
        <NewIslandScreen
          replacing={old && { day: old.day, name: old.name }}
          friends={custom === 'host' ? roomCode : null}
          onBack={() => {
            setTarget(null);
            setView(custom === 'host' ? 'create' : 'solo');
          }}
          onStart={(f) =>
            fresh(custom === 'host' ? { ...f, code: roomCode } : f, custom === 'host')
          }
        />
      </Suspense>
    );
  }

  const voteJam = () => {
    run.track('jam_vote_tap', {});
    void copyText(JAM_URL).then((ok) => setJam(ok ? 'copied' : 'shown'));
  };
  const openNews = () => {
    setDialog('news');
    if (news) onNewsSeen?.();
  };
  const replacingInfo = pending && islands?.[newTarget - 1];
  const replaced = replacingInfo ? describeSave(replacingInfo, playerId()) : null;

  /** The ready-made worlds and Custom (Solo and Create world share them). */
  const worlds = (friends: boolean) => (
    <>
      {pending && replaced ? (
        <div className="card confirm" role="alertdialog" aria-label="Replace an island">
          <p className="small-text">
            Your {islands?.length ?? 3} island slots are full. This replaces {replaced.name} (day{' '}
            {replaced.day}).
          </p>
          <div className="row">
            <button
              className="btn small primary"
              onClick={() => fresh(pending.fresh, pending.friends)}
            >
              Replace it
            </button>
            <button className="btn small" onClick={() => setPending(null)}>
              Keep mine
            </button>
          </div>
        </div>
      ) : (
        <>
          {KINDS.map((k) => {
            const p = PRESETS.find((x) => x.id === k.id)!;
            return (
              <BigButton
                key={k.id}
                icon={k.icon}
                label={p.name}
                sub={p.desc}
                onClick={() => ready(k.id, friends)}
              />
            );
          })}
          <BigButton
            icon="wrench"
            label="Custom"
            sub="Pick the island's climate, coast and layout, and every rule."
            onClick={() => {
              setCustom(friends ? 'host' : 'solo');
              setView('new');
            }}
          />
        </>
      )}
    </>
  );

  return (
    <div className="title-screen">
      {save !== undefined && <Backdrop spec={info?.spec ?? SHOWCASE} />}
      <div className="title-shade" aria-hidden="true" />
      <div className="title-scroll">
        {view === 'title' && (
          <header className="title-logo">
            <Logo />
          </header>
        )}

        <div className={`title-menu${view === 'title' ? '' : ' title-page'}`}>
          {view !== 'title' && (
            <div className="title-page-head">
              <button
                className="btn small"
                aria-label="Back"
                onClick={() => go(view === 'create' || view === 'join' ? 'multi' : 'title')}
              >
                ‹ Back
              </button>
              <div className="title-page-title">
                {view === 'solo'
                  ? 'Solo'
                  : view === 'multi'
                    ? 'Multiplayer'
                    : view === 'create'
                      ? 'Create world'
                      : 'Join world'}
              </div>
            </div>
          )}
          {error && <div className="notice title-notice">{error}</div>}

          {save === undefined ? (
            <p className="muted center">Loading your island…</p>
          ) : view === 'title' ? (
            <nav className="title-main" aria-label="Main menu">
              <BigButton
                icon="play"
                label="Solo"
                sub={info ? `Continue ${info.name} · Day ${info.day}` : 'Start surviving'}
                primary
                onClick={() => go('solo')}
              />
              <BigButton
                icon="people"
                label="Multiplayer"
                sub="Create a world for friends, or join one"
                onClick={() => go('multi')}
              />
              <BigButton
                icon="shirt"
                label="Character"
                sub="Your look, records and the daily goal"
                onClick={onCharacter}
              />
              <BigButton
                icon="news"
                label="News"
                sub="What's new, and suggest what's next"
                badge={news ? 'New' : undefined}
                onClick={openNews}
              />
              <BigButton
                icon="gear"
                label="Settings"
                sub="Sound, screen, controls and how to play"
                onClick={() => setDialog('settings')}
              />
              {onDev && (
                <button
                  className="title-dev"
                  aria-label={devCount > 0 ? `Dev · ${devCount} to check` : 'Dev'}
                  onClick={onDev}
                >
                  <Icon name="wrench" className="inline" /> Dev
                  {devCount > 0 ? ` · ${devCount}` : ''}
                </button>
              )}
            </nav>
          ) : view === 'solo' ? (
            <>
              {info && (
                <button
                  className="menu-btn primary title-continue"
                  aria-label={`Continue · Day ${info.day} on ${info.name}`}
                  onClick={() => onStart({ kind: 'solo', fresh: null })}
                >
                  <Icon name="play" className="title-play" />
                  <span className="title-continue-text">
                    <span>Continue</span>
                    <span className="title-continue-sub">
                      {info.name} · Day {info.day}
                      {info.escaped ? ' · escaped' : ''}
                    </span>
                  </span>
                  <span className="title-stamp" aria-hidden="true">
                    <i>Day</i>
                    <b>{String(info.day).padStart(2, '0')}</b>
                  </span>
                </button>
              )}
              {used > 0 && (
                <button className="title-link" onClick={() => setDialog('islands')}>
                  <Icon name="stack" className="inline" /> Your islands ({used}/
                  {islands?.length ?? 3})
                </button>
              )}
              <div className="title-group">New world</div>
              {worlds(false)}
            </>
          ) : view === 'multi' ? (
            <>
              <BigButton
                icon="people"
                label="Create world"
                sub="A new world with a room code for your friends"
                primary
                onClick={() => go('create')}
              />
              <BigButton
                icon="key"
                label="Join world"
                sub="Type in a friend's room code"
                onClick={() => go('join')}
              />
              <button
                className="title-link"
                aria-label="Play with strangers · a public island, up to 4 survivors"
                onClick={() => onStart({ kind: 'public' })}
              >
                <Icon name="globe" className="inline" /> Or drop onto a public island with strangers
              </button>
            </>
          ) : view === 'create' ? (
            <>
              <div className="card room-code" aria-label={`Room code ${showJoinCode(roomCode)}`}>
                <div className="label">Room code</div>
                <code className="room-code-value" data-testid="room-code">
                  {showJoinCode(roomCode)}
                </code>
                <p className="muted small-text">
                  Friends pick Multiplayer › Join world and type this in.
                </p>
              </div>
              {worlds(true)}
              {info?.code && !pending && (
                <button
                  className="title-link"
                  aria-label={`Open ${info.name} to friends · code ${showJoinCode(info.code)}`}
                  onClick={() => onStart({ kind: 'host', fresh: null })}
                >
                  <Icon name="island" className="inline" /> Or open {info.name} (Day {info.day}) to
                  friends · {showJoinCode(info.code)}
                </button>
              )}
            </>
          ) : (
            <form
              className="card join"
              onSubmit={(e) => {
                e.preventDefault();
                if (cleanJoinCode(code)) onStart({ kind: 'join', code });
              }}
            >
              <label className="label" htmlFor="room-code">
                Your friend's room code
              </label>
              <input
                id="room-code"
                className="code-input"
                value={code}
                maxLength={JOIN_LEN + 1}
                autoCapitalize="characters"
                autoComplete="off"
                autoFocus
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                placeholder="ABC-234"
              />
              <p className="muted small-text">
                It's on their Create world page, and in their game under ⚙️ › Play with friends.
              </p>
              <button className="menu-btn primary" type="submit" disabled={!cleanJoinCode(code)}>
                Join
              </button>
            </form>
          )}
        </div>
      </div>

      {dialog === 'settings' && (
        <Dialog title="⚙️ Settings" name="settings" onClose={() => setDialog(null)}>
          <button className="menu-btn" onClick={() => setDialog('howto')}>
            <Icon name="help" className="inline" /> How to play
          </button>
          <Suspense fallback={<Loading />}>
            <SettingsPanel />
          </Suspense>
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
              setCustom('solo');
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
        <Dialog title="📰 News" name="news" onClose={() => setDialog(null)}>
          <button
            className="menu-btn primary"
            aria-label="Suggest an update"
            onClick={() => {
              setDialog(null);
              onSuggest();
            }}
          >
            <Icon name="bulb" className="inline" /> Suggest what gets built next
          </button>
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
          <button
            className="menu-btn jam-btn"
            aria-label="Vote for us in October Jam"
            onClick={voteJam}
          >
            <Icon name="pumpkin" className="inline" /> Vote for Bloom Island in the October Jam
          </button>
          {jam !== 'idle' && <JamLink copied={jam === 'copied'} />}
        </Dialog>
      )}
      {dialog === 'howto' && (
        <Dialog title="❓ How to play" name="how to play" onClose={() => setDialog(null)}>
          <Suspense fallback={<Loading />}>
            <HowTo pc={isPc()} bloomEvery={7} />
          </Suspense>
          <p className="muted small-text">
            Every island can have its own rules: pick Custom when you start a new world.
          </p>
        </Dialog>
      )}
    </div>
  );
}

/** A big menu button: an ink icon, a word in the journal's hand and a line under it. */
function BigButton({
  icon,
  label,
  sub,
  onClick,
  primary = false,
  badge,
}: {
  icon: IconName;
  label: string;
  sub: string;
  onClick: () => void;
  primary?: boolean;
  badge?: string;
}) {
  return (
    <button
      className={`menu-btn title-big${primary ? ' primary' : ''}`}
      aria-label={label}
      onClick={onClick}
    >
      <Icon name={icon} className="title-big-icon" />
      <span className="title-big-text">
        <span className="title-big-label">{label}</span>
        <span className="title-big-sub">{sub}</span>
      </span>
      {badge && <span className="title-badge">{badge}</span>}
    </button>
  );
}

/** Today's goal and the streak (on the Character page); opens 🏆 Records. */
export function DailyLine({ onRecords }: { onRecords: () => void }) {
  const r = useSyncExternalStore(recordsStore.subscribe, recordsStore.get);
  const today = utcDay(Date.now());
  const goal = dailyGoal(today);
  const streak = liveStreak(r.daily, today);
  const done = r.daily.day === today;
  return (
    <button className="menu-btn title-daily" onClick={onRecords}>
      <span className="title-daily-goal">
        {done ? 'Daily goal done' : `Today: ${goal.text}`}
        {streak > 0 && (
          <>
            {' · '}
            <Icon name="flame" className="inline" />
            {`${streak}-day streak`}
          </>
        )}
      </span>
      <span className="title-continue-sub">
        <Icon name="trophy" className="inline" /> Records and leaderboards
      </span>
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
    let gone = false;
    // Let the menu paint first: the backdrop's code loads after it, and making the island
    // takes a moment.
    const timer = setTimeout(() => {
      void Promise.all([import('../play/TitleScene'), import('../play/islandCache')])
        .then(([{ TitleScene }, { islandFor }]) => {
          if (gone) return;
          scene = new TitleScene(canvas, islandFor(spec));
          scene.start();
          setReady(true);
        })
        .catch(() => {
          scene = null;
        });
    }, 60);
    return () => {
      gone = true;
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
