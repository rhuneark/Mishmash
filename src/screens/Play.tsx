import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CLASSIC, specCode, type IslandSpec } from '../game/islands';
import type { IslandSave } from '../game/sim/types';
import { JAM_URL, copyText } from '../app/links';
import * as run from '../sdk/run';
import { HowTo, SettingsPanel } from '../play/hud/Menu';
import { describeSave, islandFor, loadIsland, playerId, type NewIsland } from '../play/session';
import { TitleScene } from '../play/TitleScene';
import { Logo } from '../ui/Logo';
import { NewIslandScreen } from './NewIsland';
import { STEPS } from './Intro';

export type PlayChoice =
  { kind: 'solo'; fresh: NewIsland | null } | { kind: 'host' } | { kind: 'join'; code: string };

/** The island behind the title when there's no save yet (autumn, for October). */
const SHOWCASE: IslandSpec = { seed: 7207, ...CLASSIC, climate: 'autumn' };

const isPc = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches;

export function Play({
  onStart,
  onVote,
  onDev,
  openReports = 0,
  error,
  newIsland,
  onNewIslandShown,
}: {
  onStart: (c: PlayChoice) => void;
  onVote: () => void;
  /** The owner's Dev area (absent for everyone else). */
  onDev?: () => void;
  openReports?: number;
  error: string | null;
  /** Open straight on the New island screen (from the win screen). */
  newIsland: boolean;
  onNewIslandShown: () => void;
}) {
  const [save, setSave] = useState<IslandSave | null | undefined>(undefined);
  const [view, setView] = useState<'title' | 'new'>(newIsland ? 'new' : 'title');
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const [dialog, setDialog] = useState<'settings' | 'howto' | null>(null);
  const [jam, setJam] = useState<'idle' | 'copied' | 'shown'>('idle');

  useEffect(() => {
    let cancelled = false;
    void loadIsland().then((s) => !cancelled && setSave(s));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (newIsland) {
      setView('new');
      onNewIslandShown();
    }
  }, [newIsland, onNewIslandShown]);

  const info = save ? describeSave(save, playerId()) : null;

  if (view === 'new') {
    return (
      <NewIslandScreen
        replacing={info && { day: info.day, name: info.name }}
        onBack={() => setView('title')}
        onStart={(fresh) => onStart({ kind: 'solo', fresh })}
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
                <button className="menu-btn primary" onClick={() => setView('new')}>
                  ▶ Start surviving
                </button>
              )}
              {info && (
                <button className="menu-btn" onClick={() => setView('new')}>
                  🏝️ New island
                </button>
              )}
              <button className="menu-btn" onClick={() => onStart({ kind: 'host' })}>
                👥 Play with friends
              </button>
              {joining ? (
                <form
                  className="card join"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (code.trim().length >= 4) onStart({ kind: 'join', code });
                  }}
                >
                  <label className="label" htmlFor="room-code">
                    Your friend's island code
                  </label>
                  <input
                    id="room-code"
                    className="code-input"
                    value={code}
                    maxLength={8}
                    autoCapitalize="characters"
                    autoComplete="off"
                    onChange={(e) =>
                      setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                    }
                    placeholder="ABC123"
                  />
                  <div className="row">
                    <button
                      className="btn small primary"
                      type="submit"
                      disabled={code.trim().length < 4}
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
              <div className="title-row">
                <button className="menu-btn" onClick={() => setDialog('settings')}>
                  ⚙️ Settings
                </button>
                <button className="menu-btn" onClick={() => setDialog('howto')}>
                  ❓ How to play
                </button>
              </div>
              <button className="menu-btn" onClick={onVote}>
                🗳️ Vote for updates
              </button>
              <button className="menu-btn jam-btn" onClick={voteJam}>
                🎃 Vote for us in October Jam
              </button>
              {jam !== 'idle' && <JamLink copied={jam === 'copied'} />}
              {onDev && (
                <button className="menu-btn" onClick={onDev}>
                  🛠️ Dev{openReports > 0 ? ` · ${openReports} to check` : ''}
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
  const code = specCode(spec);
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
