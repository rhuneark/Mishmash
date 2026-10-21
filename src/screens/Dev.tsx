import { useEffect, useState } from 'react';
import * as run from '../sdk/run';
import { timeAgo } from '../game/chat';
import {
  deleteFlagged,
  isOwner,
  keepFlagged,
  loadFlagged,
  type Flagged,
  type FlaggedState,
} from '../app/community';
import { usePolling } from '../app/usePolling';
import { Notice, type NoticeState } from '../ui/Notice';

const REFRESH_MS = 60_000;

const STATE_LABEL: Record<FlaggedState, string> = {
  visible: 'Visible to players',
  hidden: 'Hidden from players',
  deleted: 'Deleted',
  missing: 'Already gone',
};

type View = 'open' | 'resolved';

/** The owner's area: player reports. RUN refuses its calls for anyone else. */
export function Dev({ onOpenCount }: { onOpenCount: (n: number) => void }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [view, setView] = useState<View>('open');

  useEffect(() => {
    let cancelled = false;
    void isOwner().then((yes) => !cancelled && setAllowed(yes));
    return () => {
      cancelled = true;
    };
  }, []);

  if (allowed !== true) {
    return (
      <div className="scroll">
        <div className="page">
          <p className="muted center">
            {allowed === null ? 'Checking…' : "This area is only for the game's owner."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll">
      <div className="page">
        <header className="page-head">
          <div className="label">🛠️ Dev area · only you can see this</div>
          <h2 className="page-title">Reports</h2>
        </header>
        <div className="segmented" role="tablist">
          {(['open', 'resolved'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={`segment${view === v ? ' active' : ''}`}
              onClick={() => setView(v)}
            >
              {v === 'open' ? 'Open' : 'Resolved'}
            </button>
          ))}
        </div>
        <FlaggedList key={view} view={view} onOpenCount={onOpenCount} />
      </div>
    </div>
  );
}

function FlaggedList({ view, onOpenCount }: { view: View; onOpenCount: (n: number) => void }) {
  const [items, setItems] = useState<Flagged[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  usePolling(async () => {
    const res = await loadFlagged(view);
    setNow(Date.now());
    if (!res.ok) {
      setNotice({ reason: res.reason, retryAfterMs: res.retryAfterMs });
      return res.reason === 'rate' ? Math.max(REFRESH_MS, res.retryAfterMs ?? 0) : undefined;
    }
    setItems(res.items);
    if (view === 'open') onOpenCount(res.items.length);
    return undefined;
  }, REFRESH_MS);

  const act = async (item: Flagged, action: 'delete' | 'keep') => {
    if (busy) return;
    setBusy(item.group.entryId);
    setNotice(null);
    const ok = action === 'delete' ? await deleteFlagged(item) : await keepFlagged(item);
    setBusy(null);
    if (!ok) {
      setNotice({ reason: 'error' });
      return;
    }
    const rest = (items ?? []).filter((i) => i.group.entryId !== item.group.entryId);
    setItems(rest);
    onOpenCount(rest.length);
    run.track(action === 'delete' ? 'dev_report_deleted' : 'dev_report_kept');
  };

  return (
    <>
      {notice && <Notice state={notice} onClose={() => setNotice(null)} />}
      {!items && <p className="muted center">Loading reports…</p>}
      {items && items.length === 0 && (
        <p className="muted center">
          {view === 'open' ? 'No open reports. All clear! 🎉' : 'Nothing resolved yet.'}
        </p>
      )}
      {items?.map((item) => {
        const { group, message, state } = item;
        const count = group.reportIds.length;
        const gone = state === 'deleted' || state === 'missing';
        return (
          <div key={group.entryId} className={`card flag ${state}`}>
            <div className="flag-head">
              <b>{message ? message.authorName : 'Unknown player'}</b>
              {message && <span className="muted">{timeAgo(message.at, now)}</span>}
              <span className={`badge ${state}`}>{STATE_LABEL[state]}</span>
            </div>
            <p className="flag-text">{message ? message.text : 'This message no longer exists.'}</p>
            <p className="muted">
              Reported {count}× · {group.reasons.join(', ')} · {timeAgo(group.latest, now)}
            </p>
            {group.notes.map((note, i) => (
              <p key={i} className="muted">
                “{note}”
              </p>
            ))}
            {view === 'open' ? (
              <div className="flag-actions">
                <button
                  className="btn danger"
                  disabled={busy !== null}
                  onClick={() => void act(item, 'delete')}
                >
                  {gone ? 'Close report' : 'Delete message'}
                </button>
                {!gone && (
                  <button
                    className="btn"
                    disabled={busy !== null}
                    onClick={() => void act(item, 'keep')}
                  >
                    Keep
                  </button>
                )}
              </div>
            ) : (
              <p className="muted">
                {group.status === 'dismissed' ? 'Resolved: kept' : 'Resolved: deleted'}
              </p>
            )}
            {state === 'hidden' && (
              <p className="flag-hint">
                Hidden after 3 reports. Keeping it doesn't bring it back; to show it to players
                again, run on your computer: <code>rundot ugc approve {group.entryId}</code>
              </p>
            )}
          </div>
        );
      })}
    </>
  );
}
