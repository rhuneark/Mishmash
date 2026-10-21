// Town Square chat: messages are UGC entries from other players, so every
// field is validated before it's shown.

export const CHAT_TYPE = 'chat';
export const MAX_MESSAGE = 200;

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  at: number;
}

/** What a player typed, ready to post: one line, trimmed, at most MAX_MESSAGE characters. */
export function cleanMessage(raw: string): string {
  const oneLine = raw.replace(/\s+/g, ' ').trim();
  return Array.from(oneLine).slice(0, MAX_MESSAGE).join('').trim();
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

function byTime(a: ChatMessage, b: ChatMessage): number {
  return a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Union of two message lists (newer copy wins), oldest first. */
export function mergeMessages(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of a) map.set(m.id, m);
  for (const m of b) map.set(m.id, m);
  return [...map.values()].sort(byTime);
}

/**
 * Applies the newest page from the server. Messages inside that page's time
 * window that the server no longer returns were deleted or hidden, so they go.
 * `complete` means the page holds every message (no older ones exist).
 */
export function applyLatest(
  existing: ChatMessage[],
  latest: ChatMessage[],
  complete: boolean,
): ChatMessage[] {
  const ids = new Set(latest.map((m) => m.id));
  const from = complete ? -Infinity : Math.min(...latest.map((m) => m.at));
  const kept = existing.filter((m) => ids.has(m.id) || m.at < from);
  return mergeMessages(kept, latest);
}

/** Short age label: "now", "5m", "3h", "2d". */
export function timeAgo(at: number, now: number): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
