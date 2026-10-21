import { useRef, useState } from 'react';
import * as run from '../sdk/run';
import { BASE_POLL, moveVote, tally, type Counts } from '../game/poll';
import { castVote, isLocalPreview, loadPoll, type MyVote } from '../app/community';
import { usePolling } from '../app/usePolling';
import { Notice, type NoticeState } from '../ui/Notice';

const REFRESH_MS = 60_000;

export function Vote({ onChat }: { onChat: () => void }) {
  const poll = BASE_POLL;
  const [counts, setCounts] = useState<Counts | null>(null);
  const [mine, setMine] = useState<MyVote | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const lastVoteAt = useRef(0);

  usePolling(async () => {
    const started = Date.now();
    const res = await loadPoll(poll);
    // A refresh that started before a vote landed would undo it on screen.
    if (started < lastVoteAt.current) return undefined;
    if (!res.ok) {
      if (!counts) setNotice({ reason: res.reason === 'login' ? 'login' : 'loadFailed' });
      return res.reason === 'rate' ? Math.max(REFRESH_MS, res.retryAfterMs ?? 0) : undefined;
    }
    setCounts(res.counts);
    setMine(res.mine);
    setNotice((n) => (n?.reason === 'loadFailed' ? null : n));
    return undefined;
  }, REFRESH_MS);

  const vote = async (option: string) => {
    // Until this player's current vote is known, a new one could be a second vote.
    if (!mine || busy || !poll.open || mine.option === option) return;
    const previous = mine;
    setBusy(option);
    setNotice(null);
    const res = await castVote(poll, option, previous);
    lastVoteAt.current = Date.now();
    setBusy(null);
    if (!res.ok) {
      setNotice({ reason: res.reason, retryAfterMs: res.retryAfterMs });
      return;
    }
    setMine(res.vote);
    setCounts((c) => moveVote(c ?? {}, previous.option, option));
    run.track('vote_cast', { poll: poll.id, option, changed: Boolean(previous.option) });
  };

  const { rows, total } = tally(poll, counts ?? {});
  const chosen = poll.options.find((o) => o.id === mine?.option);

  return (
    <div className="scroll">
      <div className="page">
        {isLocalPreview() && (
          <div className="preview-tag">Local preview: votes stay in this tab</div>
        )}
        <header className="page-head">
          <div className="label">{poll.title}</div>
          <h2 className="page-title">{poll.question}</h2>
          <p className="muted">
            {chosen
              ? `You voted ${chosen.name}. Tap another to move your vote.`
              : 'One vote per person. Tap one to vote; you can move it later.'}
          </p>
        </header>

        {notice && <Notice state={notice} onClose={() => setNotice(null)} />}

        <div className="options">
          {rows.map((row, i) => {
            const picked = mine?.option === row.option.id;
            return (
              <button
                key={row.option.id}
                className={`option${picked ? ' picked' : ''}`}
                aria-pressed={picked}
                disabled={!mine || busy !== null || !poll.open}
                onClick={() => void vote(row.option.id)}
              >
                <span
                  className={`option-fill tile-${i % 4}`}
                  style={{ width: `${Math.round(row.share * 100)}%` }}
                  aria-hidden="true"
                />
                <span className="option-icon" aria-hidden="true">
                  {row.option.icon}
                </span>
                <span className="option-text">
                  <span className="option-name">
                    {row.option.name}
                    {row.leading && <span className="crown"> 👑</span>}
                  </span>
                  <span className="option-blurb">
                    {busy === row.option.id ? 'Voting…' : picked ? 'Your vote' : row.option.blurb}
                  </span>
                </span>
                <span className="option-pct">
                  {counts ? `${Math.round(row.share * 100)}%` : '–'}
                </span>
              </button>
            );
          })}
        </div>

        <p className="muted center">
          {counts ? `${total} ${total === 1 ? 'vote' : 'votes'} so far` : 'Loading votes…'}
        </p>

        <button className="btn" onClick={onChat}>
          Something else in mind? Pitch it in chat
        </button>
      </div>
    </div>
  );
}
