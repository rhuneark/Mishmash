// Local stand-in for RUN's UGC, used by `npm run dev` (the mock SDK can't store
// entries). Same contract as run.ugc, kept in memory, seeded with a few sample
// players (and reports) so the chat, the vote and the Dev area have something
// to show. Mirrors the server's rules: players delete only their own entries,
// 3 reports hide an entry, admin calls need the owner. Never used in the RUN
// host. `owner` plays the game's owner (dev URL `?owner`).

import type { ReportRow, UgcApi, UgcRow } from '../sdk/run';
import { BASE_POLL, voteType } from '../game/poll';
import { CHAT_TYPE } from '../game/chat';

const ME = 'local-you';
const HIDE_AT_REPORTS = 3;

export function createLocalUgc(owner = false, now: () => number = Date.now): UgcApi {
  let seq = 0;
  const rows: UgcRow[] = [];
  const reports: ReportRow[] = [];
  const add = (
    contentType: string,
    authorId: string,
    authorName: string,
    data: unknown,
    ago = 0,
  ) => {
    const row: UgcRow = {
      id: `local-${++seq}`,
      contentType,
      authorId,
      authorName,
      createdAt: now() - ago,
      status: 'active',
      data,
    };
    rows.push(row);
    return row;
  };
  const fileReport = (entryId: string, reporterId: string, reason: string, ago = 0) => {
    if (reports.some((r) => r.entryId === entryId && r.reporterId === reporterId)) return;
    reports.push({
      id: `report-${++seq}`,
      entryId,
      reporterId,
      reason,
      details: '',
      createdAt: now() - ago,
      status: 'pending',
    });
    const row = rows.find((r) => r.id === entryId);
    const count = reports.filter((r) => r.entryId === entryId).length;
    if (row && row.status === 'active' && count >= HIDE_AT_REPORTS) row.status = 'quarantined';
  };

  const min = 60_000;
  add(
    CHAT_TYPE,
    'local-pip',
    'Pip',
    { v: 1, text: 'first! what is this game going to be?' },
    42 * min,
  );
  const nova = add(
    CHAT_TYPE,
    'local-nova',
    'Nova',
    { v: 1, text: 'ARPG with loot please 🗡️' },
    30 * min,
  );
  const spam = add(
    CHAT_TYPE,
    'local-zed',
    'Zed',
    { v: 1, text: 'FREE GOLD click my profile!!!' },
    20 * min,
  );
  const bram = add(
    CHAT_TYPE,
    'local-bram',
    'Bram',
    { v: 1, text: 'a roguelike where every run adds a new idea?' },
    12 * min,
  );
  // Seeded reports: the spam is hidden (3 reports), Bram's message has one open
  // report, and one report on Nova's message was already dismissed.
  for (const who of ['local-pip', 'local-nova', 'local-bram'])
    fileReport(spam.id, who, 'spam', 15 * min);
  fileReport(bram.id, 'local-pip', 'inappropriate', 8 * min);
  fileReport(nova.id, 'local-bram', 'other', 25 * min);
  for (const r of reports) if (r.entryId === nova.id) r.status = 'dismissed';

  const seedVotes: Record<string, number> = {
    arpg: 5,
    roguelike: 3,
    platformer: 2,
    story: 2,
    idle: 1,
  };
  for (const [option, n] of Object.entries(seedVotes)) {
    for (let i = 0; i < n; i++) {
      const voter = `local-voter-${option}-${i}`;
      add(voteType(BASE_POLL.id, option), voter, 'Voter', { v: 1, option }, 60 * min);
    }
  }
  // A voter with a second, newer vote: only that one counts (roguelike, not arpg).
  add(voteType(BASE_POLL.id, 'roguelike'), 'local-voter-arpg-0', 'Voter', { v: 1 }, 5 * min);

  const denied = { ok: false as const, reason: 'error' as const };

  return {
    me: () => ME,

    async role() {
      return owner ? 'owner' : 'none';
    },

    async create(contentType, data) {
      return { ok: true, value: add(contentType, ME, 'You', data) };
    },

    async browse(q) {
      const matching = rows
        .filter(
          (r) =>
            r.status === 'active' &&
            q.types.includes(r.contentType) &&
            (!q.authorId || r.authorId === q.authorId),
        )
        .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1));
      const start = q.cursor ? Number(q.cursor) : 0;
      const limit = q.limit ?? 30;
      const page = matching.slice(start, start + limit);
      const next = start + limit < matching.length ? String(start + limit) : undefined;
      return { ok: true, value: { rows: page, next } };
    },

    async remove(id) {
      const i = rows.findIndex((r) => r.id === id && r.authorId === ME);
      if (i >= 0) rows.splice(i, 1);
      return i >= 0;
    },

    async adminRemove(id) {
      const row = owner ? rows.find((r) => r.id === id) : undefined;
      if (row) row.status = 'removed';
      return Boolean(row);
    },

    async report(id) {
      fileReport(id, ME, 'inappropriate');
      return true;
    },

    async isClean(text) {
      return !/\bbadword\b/i.test(text);
    },

    async reports(status) {
      if (!owner) return denied;
      return { ok: true, value: reports.filter((r) => r.status === status).map((r) => ({ ...r })) };
    },

    async resolveReport(id, action) {
      const report = owner ? reports.find((r) => r.id === id) : undefined;
      if (report) report.status = action;
      return Boolean(report);
    },

    async adminEntries(ids, contentType) {
      if (!owner) return denied;
      const wanted = new Set(ids);
      return {
        ok: true,
        value: rows
          .filter((r) => wanted.has(r.id) && r.contentType === contentType)
          .map((r) => ({ ...r })),
      };
    },
  };
}
