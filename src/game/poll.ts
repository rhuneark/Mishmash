// Community polls. Each player's vote is one UGC entry whose content type names
// the option (voteType). Tallies count one vote per person (countVotes), so
// extra entries from a failed delete or a tampered client never count. Never
// rename a live poll or option id: its votes stay under the old content type.

export interface PollOption {
  id: string;
  name: string;
  blurb: string;
  icon: string;
}

export interface Poll {
  id: string;
  title: string;
  question: string;
  open: boolean;
  options: readonly PollOption[];
}

/** Round 1, closed: the base became the island survival game. */
export const BASE_POLL: Poll = {
  id: 'base',
  title: 'Round 1: Pick the base',
  question: 'What kind of game should Mishmash be at its core?',
  open: false,
  options: [
    { id: 'arpg', name: 'Action RPG', blurb: 'Hack, slash and loot', icon: '⚔️' },
    { id: 'platformer', name: 'Platformer', blurb: 'Run, jump, explore', icon: '🏃' },
    { id: 'story', name: 'Story adventure', blurb: 'Choices, characters, secrets', icon: '📖' },
    { id: 'roguelike', name: 'Roguelike', blurb: 'Every run is different', icon: '🎲' },
    { id: 'survival', name: 'Survival & crafting', blurb: 'Gather, build, survive', icon: '🏕️' },
    { id: 'towerdefense', name: 'Tower defense', blurb: 'Build up, hold the line', icon: '🏰' },
    { id: 'puzzle', name: 'Puzzle', blurb: 'Clever brain-teasers', icon: '🧩' },
    { id: 'idle', name: 'Idle tycoon', blurb: 'Grow an empire, even offline', icon: '💰' },
  ],
};

export const NEXT_POLL: Poll = {
  id: 'next1',
  title: 'Round 2: What gets added next?',
  question: 'The island is live. What should we build into it next?',
  open: true,
  options: [
    {
      id: 'boats',
      name: 'Boats & a second island',
      blurb: 'Build a raft, sail somewhere new',
      icon: '🛶',
    },
    { id: 'farming', name: 'Farming & cooking', blurb: 'Grow crops, cook real meals', icon: '🌾' },
    { id: 'pets', name: 'Tame animals', blurb: 'Pets that fight, mounts that carry', icon: '🐕' },
    { id: 'weather', name: 'Storms & weather', blurb: 'Rain, fog, lightning, tides', icon: '⛈️' },
    { id: 'ranged', name: 'Bows & ranged weapons', blurb: 'Hit the Bloom from afar', icon: '🏹' },
    { id: 'monsters', name: 'New Bloom monsters', blurb: 'Nastier things in the dark', icon: '👹' },
    { id: 'bases', name: 'Bigger bases', blurb: 'Floors, roofs, furniture, traps', icon: '🏠' },
    {
      id: 'secrets',
      name: 'Puzzles & secrets',
      blurb: 'Hidden bunkers, codes, more story',
      icon: '🧩',
    },
  ],
};

/** The poll the Vote tab shows. */
export const CURRENT_POLL = NEXT_POLL;

/** UGC content type for a vote on one option. */
export function voteType(pollId: string, optionId: string): string {
  return `vote-${pollId}-${optionId}`;
}

export function voteTypes(poll: Poll): string[] {
  return poll.options.map((o) => voteType(poll.id, o.id));
}

/** The option a vote content type belongs to, or null if it isn't one of this poll's. */
export function optionForType(poll: Poll, type: string): string | null {
  const option = poll.options.find((o) => voteType(poll.id, o.id) === type);
  return option ? option.id : null;
}

export type Counts = Record<string, number>;

export interface VoteEntry {
  id: string;
  authorId: string;
  contentType: string;
  createdAt: number;
}

export interface CountedVotes {
  counts: Counts;
  /** Each voter's counted vote: their newest entry. */
  byAuthor: Map<string, { option: string; id: string }>;
  /** Entries that don't count: a voter's older votes, or ones with no author. */
  extras: VoteEntry[];
}

/** One vote per person: only each author's newest vote for this poll counts. */
export function countVotes(poll: Poll, entries: readonly VoteEntry[]): CountedVotes {
  const newest = new Map<string, VoteEntry>();
  const extras: VoteEntry[] = [];
  for (const e of entries) {
    if (!optionForType(poll, e.contentType)) continue;
    if (!e.authorId) {
      extras.push(e);
      continue;
    }
    const kept = newest.get(e.authorId);
    if (!kept) {
      newest.set(e.authorId, e);
    } else if (e.createdAt > kept.createdAt || (e.createdAt === kept.createdAt && e.id > kept.id)) {
      extras.push(kept);
      newest.set(e.authorId, e);
    } else {
      extras.push(e);
    }
  }
  const counts: Counts = {};
  const byAuthor = new Map<string, { option: string; id: string }>();
  for (const [author, e] of newest) {
    const option = optionForType(poll, e.contentType) as string;
    counts[option] = (counts[option] ?? 0) + 1;
    byAuthor.set(author, { option, id: e.id });
  }
  return { counts, byAuthor, extras };
}

export interface TallyRow {
  option: PollOption;
  votes: number;
  /** 0..1 of all votes. */
  share: number;
  leading: boolean;
}

/** Rows in the poll's own order (so buttons don't jump around), with shares and leaders. */
export function tally(poll: Poll, counts: Counts): { rows: TallyRow[]; total: number } {
  const votesOf = (id: string) => {
    const n = counts[id];
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };
  const total = poll.options.reduce((sum, o) => sum + votesOf(o.id), 0);
  const top = Math.max(0, ...poll.options.map((o) => votesOf(o.id)));
  const rows = poll.options.map((option) => {
    const votes = votesOf(option.id);
    return { option, votes, share: total ? votes / total : 0, leading: top > 0 && votes === top };
  });
  return { rows, total };
}

/** Counts after this player moves their vote from one option to another (either may be null). */
export function moveVote(counts: Counts, from: string | null, to: string | null): Counts {
  if (from === to) return counts;
  const next = { ...counts };
  if (from) next[from] = Math.max(0, (next[from] ?? 0) - 1);
  if (to) next[to] = (next[to] ?? 0) + 1;
  return next;
}
