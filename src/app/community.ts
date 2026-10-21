// Chat and voting on top of the UGC backend: RUN's UGC in the host, the local
// stand-in in `npm run dev`.

import * as run from '../sdk/run';
import type { UgcFail, UgcRow } from '../sdk/run';
import { createLocalUgc } from './localUgc';
import { CHAT_TYPE, cleanMessage, messageFromEntry, type ChatMessage } from '../game/chat';
import { optionForType, voteType, voteTypes, type Counts, type Poll } from '../game/poll';

let api: run.UgcApi | null = null;

function backend(): run.UgcApi {
  if (!api) api = run.isMock() ? createLocalUgc() : run.ugc;
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

export function deleteChat(id: string): Promise<boolean> {
  return backend().remove(id);
}

export function reportChat(id: string): Promise<boolean> {
  return backend().report(id);
}

// ---------------------------------------------------------------------------
// Votes. A player's vote is their newest entry among the poll's vote types;
// older ones (left by a failed delete) are cleaned up when found.

export interface MyVote {
  option: string | null;
  /** Ids of this player's vote entries for the poll, newest first. */
  entryIds: string[];
}

/** Vote totals per option; null if none could be read. */
export async function loadCounts(poll: Poll): Promise<Counts | null> {
  const counts: Counts = {};
  let any = false;
  for (const o of poll.options) {
    const n = await backend().count(voteType(poll.id, o.id));
    if (n !== null) {
      counts[o.id] = n;
      any = true;
    }
  }
  return any ? counts : null;
}

export async function loadMyVote(poll: Poll): Promise<MyVote | null> {
  const me = myId();
  if (!me) return { option: null, entryIds: [] };
  const res = await backend().browse({ types: voteTypes(poll), authorId: me, limit: 20 });
  if (!res.ok) return null;
  const mine = res.value.rows.filter(
    (r) => r.authorId === me && optionForType(poll, r.contentType),
  );
  const [newest, ...stale] = mine;
  for (const r of stale) void backend().remove(r.id);
  return newest
    ? { option: optionForType(poll, newest.contentType), entryIds: [newest.id] }
    : { option: null, entryIds: [] };
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
