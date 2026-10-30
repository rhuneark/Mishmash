import { useEffect, useState } from 'react';
import * as run from '../sdk/run';
import { timeAgo } from '../game/chat';
import {
  allSuggestions,
  deleteFlagged,
  deleteSuggestion,
  isOwner,
  keepFlagged,
  loadFlagged,
  loadMarks,
  saveMarks,
  type Flagged,
  type FlaggedState,
} from '../app/community';
import { TOPICS, builtText, type DevMarks, type Suggestion } from '../game/suggest';
import { copyText } from '../app/links';
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
type Area = 'ideas' | 'reports';

/** The owner's area: suggestions and player reports. RUN refuses its calls for anyone else. */
export function Dev({
  onOpenCount,
  onNewCount,
}: {
  onOpenCount: (n: number) => void;
  onNewCount: (n: number) => void;
}) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [area, setArea] = useState<Area>('ideas');
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
        </header>
        <div className="segmented" role="tablist">
          {(
            [
              ['ideas', '💡 Suggestions'],
              ['reports', '🚩 Reports'],
            ] as const
          ).map(([a, label]) => (
            <button
              key={a}
              role="tab"
              aria-selected={area === a}
              className={`segment${area === a ? ' active' : ''}`}
              onClick={() => setArea(a)}
            >
              {label}
            </button>
          ))}
        </div>
        {area === 'ideas' ? (
          <Suggestions onNewCount={onNewCount} />
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

type IdeaFilter = 'new' | 'starred' | 'done' | 'built' | 'all';

const FILTERS: [IdeaFilter, string][] = [
  ['new', 'To read'],
  ['starred', '⭐ Starred'],
  ['done', '✓ Done'],
  ['built', '🏗️ Built'],
  ['all', 'All'],
];

/** Players' suggestions, newest first, with the owner's own marks (kept on their device). */
function Suggestions({ onNewCount }: { onNewCount: (n: number) => void }) {
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [next, setNext] = useState<string | undefined>(undefined);
  const [marks, setMarks] = useState<DevMarks | null>(null);
  const [filter, setFilter] = useState<IdeaFilter>('new');
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  // What counted as new when the list opened (the marks move on once it's open).
  const [seenBefore, setSeenBefore] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadMarks().then((m) => {
      if (cancelled) return;
      setMarks(m);
      setSeenBefore(m.seenAt);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  usePolling(async () => {
    const res = await allSuggestions();
    setNow(Date.now());
    if (!res.ok) {
      setNotice({ reason: res.reason, retryAfterMs: res.retryAfterMs });
      return res.reason === 'rate' ? Math.max(REFRESH_MS, res.retryAfterMs ?? 0) : undefined;
    }
    setList((old) => mergeById(res.list, old ?? []));
    setNext((n) => n ?? res.next);
    return undefined;
  }, REFRESH_MS);

  // Opening the list counts as seeing everything in it.
  useEffect(() => {
    if (!list || !marks) return;
    const newest = list.reduce((t, s) => Math.max(t, s.at), 0);
    if (newest > marks.seenAt) {
      const m = { ...marks, seenAt: newest };
      setMarks(m);
      saveMarks(m);
    }
    onNewCount(0);
  }, [list, marks, onNewCount]);

  const mark = (id: string, key: 'starred' | 'done') => {
    if (!marks) return;
    const has = marks[key].includes(id);
    const m = { ...marks, [key]: has ? marks[key].filter((x) => x !== id) : [...marks[key], id] };
    setMarks(m);
    saveMarks(m);
  };

  /** Built (and so done): kept with who asked, for the next update's credits. */
  const markBuilt = (s: Suggestion) => {
    if (!marks) return;
    const has = marks.built.some((b) => b.id === s.id);
    const built = has
      ? marks.built.filter((b) => b.id !== s.id)
      : [...marks.built, { id: s.id, text: s.text, by: s.authorName, at: Date.now() }];
    const done = has || marks.done.includes(s.id) ? marks.done : [...marks.done, s.id];
    const m = { ...marks, built, done };
    setMarks(m);
    saveMarks(m);
  };

  const remove = async (s: Suggestion) => {
    if (!(await deleteSuggestion(s.id))) {
      setNotice({ reason: 'error' });
      return;
    }
    setList((l) => (l ?? []).filter((x) => x.id !== s.id));
    run.track('dev_suggestion_deleted');
  };

  const more = async () => {
    if (!next) return;
    const res = await allSuggestions(next);
    if (!res.ok) {
      setNotice({ reason: res.reason, retryAfterMs: res.retryAfterMs });
      return;
    }
    setList((old) => mergeById(old ?? [], res.list));
    setNext(res.next);
  };

  // Star and Done need the marks: the list waits for them.
  const ready = list && marks ? list : null;
  const shown = (ready ?? []).filter((s) => {
    const done = marks?.done.includes(s.id) ?? false;
    if (filter === 'new') return !done;
    if (filter === 'done') return done;
    if (filter === 'starred') return marks?.starred.includes(s.id) ?? false;
    if (filter === 'built') return marks?.built.some((b) => b.id === s.id) ?? false;
    return true;
  });

  return (
    <>
      <div className="segmented small" role="tablist" aria-label="Show">
        {FILTERS.map(([f, label]) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`segment${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {label}
          </button>
        ))}
      </div>
      {notice && <Notice state={notice} onClose={() => setNotice(null)} />}
      {filter === 'built' && marks && marks.built.length > 0 && (
        <div className="card built-copy">
          <p className="small-text">
            Built from players’ ideas: copy this for your update post, or send it to Claude to
            credit them in the game’s “You asked, we built it”.
          </p>
          <button
            className="btn small"
            onClick={() => void copyText(builtText(marks.built)).then((ok) => setCopied(ok))}
          >
            {copied ? '✓ Copied' : `📋 Copy the built list (${marks.built.length})`}
          </button>
        </div>
      )}
      {!ready && <p className="muted center">Loading suggestions…</p>}
      {ready && shown.length === 0 && (
        <p className="muted center">
          {filter === 'new' ? 'Nothing new to read. 🎉' : 'Nothing here yet.'}
        </p>
      )}
      {shown.map((s) => {
        const starred = marks?.starred.includes(s.id) ?? false;
        const done = marks?.done.includes(s.id) ?? false;
        const built = marks?.built.some((b) => b.id === s.id) ?? false;
        return (
          <div key={s.id} className={`card idea${done ? ' done' : ''}`}>
            <div className="flag-head">
              <span aria-hidden="true">{TOPICS.find((t) => t.id === s.topic)?.icon}</span>
              <b>{s.authorName}</b>
              <span className="muted">{timeAgo(s.at, now)}</span>
              {seenBefore !== null && s.at > seenBefore && (
                <span className="badge visible">New</span>
              )}
            </div>
            <p className="flag-text">{s.text}</p>
            <div className="flag-actions">
              <button
                className={`btn small${starred ? ' primary' : ''}`}
                aria-pressed={starred}
                onClick={() => mark(s.id, 'starred')}
              >
                {starred ? '⭐ Starred' : '☆ Star'}
              </button>
              <button className="btn small" aria-pressed={done} onClick={() => mark(s.id, 'done')}>
                {done ? '↩ Not done' : '✓ Done'}
              </button>
              <button
                className={`btn small${built ? ' primary' : ''}`}
                aria-pressed={built}
                onClick={() => markBuilt(s)}
              >
                {built ? '🏗️ Built' : '🏗️ Mark built'}
              </button>
              <button className="btn small danger" onClick={() => void remove(s)}>
                Delete
              </button>
            </div>
          </div>
        );
      })}
      {next && (
        <button className="btn" onClick={() => void more()}>
          Load older suggestions
        </button>
      )}
      <p className="muted small-text">
        Stars, Done and Built are kept on your device. Delete removes it for good.
      </p>
    </>
  );
}

/** Newer first, one entry per id. */
function mergeById(a: Suggestion[], b: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  return [...a, ...b]
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    .sort((x, y) => y.at - x.at);
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
