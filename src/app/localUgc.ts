// Local stand-in for RUN's UGC, used by `npm run dev` (the mock SDK can't store
// entries). Same contract as run.ugc, kept in memory, seeded with a few sample
// players so the chat and the vote have something to show. Never used in the
// RUN host. `owner` plays the game's owner (dev URL `?owner`).

import type { UgcApi, UgcRow } from '../sdk/run';
import { BASE_POLL, voteType } from '../game/poll';
import { CHAT_TYPE } from '../game/chat';

const ME = 'local-you';

export function createLocalUgc(owner = false, now: () => number = Date.now): UgcApi {
  let seq = 0;
  const rows: UgcRow[] = [];
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

  const min = 60_000;
  add(
    CHAT_TYPE,
    'local-pip',
    'Pip',
    { v: 1, text: 'first! what is this game going to be?' },
    42 * min,
  );
  add(CHAT_TYPE, 'local-nova', 'Nova', { v: 1, text: 'ARPG with loot please 🗡️' }, 30 * min);
  add(
    CHAT_TYPE,
    'local-bram',
    'Bram',
    { v: 1, text: 'a roguelike where every run adds a new idea?' },
    12 * min,
  );
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
          (r) => q.types.includes(r.contentType) && (!q.authorId || r.authorId === q.authorId),
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
      const i = owner ? rows.findIndex((r) => r.id === id) : -1;
      if (i >= 0) rows.splice(i, 1);
      return i >= 0;
    },

    async report(id) {
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
      return true;
    },

    async isClean(text) {
      return !/\bbadword\b/i.test(text);
    },
  };
}
