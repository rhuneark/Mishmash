import { useEffect, useState } from 'react';
import type { IslandSave } from '../game/sim/types';
import { describeSave, loadIsland, playerId } from '../play/session';

export type PlayChoice =
  { kind: 'solo'; fresh: boolean } | { kind: 'host' } | { kind: 'join'; code: string };

export function Play({
  onStart,
  onVote,
  error,
}: {
  onStart: (c: PlayChoice) => void;
  onVote: () => void;
  error: string | null;
}) {
  const [save, setSave] = useState<IslandSave | null | undefined>(undefined);
  const [confirmNew, setConfirmNew] = useState(false);
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');

  useEffect(() => {
    let cancelled = false;
    void loadIsland().then((s) => !cancelled && setSave(s));
    return () => {
      cancelled = true;
    };
  }, []);

  const info = save ? describeSave(save, playerId()) : null;

  return (
    <div className="scroll">
      <div className="page play-page">
        <header className="play-hero">
          <div className="play-art" aria-hidden="true">
            <span>🌴</span>
            <span>✈️</span>
            <span>🥀</span>
          </div>
          <h2 className="page-title">Bloom Island</h2>
          <p className="muted">
            Flight MX207 went down. The island is beautiful, and something in it is growing out of
            the passengers. Gather, craft, build a camp, survive the nights and find a way off.
          </p>
        </header>

        {error && <div className="notice">{error}</div>}

        {save === undefined ? (
          <p className="muted center">Loading your island…</p>
        ) : (
          <div className="play-buttons">
            {info && (
              <button
                className="btn primary big"
                onClick={() => onStart({ kind: 'solo', fresh: false })}
              >
                ▶ Continue · Day {info.day}
                {info.escaped ? ' · escaped' : ''}
              </button>
            )}
            {!info && (
              <button
                className="btn primary big"
                onClick={() => onStart({ kind: 'solo', fresh: true })}
              >
                ▶ Start surviving
              </button>
            )}
            {info &&
              (confirmNew ? (
                <div className="card confirm">
                  <p>A new island replaces your saved one (day {info.day}). Sure?</p>
                  <div className="row">
                    <button
                      className="btn small primary"
                      onClick={() => onStart({ kind: 'solo', fresh: true })}
                    >
                      New island
                    </button>
                    <button className="btn small" onClick={() => setConfirmNew(false)}>
                      Keep mine
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn" onClick={() => setConfirmNew(true)}>
                  🏝️ New island
                </button>
              ))}
            <button className="btn" onClick={() => onStart({ kind: 'host' })}>
              👥 Play with friends (host my island)
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
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
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
              <button className="btn" onClick={() => setJoining(true)}>
                🔑 Join a friend
              </button>
            )}
          </div>
        )}

        <div className="card play-how">
          <div className="label">How it works</div>
          <ul className="tips">
            <li>
              Stick on the left to move, the big button to chop, mine, pick up, fight and open
              things.
            </li>
            <li>
              Craft tools, a campfire and a shelter. The Bloom comes out at night and fears fire.
            </li>
            <li>Every 7th night is a Bloom night. Fire won't save you then: build walls.</li>
            <li>
              Monster parts make special gear at a Mashbench. The Husks carry pages of the story of
              how all this started.
            </li>
            <li>
              Find the three radio parts, call for rescue and hold out until the helicopter lands.
            </li>
          </ul>
        </div>

        <button className="btn ghost" onClick={onVote}>
          🗳️ Vote on what gets added next
        </button>
      </div>
    </div>
  );
}
