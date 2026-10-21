import { describe, expect, it } from 'vitest';
import { groupReports, type ReportLike } from './moderation';

const report = (
  id: string,
  entryId: string,
  createdAt: number,
  reason = 'inappropriate',
  status = 'pending',
  details = '',
): ReportLike => ({ id, entryId, createdAt, reason, status, details });

describe('groupReports', () => {
  it('groups by message, most reported first, then most recent', () => {
    const groups = groupReports([
      report('r1', 'a', 1),
      report('r2', 'b', 5),
      report('r3', 'a', 3, 'spam', 'pending', ' buys gold '),
      report('r4', 'c', 9),
      report('r5', 'a', 2, 'spam'),
    ]);
    expect(groups.map((g) => g.entryId)).toEqual(['a', 'c', 'b']);
    const a = groups[0];
    expect(a?.reportIds).toEqual(['r3', 'r5', 'r1']);
    expect(a?.reasons).toEqual(['spam', 'inappropriate']);
    expect(a?.notes).toEqual(['buys gold']);
    expect(a?.latest).toBe(3);
  });

  it('stays pending while any report on the message is open', () => {
    const [g] = groupReports([report('r1', 'a', 1, 'spam', 'dismissed'), report('r2', 'a', 2)]);
    expect(g?.status).toBe('pending');
    const [done] = groupReports([
      report('r1', 'a', 1, 'spam', 'dismissed'),
      report('r2', 'a', 2, 'spam', 'reviewed'),
    ]);
    expect(done?.status).toBe('reviewed');
  });

  it('handles no reports', () => {
    expect(groupReports([])).toEqual([]);
  });
});
