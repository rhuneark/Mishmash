// 🏆 Records: what the player has done across every island, and RUN's leaderboards for the
// best of them (days survived on one island, the Bloom slain, escapes).

import { useEffect, useState, useSyncExternalStore } from 'react';
import * as run from '../sdk/run';
import { BOARDS, type BoardId } from '../game/records';
import { liveStreak, utcDay } from '../game/daily';
import { loadRecords, recordsStore } from '../play/records';

const TOP = 20;

export function Records() {
  const r = useSyncExternalStore(recordsStore.subscribe, recordsStore.get);
  const [board, setBoard] = useState<BoardId>('days');
  const [rows, setRows] = useState<run.BoardRow[] | null | undefined>(undefined);
  const [myRank, setMyRank] = useState<number | null>(null);

  useEffect(() => {
    void loadRecords();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRows(undefined);
    void run.topScores(board, TOP).then((res) => {
      if (cancelled) return;
      setRows(res ? res.rows : null);
      setMyRank(res?.myRank ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [board]);

  const streak = liveStreak(r.daily, utcDay(Date.now()));
  const stats: [string, string, string][] = [
    ['📅', 'Furthest day', r.bestDay ? `Day ${r.bestDay}` : '–'],
    ['🚁', 'Escapes', r.escapes ? `${r.escapes} (fastest: day ${r.fastestEscape})` : 'Not yet'],
    ['⚔️', 'Bloom slain', String(r.slain)],
    ['🌙', 'Nights survived', String(r.nights)],
    ['🔨', 'Things crafted', String(r.crafted)],
    ['🏝️', 'Islands', String(r.islands)],
    ['🗓️', 'Daily goals', `${r.dailies} · 🔥 ${streak} now, ${r.daily.best} best`],
  ];
  const def = BOARDS.find((b) => b.id === board);

  return (
    <div className="records">
      <div className="card records-mine">
        <div className="label">Your records, every island</div>
        <dl className="records-grid">
          {stats.map(([icon, name, value]) => (
            <div key={name} className="records-row">
              <dt>
                <span aria-hidden="true">{icon}</span> {name}
              </dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="segmented small" role="tablist" aria-label="Leaderboard">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            role="tab"
            aria-selected={board === b.id}
            className={`segment${board === b.id ? ' active' : ''}`}
            onClick={() => setBoard(b.id)}
          >
            {b.icon} {b.name}
          </button>
        ))}
      </div>
      <div className="card board">
        {rows === undefined && <p className="muted center">Loading…</p>}
        {rows === null && (
          <p className="muted center">The leaderboard can't be reached right now.</p>
        )}
        {rows && rows.length === 0 && (
          <p className="muted center">Nobody on this board yet. Be the first!</p>
        )}
        {rows && rows.length > 0 && (
          <ol className="board-rows">
            {rows.map((row) => (
              <li key={`${row.rank}-${row.profileId}`} className={row.mine ? 'mine' : ''}>
                <span className="board-rank">{row.rank}</span>
                <span className="board-name">
                  {row.username}
                  {row.mine ? ' (you)' : ''}
                </span>
                <span className="board-score">{row.score}</span>
              </li>
            ))}
          </ol>
        )}
        {myRank !== null && myRank > TOP && (
          <p className="small-text">
            You: #{myRank} with {def ? def.score(r) : 0}
          </p>
        )}
      </div>
      <p className="muted small-text">
        Records count on every island, solo or with friends. A board gets your best a minute or so
        after you set it.
      </p>
    </div>
  );
}
