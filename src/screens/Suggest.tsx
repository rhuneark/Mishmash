import { useEffect, useState } from 'react';
import * as run from '../sdk/run';
import { timeAgo } from '../game/chat';
import {
  DAILY_LIMIT,
  MAX_SUGGESTION,
  TOPICS,
  sentToday,
  type Suggestion,
  type Topic,
} from '../game/suggest';
import {
  isLocalPreview,
  mySuggestions,
  sendSuggestion,
  withdrawSuggestion,
} from '../app/community';
import { Notice, type NoticeState } from '../ui/Notice';

/** What players asked for and got (`by`: who suggested it, when known), newest last. */
export const BUILT: { icon: string; name: string; text: string; by?: string }[] = [
  { icon: '🏝️', name: 'Round 1: a survival game', text: 'Bloom Island itself.' },
  { icon: '🌾', name: 'Farming and cooking', text: 'Seeds, garden plots, a cooking pot.' },
  { icon: '🐐', name: 'Island animals', text: 'Hunt them, or feed them until they trust you.' },
  { icon: '⛈️', name: 'Weather', text: 'Rain, storms and fog that change the island.' },
  { icon: '🏹', name: 'Bows and ranged weapons', text: 'Bows, a crossbow, a slingshot.' },
  { icon: '🏠', name: 'Bigger bases', text: 'Floors, roofs, furniture, and an easier build menu.' },
  { icon: '🗝️', name: 'Puzzles and secrets', text: 'A bunker, a shipwreck and buried treasure.' },
];

/** The suggestions box: tell the developer what to add next. */
export function Suggest() {
  const [topic, setTopic] = useState<Topic>('gameplay');
  const [text, setText] = useState('');
  const [mine, setMine] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [extra, setExtra] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    void mySuggestions().then((res) => {
      if (cancelled) return;
      if (res.ok) setMine(res.list);
      else {
        setMine([]);
        if (res.reason !== 'login') setNotice({ reason: 'loadFailed' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const today = sentToday(mine ?? [], now);

  const send = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    setExtra(null);
    const res = await sendSuggestion(topic, text, today);
    setBusy(false);
    setNow(Date.now());
    if (!res.ok) {
      if (res.reason === 'empty') return;
      if (res.reason === 'limit')
        setExtra(`That's ${DAILY_LIMIT} today. Thanks! Send more tomorrow.`);
      else
        setNotice({
          reason: res.reason,
          retryAfterMs: 'retryAfterMs' in res ? res.retryAfterMs : undefined,
        });
      return;
    }
    setText('');
    setSent(true);
    if (res.suggestion) setMine((m) => [res.suggestion as Suggestion, ...(m ?? [])]);
    run.track('suggestion_sent', { topic });
  };

  const withdraw = async (s: Suggestion) => {
    if (!(await withdrawSuggestion(s.id))) {
      setNotice({ reason: 'error' });
      return;
    }
    setMine((m) => (m ?? []).filter((x) => x.id !== s.id));
  };

  return (
    <div className="scroll">
      <div className="page">
        {isLocalPreview() && (
          <div className="preview-tag">Local preview: suggestions stay in this tab</div>
        )}
        <header className="page-head">
          <div className="label">The suggestions box</div>
          <h2 className="page-title">What should the island get next?</h2>
          <p className="muted">
            Tell the developer your idea. Every suggestion is read, and the best ones get built.
          </p>
        </header>

        <div className="card built">
          <div className="label">✅ You asked, we built it</div>
          <ul className="built-list">
            {BUILT.map((b) => (
              <li key={b.name}>
                <span aria-hidden="true">{b.icon}</span>
                <span>
                  <b>{b.name}</b> · {b.text}
                  {b.by && <span className="muted"> · suggested by {b.by}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {notice && <Notice state={notice} onClose={() => setNotice(null)} />}

        <form
          className="card suggest-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <div className="label">Your idea is about…</div>
          <div className="topics" role="radiogroup" aria-label="Topic">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={topic === t.id}
                className={`topic${topic === t.id ? ' on' : ''}`}
                onClick={() => setTopic(t.id)}
              >
                {t.icon} {t.name}
              </button>
            ))}
          </div>
          <textarea
            className="suggest-text"
            value={text}
            maxLength={MAX_SUGGESTION}
            rows={4}
            placeholder="I'd love it if the island had…"
            aria-label="Your suggestion"
            onChange={(e) => {
              setText(e.target.value);
              setSent(false);
            }}
          />
          <div className="suggest-foot">
            <span className="muted small-text">
              {text.length}/{MAX_SUGGESTION}
            </span>
            <button className="btn primary" type="submit" disabled={busy || !text.trim()}>
              {busy ? 'Sending…' : '💡 Send it'}
            </button>
          </div>
          {sent && <p className="suggest-ok">Thanks! Your idea is in the box. 💌</p>}
          {extra && <p className="suggest-ok">{extra}</p>}
        </form>

        {mine && mine.length > 0 && (
          <div className="card">
            <div className="label">Your suggestions</div>
            <ul className="my-suggestions">
              {mine.map((s) => (
                <li key={s.id}>
                  <span className="my-suggestion-text">
                    {TOPICS.find((t) => t.id === s.topic)?.icon} {s.text}
                  </span>
                  <span className="muted small-text">{timeAgo(s.at, now)}</span>
                  <button
                    className="btn small"
                    onClick={() => void withdraw(s)}
                    aria-label={`Take back: ${s.text}`}
                  >
                    Take back
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
