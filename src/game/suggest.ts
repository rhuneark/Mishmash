// The suggestions box: players send the developer ideas for the island (UGC entries of
// type `suggest`), and the game's owner reads them in the Dev area. Pure: cleaning,
// validating entries, the daily limit and the owner's marks.

import { cleanMessage, type EntryLike } from './chat';

export const SUGGEST_TYPE = 'suggest';
export const MAX_SUGGESTION = 300;
/** Suggestions one player may send a day (a courtesy limit; RUN caps entries too). */
export const DAILY_LIMIT = 5;

export const TOPICS = [
  { id: 'gameplay', icon: '🎮', name: 'Gameplay' },
  { id: 'building', icon: '🔨', name: 'Building' },
  { id: 'creatures', icon: '🐾', name: 'Creatures' },
  { id: 'island', icon: '🏝️', name: 'The island' },
  { id: 'other', icon: '💡', name: 'Something else' },
] as const;

export type Topic = (typeof TOPICS)[number]['id'];

export interface Suggestion {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  topic: Topic;
  at: number;
}

/** What a player typed: one paragraph, trimmed, at most MAX_SUGGESTION characters. */
export function cleanSuggestion(raw: string): string {
  return cleanMessage(raw, MAX_SUGGESTION);
}

export function isTopic(v: unknown): v is Topic {
  return TOPICS.some((t) => t.id === v);
}

/** A suggestion from a UGC entry, or null if it's hidden or malformed. */
export function suggestionFromEntry(entry: EntryLike): Suggestion | null {
  if (typeof entry.id !== 'string' || !entry.id) return null;
  if (entry.status === 'removed' || entry.status === 'quarantined') return null;
  const data = entry.data as Record<string, unknown> | null;
  const raw = data && typeof data === 'object' ? data['text'] : null;
  if (typeof raw !== 'string') return null;
  const text = cleanSuggestion(raw);
  if (!text) return null;
  const topic = data?.['topic'];
  const name = typeof entry.authorName === 'string' ? entry.authorName.trim() : '';
  return {
    id: entry.id,
    authorId: typeof entry.authorId === 'string' ? entry.authorId : '',
    authorName: name ? Array.from(name).slice(0, 24).join('') : 'Player',
    text,
    topic: isTopic(topic) ? topic : 'other',
    at:
      typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt) ? entry.createdAt : 0,
  };
}

/** How many of these were sent in the last 24 hours. */
export function sentToday(list: readonly Suggestion[], now: number): number {
  return list.filter((s) => now - s.at < 86_400_000).length;
}

/** The owner's own marks on suggestions, kept on their device (appStorage). */
export interface DevMarks {
  /** Newest suggestion time the owner has seen (newer ones count as new). */
  seenAt: number;
  starred: string[];
  done: string[];
  /** Suggestions the owner built, with who asked (for the next "You asked, we built it"). */
  built: BuiltMark[];
}

export interface BuiltMark {
  id: string;
  text: string;
  by: string;
  at: number;
}

export const MARKS_KEY = 'mishmash_dev_marks';

export function parseMarks(raw: unknown): DevMarks {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const ids = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-2000) : [];
  const seen = d['seenAt'];
  const built = Array.isArray(d['built']) ? d['built'] : [];
  return {
    seenAt: typeof seen === 'number' && Number.isFinite(seen) ? seen : 0,
    starred: ids(d['starred']),
    done: ids(d['done']),
    built: built
      .map((b): BuiltMark | null => {
        const o = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
        if (typeof o['id'] !== 'string' || typeof o['text'] !== 'string') return null;
        return {
          id: o['id'],
          text: o['text'].slice(0, MAX_SUGGESTION),
          by: typeof o['by'] === 'string' ? o['by'].slice(0, 24) : 'Player',
          at: typeof o['at'] === 'number' && Number.isFinite(o['at']) ? o['at'] : 0,
        };
      })
      .filter((b): b is BuiltMark => b !== null)
      .slice(-200),
  };
}

/** The built list as text to paste (Discord, or the next update's credits). */
export function builtText(list: readonly BuiltMark[]): string {
  return list.map((b) => `• ${b.text} (suggested by ${b.by})`).join('\n');
}

/** Suggestions newer than the owner last looked (and not already marked done). */
export function newCount(list: readonly Suggestion[], marks: DevMarks): number {
  return list.filter((s) => s.at > marks.seenAt && !marks.done.includes(s.id)).length;
}
