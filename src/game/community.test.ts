import { describe, expect, it } from 'vitest';
import { BASE_POLL, countVotes, moveVote, optionForType, tally, voteType, voteTypes } from './poll';
import { MAX_MESSAGE, cleanMessage, messageFromEntry, timeAgo } from './chat';

describe('poll', () => {
  it('maps options to unique content types and back', () => {
    const types = voteTypes(BASE_POLL);
    expect(new Set(types).size).toBe(BASE_POLL.options.length);
    for (const t of types) expect(t).toMatch(/^[a-z0-9_-]{1,64}$/);
    expect(optionForType(BASE_POLL, voteType('base', 'arpg'))).toBe('arpg');
    expect(optionForType(BASE_POLL, 'vote-base-nope')).toBeNull();
    expect(optionForType(BASE_POLL, 'chat')).toBeNull();
  });

  it('tallies shares and leaders in poll order', () => {
    const { rows, total } = tally(BASE_POLL, { arpg: 3, story: 3, puzzle: 2, bogus: 50 });
    expect(total).toBe(8);
    expect(rows.map((r) => r.option.id)).toEqual(BASE_POLL.options.map((o) => o.id));
    expect(rows.find((r) => r.option.id === 'arpg')?.share).toBeCloseTo(3 / 8);
    expect(rows.filter((r) => r.leading).map((r) => r.option.id)).toEqual(['arpg', 'story']);
  });

  it('has no leader and no shares without votes, and ignores junk counts', () => {
    const { rows, total } = tally(BASE_POLL, { arpg: -2, story: Number.NaN });
    expect(total).toBe(0);
    expect(rows.every((r) => !r.leading && r.share === 0)).toBe(true);
  });

  it('counts one vote per person: their newest', () => {
    const v = (id: string, authorId: string, option: string, createdAt: number) => ({
      id,
      authorId,
      contentType: voteType('base', option),
      createdAt,
    });
    const { counts, byAuthor, extras } = countVotes(BASE_POLL, [
      v('a1', 'ann', 'arpg', 1),
      v('a2', 'ann', 'story', 5),
      v('a3', 'ann', 'arpg', 3),
      v('b1', 'bob', 'arpg', 2),
      v('c1', 'cat', 'puzzle', 4),
      v('n1', '', 'puzzle', 9),
      { id: 'x', authorId: 'dan', contentType: 'chat', createdAt: 9 },
    ]);
    expect(counts).toEqual({ story: 1, arpg: 1, puzzle: 1 });
    expect(byAuthor.get('ann')).toEqual({ option: 'story', id: 'a2' });
    expect(byAuthor.has('dan')).toBe(false);
    expect(extras.map((e) => e.id).sort()).toEqual(['a1', 'a3', 'n1']);
  });

  it('breaks a same-time tie between one person’s votes the same way every time', () => {
    const a = { id: 'p', authorId: 'ann', contentType: voteType('base', 'arpg'), createdAt: 1 };
    const b = { id: 'q', authorId: 'ann', contentType: voteType('base', 'idle'), createdAt: 1 };
    expect(countVotes(BASE_POLL, [a, b]).counts).toEqual({ idle: 1 });
    expect(countVotes(BASE_POLL, [b, a]).counts).toEqual({ idle: 1 });
  });

  it('moves a vote without going negative', () => {
    expect(moveVote({ arpg: 1 }, 'arpg', 'story')).toEqual({ arpg: 0, story: 1 });
    expect(moveVote({}, 'arpg', null)).toEqual({ arpg: 0 });
    expect(moveVote({ arpg: 1 }, null, 'arpg')).toEqual({ arpg: 2 });
    const same = { arpg: 1 };
    expect(moveVote(same, 'arpg', 'arpg')).toBe(same);
  });
});

describe('chat', () => {
  it('cleans what players type', () => {
    expect(cleanMessage('  hi \n\n there  ')).toBe('hi there');
    expect(cleanMessage('   ')).toBe('');
    expect(Array.from(cleanMessage('🙂'.repeat(MAX_MESSAGE + 20)))).toHaveLength(MAX_MESSAGE);
  });

  it('reads valid entries and drops hidden or malformed ones', () => {
    const base = {
      id: 'x',
      authorId: 'p',
      authorName: 'Pip',
      createdAt: 5,
      data: { text: ' yo ' },
    };
    expect(messageFromEntry(base)).toEqual({
      id: 'x',
      authorId: 'p',
      authorName: 'Pip',
      text: 'yo',
      at: 5,
    });
    expect(messageFromEntry({ ...base, status: 'quarantined' })).toBeNull();
    expect(messageFromEntry({ ...base, status: 'removed' })).toBeNull();
    expect(messageFromEntry({ ...base, data: { text: 7 } })).toBeNull();
    expect(messageFromEntry({ ...base, data: null })).toBeNull();
    expect(messageFromEntry({ ...base, data: { text: '   ' } })).toBeNull();
    expect(messageFromEntry({ ...base, id: 3 })).toBeNull();
    expect(messageFromEntry({ ...base, authorName: '' })?.authorName).toBe('Player');
  });

  it('formats ages', () => {
    expect(timeAgo(1000, 1000)).toBe('now');
    expect(timeAgo(5000, 1000)).toBe('now');
    expect(timeAgo(0, 5 * 60_000)).toBe('5m');
    expect(timeAgo(0, 3 * 3_600_000)).toBe('3h');
    expect(timeAgo(0, 2 * 86_400_000)).toBe('2d');
  });
});
