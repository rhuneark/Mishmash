// The player's records across islands (game/records.ts), kept in appStorage and posted to
// RUN's leaderboards: a board is posted when its record beats what it was last given, one
// post at a time and a minute apart (RUN rate-limits them).

import * as run from '../sdk/run';
import {
  BOARDS,
  RECORDS_KEY,
  newRecords,
  noteRecords,
  parseRecords,
  type BoardId,
  type Happened,
  type Records,
} from '../game/records';

const POST_GAP_MS = 65_000;
const POSTED_KEY = 'mishmash_boards';

let records: Records = newRecords();
let loaded: Promise<Records> | null = null;
const listeners = new Set<() => void>();
/** What each board was last given (kept, so a new session doesn't post again). */
let posted: Partial<Record<BoardId, number>> = {};
let lastPost = 0;
let timer = 0;

export function loadRecords(): Promise<Records> {
  loaded ??= (async () => {
    records = parseRecords(await run.getItem(RECORDS_KEY));
    try {
      const raw = await run.getItem(POSTED_KEY);
      const p = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      for (const b of BOARDS) if (typeof p[b.id] === 'number') posted[b.id] = p[b.id] as number;
    } catch {
      posted = {};
    }
    notify();
    schedulePosts();
    return records;
  })();
  return loaded;
}

export const recordsStore = {
  get: (): Records => records,
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

function notify(): void {
  for (const cb of listeners) cb();
}

/** Something happened on an island that may beat a record. */
export function noteHappened(h: Happened): void {
  void loadRecords().then(() => {
    const next = noteRecords(records, h);
    if (JSON.stringify(next) === JSON.stringify(records)) return;
    records = next;
    void run.setItem(RECORDS_KEY, JSON.stringify(records));
    notify();
    schedulePosts();
  });
}

/** Posts the boards whose record moved on, one at a time, a minute apart. */
function schedulePosts(): void {
  if (timer) return;
  const due = BOARDS.find((b) => b.score(records) > (posted[b.id] ?? 0));
  if (!due) return;
  const wait = Math.max(0, lastPost + POST_GAP_MS - Date.now());
  timer = window.setTimeout(() => {
    timer = 0;
    const score = due.score(records);
    lastPost = Date.now();
    void run.submitScore(due.id, score, 60).then((res) => {
      if (res === 'accepted' || res === 'rejected') {
        // Rejected (not a new best for RUN, or a limit): don't keep trying the same score.
        posted = { ...posted, [due.id]: score };
        void run.setItem(POSTED_KEY, JSON.stringify(posted));
      }
      schedulePosts();
    });
  }, wait);
}
