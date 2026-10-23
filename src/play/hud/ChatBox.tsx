// The island's chat (co-op only): what everyone said, a line to type, and muting.
// Lines go through RUN's word filter on every phone (client.chatFilter / chatCheck).

import { useEffect, useRef, useState } from 'react';
import { MAX_SAY } from '../../game/chat';
import type { ChatLine, GameClient } from '../client';

const isPc = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches;

function colorOf(client: GameClient, id: string): string {
  const c = client.players.find((p) => p.id === id)?.color ?? 0xffffff;
  return `#${c.toString(16).padStart(6, '0')}`;
}

/** The chat window (💬, or Enter on PC). */
export function ChatBox({ client }: { client: GameClient }) {
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [people, setPeople] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const others = client.players.filter((p) => p.id !== client.you);

  useEffect(() => {
    field.current?.focus();
  }, []);

  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [client.chat.length]);

  const send = async () => {
    const r = await client.say(text);
    if (r === 'ok') {
      setText('');
      setNote(null);
      // On PC, Enter sends and hands the keys back to the game.
      if (isPc()) client.toggleChat(false);
    } else if (r === 'slow') setNote('Slow down a little.');
    else if (r === 'unfriendly') setNote("Keep it friendly: RUN's filter stopped that line.");
  };

  return (
    <div className="chat-box" role="dialog" aria-label="Island chat">
      <div className="chat-box-head">
        <span className="chat-box-title">💬 Island chat</span>
        {others.length > 0 && (
          <button className="btn small" aria-expanded={people} onClick={() => setPeople(!people)}>
            👥 {others.length}
          </button>
        )}
        <button
          className="round-btn"
          onClick={() => client.toggleChat(false)}
          aria-label="Close chat"
        >
          ✕
        </button>
      </div>
      {people && (
        <div className="chat-people">
          {others.map((p) => {
            const muted = client.muted.has(p.id);
            return (
              <div key={p.id} className="chat-person">
                <span className="chat-dot" style={{ background: colorOf(client, p.id) }} />
                <span className="chat-person-name">{p.name}</span>
                <button className="btn small" onClick={() => client.mute(p.id, !muted)}>
                  {muted ? '🔊 Unmute' : '🔇 Mute'}
                </button>
              </div>
            );
          })}
          <p className="muted small-text">Muting hides their lines for you, in this game.</p>
        </div>
      )}
      <div className="chat-lines" ref={list}>
        {client.chat.length === 0 ? (
          <p className="muted small-text">Nothing said yet. Say hi to your crew!</p>
        ) : (
          client.chat.map((l) => <ChatRow key={l.id} client={client} line={l} />)
        )}
      </div>
      {note && (
        <div className="chat-note" role="status">
          {note}
        </div>
      )}
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          ref={field}
          value={text}
          maxLength={MAX_SAY}
          placeholder="Say something…"
          aria-label="Chat message"
          autoComplete="off"
          enterKeyHint="send"
          onChange={(e) => {
            setText(e.target.value);
            setNote(null);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            client.toggleChat(false);
          }}
        />
        <button className="btn small primary" type="submit" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

function ChatRow({ client, line }: { client: GameClient; line: ChatLine }) {
  return (
    <div className={`chat-line${line.mine ? ' mine' : ''}`}>
      <b style={{ color: colorOf(client, line.from) }}>{line.mine ? 'You' : line.name}</b>{' '}
      {line.text}
    </div>
  );
}

/** The newest lines over the game while the chat is closed (tap to open it). */
export function ChatLog({ client }: { client: GameClient }) {
  const lines = client.recentChat();
  if (!lines.length) return null;
  return (
    <button className="chat-log" onClick={() => client.toggleChat(true)} aria-label="Open chat">
      {lines.map((l) => (
        <ChatRow key={l.id} client={client} line={l} />
      ))}
    </button>
  );
}
