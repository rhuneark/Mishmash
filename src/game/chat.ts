// Chat text: cleaning what players type (in-game chat), and reading the old Town
// Square's UGC entries (the Dev area still lists their reports), validated field
// by field.

export const CHAT_TYPE = 'chat';
export const MAX_MESSAGE = 200;
/** Longest line in a game's chat (it also shows over the speaker's head). */
export const MAX_SAY = 120;
/** Seconds between one player's chat lines in a game. */
export const SAY_GAP = 1.2;

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  at: number;
}

/** What a player typed, ready to post: one line, trimmed, at most `max` characters. */
export function cleanMessage(raw: string, max = MAX_MESSAGE): string {
  const oneLine = raw.replace(/\s+/g, ' ').trim();
  return Array.from(oneLine).slice(0, max).join('').trim();
}

export interface EntryLike {
  id: unknown;
  authorId: unknown;
  authorName: unknown;
  createdAt: unknown;
  status?: unknown;
  data: unknown;
}

/** A displayable message from a UGC entry, or null if it's hidden or malformed. */
export function messageFromEntry(entry: EntryLike): ChatMessage | null {
  if (typeof entry.id !== 'string' || !entry.id) return null;
  if (entry.status === 'removed' || entry.status === 'quarantined') return null;
  const data = entry.data as Record<string, unknown> | null;
  const raw = data && typeof data === 'object' ? data['text'] : null;
  if (typeof raw !== 'string') return null;
  const text = cleanMessage(raw);
  if (!text) return null;
  const name = typeof entry.authorName === 'string' ? entry.authorName.trim() : '';
  return {
    id: entry.id,
    authorId: typeof entry.authorId === 'string' ? entry.authorId : '',
    authorName: name ? Array.from(name).slice(0, 24).join('') : 'Player',
    text,
    at:
      typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt) ? entry.createdAt : 0,
  };
}

/** Short age label: "now", "5m", "3h", "2d". */
export function timeAgo(at: number, now: number): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
