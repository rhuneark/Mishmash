import { describe, expect, it } from 'vitest';
import {
  MAX_SUGGESTION,
  builtText,
  newCount,
  parseMarks,
  sentToday,
  suggestionFromEntry,
} from './suggest';
import { MAX_MESSAGE, cleanMessage, messageFromEntry, timeAgo } from './chat';

describe('suggestions', () => {
  const entry = (over: Record<string, unknown> = {}) => ({
    id: 's1',
    authorId: 'pip',
    authorName: 'Pip',
    createdAt: 1000,
    data: { v: 1, text: '  more  boats\nplease ', topic: 'creatures' },
    ...over,
  });

  it('reads valid entries and drops hidden or malformed ones', () => {
    expect(suggestionFromEntry(entry())).toEqual({
      id: 's1',
      authorId: 'pip',
      authorName: 'Pip',
      text: 'more boats please',
      topic: 'creatures',
      at: 1000,
    });
    expect(suggestionFromEntry(entry({ data: { text: 'x', topic: 'nope' } }))?.topic).toBe('other');
    expect(suggestionFromEntry(entry({ status: 'quarantined' }))).toBeNull();
    expect(suggestionFromEntry(entry({ data: { text: '   ' } }))).toBeNull();
    expect(suggestionFromEntry(entry({ data: null }))).toBeNull();
    const long = suggestionFromEntry(entry({ data: { text: 'a'.repeat(900) } }));
    expect(long?.text).toHaveLength(MAX_SUGGESTION);
  });

  it('counts what was sent today and what the owner has not seen', () => {
    const at = (id: string, t: number) => ({ ...suggestionFromEntry(entry({ id }))!, at: t });
    const day = 86_400_000;
    const list = [at('a', 10 * day), at('b', 10 * day - 100), at('c', 8 * day)];
    expect(sentToday(list, 10 * day + 5)).toBe(2);
    const marks = parseMarks({ seenAt: 9 * day, done: ['b'], starred: [1, 'a'] });
    expect(marks.starred).toEqual(['a']);
    expect(newCount(list, marks)).toBe(1);
    expect(parseMarks('junk')).toEqual({ seenAt: 0, starred: [], done: [], built: [] });
    const built = parseMarks({ built: [{ id: 'a', text: 'Boats', by: 'Nova', at: 5 }, { id: 3 }] });
    expect(built.built).toEqual([{ id: 'a', text: 'Boats', by: 'Nova', at: 5 }]);
    expect(builtText(built.built)).toBe('• Boats (suggested by Nova)');
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
