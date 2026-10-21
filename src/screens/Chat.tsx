import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import * as run from '../sdk/run';
import {
  MAX_MESSAGE,
  applyLatest,
  cleanMessage,
  mergeMessages,
  timeAgo,
  type ChatMessage,
} from '../game/chat';
import {
  chatPage,
  deleteChat,
  isLocalPreview,
  isOwner,
  myId,
  postChat,
  reportChat,
} from '../app/community';
import { usePolling } from '../app/usePolling';
import { Notice, type NoticeState } from '../ui/Notice';

const REFRESH_MS = 15_000;
const NAME_COLORS = ['var(--tile-0)', 'var(--tile-1)', 'var(--tile-2)', 'var(--tile-3)'];

function nameColor(authorId: string): string {
  let h = 0;
  for (const ch of authorId) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return NAME_COLORS[Math.abs(h) % NAME_COLORS.length] as string;
}

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [older, setOlder] = useState<string | undefined>(undefined);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const keepFromBottom = useRef<number | null>(null);
  const me = myId();
  // The game's owner may delete anyone's message; everyone else only their own.
  const [owner, setOwner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isOwner().then((yes) => !cancelled && setOwner(yes));
    return () => {
      cancelled = true;
    };
  }, []);

  usePolling(async () => {
    const res = await chatPage();
    setNow(Date.now());
    if (!res.ok) {
      if (!loaded) setNotice({ reason: res.reason === 'login' ? 'login' : 'loadFailed' });
      return res.reason === 'rate' ? Math.max(REFRESH_MS, res.retryAfterMs ?? 0) : undefined;
    }
    setMessages((prev) => applyLatest(prev, res.messages, !res.next));
    if (!loaded) {
      setOlder(res.next);
      setLoaded(true);
      setNotice((n) => (n?.reason === 'loadFailed' ? null : n));
    }
    return undefined;
  }, REFRESH_MS);

  // Follow new messages while the player is at the bottom; keep the view still
  // when older ones are added above.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (keepFromBottom.current !== null) {
      el.scrollTop = el.scrollHeight - keepFromBottom.current;
      keepFromBottom.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, loaded]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const loadOlder = async () => {
    if (!older || loadingOlder) return;
    setLoadingOlder(true);
    const res = await chatPage(older);
    setLoadingOlder(false);
    if (!res.ok) {
      setNotice({ reason: res.reason, retryAfterMs: res.retryAfterMs });
      return;
    }
    const el = listRef.current;
    if (el) keepFromBottom.current = el.scrollHeight - el.scrollTop;
    setOlder(res.next);
    setMessages((prev) => mergeMessages(prev, res.messages));
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (sending || !cleanMessage(draft)) return;
    setSending(true);
    setNotice(null);
    const res = await postChat(draft);
    setSending(false);
    if (!res.ok) {
      if (res.reason !== 'empty') setNotice({ reason: res.reason, retryAfterMs: res.retryAfterMs });
      return;
    }
    setDraft('');
    const posted = res.message;
    if (posted) {
      stickToBottom.current = true;
      setMessages((prev) => mergeMessages(prev, [posted]));
    } else {
      setNotice({ reason: 'held' });
    }
    run.track('chat_sent');
  };

  const remove = async (m: ChatMessage) => {
    setSelected(null);
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    if (!(await deleteChat(m))) {
      setMessages((prev) => mergeMessages(prev, [m]));
      setNotice({ reason: 'error' });
    }
  };

  const report = async (m: ChatMessage) => {
    setSelected(null);
    setHidden((h) => new Set(h).add(m.id));
    setNotice({ reason: 'reported' });
    void reportChat(m.id);
    run.track('chat_reported');
  };

  const left = MAX_MESSAGE - Array.from(draft).length;
  const shown = messages.filter((m) => !hidden.has(m.id));

  return (
    <div className="chat">
      <header className="chat-head">
        <h2 className="page-title">Town Square</h2>
        <p className="muted">Talk about what Mishmash should become.</p>
        {isLocalPreview() && (
          <div className="preview-tag">Local preview: chat stays in this tab</div>
        )}
      </header>

      <div className="chat-list" ref={listRef} onScroll={onScroll}>
        {older ? (
          <button
            className="btn small ghost"
            disabled={loadingOlder}
            onClick={() => void loadOlder()}
          >
            {loadingOlder ? 'Loading…' : 'Load older messages'}
          </button>
        ) : (
          <div className="card pinned">
            📌 Welcome to the Town Square! Say hi, pitch ideas, and tell everyone what Mishmash
            should become.
          </div>
        )}
        {!loaded && <p className="muted center">Loading chat…</p>}
        {loaded && shown.length === 0 && (
          <p className="muted center">No messages yet. Be the first!</p>
        )}
        {shown.map((m) => {
          const mine = Boolean(me) && m.authorId === me;
          const open = selected === m.id;
          return (
            <div key={m.id} className={`msg${mine ? ' mine' : ''}`}>
              <button
                className="msg-bubble"
                aria-expanded={open}
                onClick={() => setSelected(open ? null : m.id)}
              >
                <span className="msg-head">
                  <span className="msg-name" style={{ color: nameColor(m.authorId) }}>
                    {mine ? 'You' : m.authorName}
                  </span>
                  <span className="msg-time">{timeAgo(m.at, now)}</span>
                </span>
                <span className="msg-text">{m.text}</span>
              </button>
              {open && (
                <div className="msg-actions">
                  {mine || owner ? (
                    <button className="btn small" onClick={() => void remove(m)}>
                      Delete
                    </button>
                  ) : (
                    <button className="btn small" onClick={() => void report(m)}>
                      Report
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {notice && <Notice state={notice} onClose={() => setNotice(null)} />}

      <form className="composer" onSubmit={(e) => void send(e)}>
        <input
          className="composer-input"
          value={draft}
          maxLength={MAX_MESSAGE}
          placeholder="Say something…"
          enterKeyHint="send"
          aria-label="Message"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn primary" type="submit" disabled={sending || !cleanMessage(draft)}>
          {sending ? '…' : 'Send'}
        </button>
        {left < 40 && <span className="composer-left">{left}</span>}
      </form>
    </div>
  );
}
