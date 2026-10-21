// Chat, voting and the owner's Dev area on top of the UGC backend: RUN's UGC
// in the host, the local stand-in in `npm run dev`.

import * as run from '../sdk/run';
import type { UgcFail, UgcRow } from '../sdk/run';
import { createLocalUgc } from './localUgc';
import { CHAT_TYPE, cleanMessage, messageFromEntry, type ChatMessage } from '../game/chat';
import { countVotes, voteType, voteTypes, type Counts, type Poll } from '../game/poll';
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

/** True in `npm run dev`: chat and votes are a local stand-in that stays in this tab. */
export function isLocalPreview(): boolean {
  return run.isMock();
}

export function myId(): string {
  return backend().me();
}

export type Failure = { ok: false; reason: UgcFail; retryAfterMs?: number };

// ---------------------------------------------------------------------------
// Chat.

export const CHAT_PAGE = 30;

export interface ChatPage {
  ok: true;
  messages: ChatMessage[];
  /** Cursor for older messages; absent when this page reached the start. */
  next?: string;
}

function toMessages(rows: UgcRow[]): ChatMessage[] {
  return rows.map(messageFromEntry).filter((m): m is ChatMessage => m !== null);
}

/** The newest page (cursor absent) or an older one. */
export async function chatPage(cursor?: string): Promise<ChatPage | Failure> {
  const res = await backend().browse({ types: [CHAT_TYPE], limit: CHAT_PAGE, cursor });
  if (!res.ok) return res;
  return { ok: true, messages: toMessages(res.value.rows), next: res.value.next };
}

export type PostResult =
  | { ok: true; message: ChatMessage | null }
  | { ok: false; reason: UgcFail | 'empty' | 'unclean'; retryAfterMs?: number };

/** Posts a message. `message` is null when RUN's filter held it for review. */
export async function postChat(raw: string): Promise<PostResult> {
  const text = cleanMessage(raw);
  if (!text) return { ok: false, reason: 'empty' };
  if (!(await backend().isClean(text))) return { ok: false, reason: 'unclean' };
  const res = await backend().create(CHAT_TYPE, { v: 1, text });
  if (!res.ok) return res;
  return { ok: true, message: messageFromEntry(res.value) };
}

let ownerCheck: Promise<boolean> | null = null;

/** True only for the game's owner (the user): they may delete anyone's message. */
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

/** Deletes a message: players only their own, the owner anyone's. */
export async function deleteChat(m: ChatMessage): Promise<boolean> {
  const me = myId();
  if (me && m.authorId === me) return backend().remove(m.id);
  return (await isOwner()) ? backend().adminRemove(m.id) : false;
}

export function reportChat(id: string): Promise<boolean> {
  return backend().report(id);
}

// ---------------------------------------------------------------------------
// Dev area (owner only): reported messages. RUN refuses these calls for anyone
// but the game's owner and editors; the tab only shows for the owner.

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
// Votes: one per person. Every vote entry of the poll is read and only each
// player's newest counts (countVotes); this player's extra entries (left by a
// failed delete) are cleaned up when found.

export const VOTE_PAGE = 100;
/** Pages read per refresh: counts are exact up to VOTE_PAGE × VOTE_PAGES entries. */
export const VOTE_PAGES = 30;

export interface MyVote {
  option: string | null;
  /** Ids of this player's vote entries for the poll. */
  entryIds: string[];
}

export interface PollState {
  ok: true;
  counts: Counts;
  mine: MyVote;
}

export async function loadPoll(poll: Poll): Promise<PollState | Failure> {
  const rows: UgcRow[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < VOTE_PAGES; page++) {
    const res = await backend().browse({ types: voteTypes(poll), limit: VOTE_PAGE, cursor });
    if (!res.ok) return res;
    rows.push(...res.value.rows);
    cursor = res.value.next;
    if (!cursor) break;
  }
  const { counts, byAuthor, extras } = countVotes(poll, rows);
  const me = myId();
  for (const e of extras) if (me && e.authorId === me) void backend().remove(e.id);
  const counted = me ? byAuthor.get(me) : undefined;
  return {
    ok: true,
    counts,
    mine: counted
      ? { option: counted.option, entryIds: [counted.id] }
      : { option: null, entryIds: [] },
  };
}

/** Votes for `option`, then removes the player's previous vote entries. */
export async function castVote(
  poll: Poll,
  option: string,
  previous: MyVote,
): Promise<{ ok: true; vote: MyVote } | Failure> {
  const res = await backend().create(voteType(poll.id, option), { v: 1, poll: poll.id, option });
  if (!res.ok) return res;
  await Promise.all(previous.entryIds.map((id) => backend().remove(id)));
  return { ok: true, vote: { option, entryIds: [res.value.id] } };
}
