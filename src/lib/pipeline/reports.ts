import type { Lead } from "./schema";
import type { CallLogEntry } from "./call-log-schema";

export type ReportFilters = {
  from: string | null;
  to: string | null;
  loggedBy: string | null;
  callStatus: string | null;
  callOutcome: string | null;
  industry: string | null;
  leadSource: string | null;
};

export const EMPTY_FILTERS: ReportFilters = {
  from: null,
  to: null,
  loggedBy: null,
  callStatus: null,
  callOutcome: null,
  industry: null,
  leadSource: null,
};

export function filterEntries(
  entries: CallLogEntry[],
  leadsById: Map<string, Lead>,
  filters: ReportFilters
): CallLogEntry[] {
  const fromTime = filters.from ? new Date(filters.from).getTime() : null;
  // Include the entire "to" day, not just midnight.
  const toTime = filters.to
    ? new Date(filters.to).getTime() + 24 * 60 * 60 * 1000 - 1
    : null;

  return entries.filter((e) => {
    const loggedTime = new Date(e.loggedAt).getTime();
    if (fromTime !== null && loggedTime < fromTime) return false;
    if (toTime !== null && loggedTime > toTime) return false;
    if (filters.loggedBy && e.loggedBy !== filters.loggedBy) return false;
    if (filters.callStatus && e.callStatus !== filters.callStatus) return false;
    if (filters.callOutcome && e.callOutcome !== filters.callOutcome) return false;

    const lead = leadsById.get(e.leadId);
    if (filters.industry && lead?.industry !== filters.industry) return false;
    if (filters.leadSource && lead?.leadSource !== filters.leadSource) return false;

    return true;
  });
}

function countBy<T>(items: T[], keyFn: (item: T) => string | null): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item) ?? "Not set";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

// The last 30 calendar days ending today, every day included even with
// zero calls — a line chart needs the gaps to be visible, not skipped.
function last30DayKeys(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function computeReportAggregates(
  filtered: CallLogEntry[],
  leadsById: Map<string, Lead>,
  // Second trend line — daily count of calls that landed on this specific
  // outcome (e.g. "Interested"), so it's visible day-to-day whether more
  // calls is actually converting into more of what matters, not just more
  // activity. Null skips the second line entirely.
  trackOutcome: string | null = null
) {
  const byStatus = countBy(filtered, (e) => e.callStatus);
  const byOutcome = countBy(filtered, (e) => e.callOutcome);
  const byUser = countBy(filtered, (e) => e.loggedBy);
  const byIndustry = countBy(filtered, (e) => leadsById.get(e.leadId)?.industry ?? null);
  const bySource = countBy(filtered, (e) => leadsById.get(e.leadId)?.leadSource ?? null);

  const trackedEntries = trackOutcome
    ? filtered.filter((e) => e.callOutcome === trackOutcome)
    : [];
  const trackedByIndustry = countBy(
    trackedEntries,
    (e) => leadsById.get(e.leadId)?.industry ?? null
  );
  const trackedBySource = countBy(
    trackedEntries,
    (e) => leadsById.get(e.leadId)?.leadSource ?? null
  );

  const dayCounts = new Map<string, number>();
  const trackedDayCounts = new Map<string, number>();
  for (const e of filtered) {
    const key = dateKey(e.loggedAt);
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    if (trackOutcome && e.callOutcome === trackOutcome) {
      trackedDayCounts.set(key, (trackedDayCounts.get(key) ?? 0) + 1);
    }
  }

  // The trailing 30 calendar days from today (not from the "From"/"To"
  // filter), so the trend line always has a stable, familiar window —
  // still respects every other filter (user, status, outcome, etc).
  const last30 = last30DayKeys().map((date) => ({
    date,
    count: dayCounts.get(date) ?? 0,
    trackedCount: trackedDayCounts.get(date) ?? 0,
  }));

  return {
    total: filtered.length,
    byStatus,
    byOutcome,
    byUser,
    byIndustry,
    bySource,
    trackedByIndustry,
    trackedBySource,
    trackedTotal: trackedEntries.length,
    last30,
  };
}

// Distinct values available to filter by, computed from the full unfiltered
// dataset so the filter dropdowns always offer every option that exists —
// not just ones present in the current filtered result.
export function distinctFilterOptions(entries: CallLogEntry[], leadsById: Map<string, Lead>) {
  const loggedBy = new Set<string>();
  const callStatus = new Set<string>();
  const callOutcome = new Set<string>();
  const industry = new Set<string>();
  const leadSource = new Set<string>();

  for (const e of entries) {
    loggedBy.add(e.loggedBy);
    if (e.callStatus) callStatus.add(e.callStatus);
    if (e.callOutcome) callOutcome.add(e.callOutcome);
    const lead = leadsById.get(e.leadId);
    if (lead?.industry) industry.add(lead.industry);
    if (lead?.leadSource) leadSource.add(lead.leadSource);
  }

  return {
    loggedBy: [...loggedBy].sort(),
    callStatus: [...callStatus].sort(),
    callOutcome: [...callOutcome].sort(),
    industry: [...industry].sort(),
    leadSource: [...leadSource].sort(),
  };
}
