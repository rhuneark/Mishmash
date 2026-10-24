// The suggestions box and the owner's Dev area on top of the UGC backend: RUN's
// UGC in the host, the local stand-in in `npm run dev`.

import * as run from '../sdk/run';
import type { UgcFail, UgcRow } from '../sdk/run';
import { createLocalUgc } from './localUgc';
import { CHAT_TYPE, messageFromEntry, type ChatMessage } from '../game/chat';
import {
  DAILY_LIMIT,
  MARKS_KEY,
  SUGGEST_TYPE,
  cleanSuggestion,
  newCount,
  parseMarks,
  suggestionFromEntry,
  type DevMarks,
  type Suggestion,
  type Topic,
} from '../game/suggest';
import { groupReports, type ReportGroup } from '../game/moderation';

let api: run.UgcApi | null = null;

function backend(): run.UgcApi {
  if (!api) {
    api = run.isMock()
      ? createLocalUgc(new URLSearchParams(window.location.search).has('owner'))
      : run.ugc;
  }
  return api;
}

/** True in `npm run dev`: suggestions and reports are a local stand-in that stays in this tab. */
export function isLocalPreview(): boolean {
  return run.isMock();
}

export function myId(): string {
  return backend().me();
}

export type Failure = { ok: false; reason: UgcFail; retryAfterMs?: number };

// ---------------------------------------------------------------------------
// The game's owner.

let ownerCheck: Promise<boolean> | null = null;

/** True only for the game's owner (the user): they get the Dev area. */
export function isOwner(): Promise<boolean> {
  if (!ownerCheck) {
    ownerCheck = backend()
      .role()
      .then((role) => role === 'owner');
    // A failed check (e.g. before sign-in) may succeed later.
    void ownerCheck.then((yes) => {
      if (!yes) ownerCheck = null;
    });
  }
  return ownerCheck;
}

// ---------------------------------------------------------------------------
// Dev area (owner only): reported messages. RUN refuses these calls for anyone
// but the game's owner and editors; the Dev button only shows for the owner.

/** visible: players see it; hidden: auto-hidden (e.g. 3 reports); deleted: removed by
 *  the owner; missing: deleted by its author, or too old to look up. */
export type FlaggedState = 'visible' | 'hidden' | 'deleted' | 'missing';

export interface Flagged {
  group: ReportGroup;
  message: ChatMessage | null;
  state: FlaggedState;
}

export async function loadFlagged(
  view: 'open' | 'resolved',
): Promise<{ ok: true; items: Flagged[] } | Failure> {
  const statuses: run.ReportStatus[] = view === 'open' ? ['pending'] : ['reviewed', 'dismissed'];
  const reports: run.ReportRow[] = [];
  for (const status of statuses) {
    const res = await backend().reports(status);
    if (!res.ok) return res;
    reports.push(...res.value);
  }
  const groups = groupReports(reports);
  if (groups.length === 0) return { ok: true, items: [] };
  const entries = await backend().adminEntries(
    groups.map((g) => g.entryId),
    CHAT_TYPE,
  );
  if (!entries.ok) return entries;
  const byId = new Map(entries.value.map((e) => [e.id, e]));
  return {
    ok: true,
    items: groups.map((group) => {
      const row = byId.get(group.entryId);
      if (!row) return { group, message: null, state: 'missing' };
      const state: FlaggedState =
        row.status === 'active' ? 'visible' : row.status === 'removed' ? 'deleted' : 'hidden';
      return { group, message: messageFromEntry({ ...row, status: 'active' }), state };
    }),
  };
}

/** Number of messages with open reports, or null if it can't be read. */
export async function openReportCount(): Promise<number | null> {
  const res = await backend().reports('pending');
  return res.ok ? new Set(res.value.map((r) => r.entryId)).size : null;
}

/** Deletes a reported message (if it still exists) and closes its reports as reviewed. */
export async function deleteFlagged(item: Flagged): Promise<boolean> {
  if (item.state === 'visible' || item.state === 'hidden') {
    if (!(await backend().adminRemove(item.group.entryId))) return false;
  }
  return resolveAll(item, 'reviewed');
}

/** Keeps the message and closes its reports as dismissed. */
export function keepFlagged(item: Flagged): Promise<boolean> {
  return resolveAll(item, 'dismissed');
}

async function resolveAll(item: Flagged, action: 'reviewed' | 'dismissed'): Promise<boolean> {
  const done = await Promise.all(
    item.group.reportIds.map((id) => backend().resolveReport(id, action)),
  );
  return done.every(Boolean);
}

// ---------------------------------------------------------------------------
// The suggestions box: players send ideas, the owner reads them in the Dev area.

export type SendFailure = Failure | { ok: false; reason: 'empty' | 'unclean' | 'limit' };

/** This player's own suggestions, newest first. */
export async function mySuggestions(): Promise<{ ok: true; list: Suggestion[] } | Failure> {
  const me = myId();
  if (!me) return { ok: true, list: [] };
  const res = await backend().browse({ types: [SUGGEST_TYPE], authorId: me, limit: 50 });
  if (!res.ok) return res;
  return { ok: true, list: toSuggestions(res.value.rows) };
}

/** Sends a suggestion (checked with RUN's word filter first). */
export async function sendSuggestion(
  topic: Topic,
  raw: string,
  sentToday: number,
): Promise<{ ok: true; suggestion: Suggestion | null } | SendFailure> {
  const text = cleanSuggestion(raw);
  if (!text) return { ok: false, reason: 'empty' };
  if (sentToday >= DAILY_LIMIT) return { ok: false, reason: 'limit' };
  if (!(await backend().isClean(text))) return { ok: false, reason: 'unclean' };
  const res = await backend().create(SUGGEST_TYPE, { v: 1, text, topic });
  if (!res.ok) return res;
  return { ok: true, suggestion: suggestionFromEntry(res.value) };
}

/** Takes back one of your own suggestions. */
export function withdrawSuggestion(id: string): Promise<boolean> {
  return backend().remove(id);
}

export const SUGGEST_PAGE = 50;

/** Everyone's suggestions, newest first (the owner's Dev area). */
export async function allSuggestions(
  cursor?: string,
): Promise<{ ok: true; list: Suggestion[]; next?: string } | Failure> {
  const res = await backend().browse({ types: [SUGGEST_TYPE], limit: SUGGEST_PAGE, cursor });
  if (!res.ok) return res;
  return { ok: true, list: toSuggestions(res.value.rows), next: res.value.next };
}

/** Deletes anyone's suggestion (owner only; RUN refuses everyone else). */
export function deleteSuggestion(id: string): Promise<boolean> {
  return backend().adminRemove(id);
}

function toSuggestions(rows: UgcRow[]): Suggestion[] {
  return rows.map(suggestionFromEntry).filter((s): s is Suggestion => s !== null);
}

/** The owner's marks (seen, starred, done), kept in appStorage. */
export async function loadMarks(): Promise<DevMarks> {
  const raw = await run.getItem(MARKS_KEY);
  try {
    return parseMarks(raw ? JSON.parse(raw) : null);
  } catch {
    return parseMarks(null);
  }
}

export function saveMarks(marks: DevMarks): void {
  void run.setItem(MARKS_KEY, JSON.stringify(marks));
}

/** Suggestions the owner hasn't seen yet (the newest page), or null if unknown. */
export async function newSuggestionCount(): Promise<number | null> {
  const res = await allSuggestions();
  if (!res.ok) return null;
  return newCount(res.list, await loadMarks());
}
