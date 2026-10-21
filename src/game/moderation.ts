// Dev area: player reports grouped by the message they're about.

export interface ReportLike {
  id: string;
  entryId: string;
  reason: string;
  details: string;
  createdAt: number;
  status: string;
}

export interface ReportGroup {
  entryId: string;
  reportIds: string[];
  /** Distinct reasons, most common first. */
  reasons: string[];
  /** Players' free-text notes, newest first. */
  notes: string[];
  latest: number;
  /** 'pending' while any report is open, else the newest report's status. */
  status: string;
}

/** One group per reported entry, most reported first, then most recent. */
export function groupReports(reports: readonly ReportLike[]): ReportGroup[] {
  const byEntry = new Map<string, ReportLike[]>();
  for (const r of reports) {
    const list = byEntry.get(r.entryId);
    if (list) list.push(r);
    else byEntry.set(r.entryId, [r]);
  }
  const groups: ReportGroup[] = [];
  for (const [entryId, list] of byEntry) {
    const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
    const reasonCount = new Map<string, number>();
    for (const r of sorted) reasonCount.set(r.reason, (reasonCount.get(r.reason) ?? 0) + 1);
    groups.push({
      entryId,
      reportIds: sorted.map((r) => r.id),
      reasons: [...reasonCount.entries()].sort((a, b) => b[1] - a[1]).map(([reason]) => reason),
      notes: sorted.map((r) => r.details.trim()).filter(Boolean),
      latest: sorted[0]?.createdAt ?? 0,
      status: sorted.some((r) => r.status === 'pending')
        ? 'pending'
        : (sorted[0]?.status ?? 'pending'),
    });
  }
  return groups.sort((a, b) => b.reportIds.length - a.reportIds.length || b.latest - a.latest);
}
