import type { Lead } from "./schema";
import type { CallLogEntry } from "./call-log-schema";
import { belongsInPipeline, belongsInMyCalls, belongsInInvalidLeads } from "./queues";
import { isDueOrOverdue, daysSince } from "./dates";

function isSameDay(isoA: string, isoB: Date): boolean {
  const a = new Date(isoA);
  return (
    a.getFullYear() === isoB.getFullYear() &&
    a.getMonth() === isoB.getMonth() &&
    a.getDate() === isoB.getDate()
  );
}

// A lead has gone cold if it's sat assigned this long with no outcome
// recorded yet — worth a rep's attention before it's forgotten entirely.
const STALE_AFTER_DAYS = 3;

export function computeDashboardStats(
  leads: Lead[],
  entries: CallLogEntry[],
  currentUser: string,
  isAdmin: boolean
) {
  const now = new Date();

  // Everyone's own book — an admin who also works leads sees the same
  // shape of numbers a rep does, just for their own name.
  const myLeads = leads.filter((l) => l.assignedTo === currentUser && !l.isInvalid);
  const myQueue = myLeads.filter((l) => belongsInMyCalls(l, currentUser));
  const myFollowUpsDue = myLeads.filter(
    (l) => !l.doNotCall && l.nextActionDate && isDueOrOverdue(l.nextActionDate, now)
  ).length;
  const myCallsToday = entries.filter(
    (e) => e.loggedBy === currentUser && isSameDay(e.loggedAt, now)
  ).length;
  const myOpportunities = myLeads.filter((l) => !!l.opportunityStage).length;
  const myResolvedCount = myLeads.length - myQueue.length;
  const myResolvedRate =
    myLeads.length > 0 ? Math.round((myResolvedCount / myLeads.length) * 100) : 0;
  const myStaleCount = myLeads.filter(
    (l) =>
      !l.callOutcome &&
      !l.doNotCall &&
      l.assignedAt &&
      daysSince(l.assignedAt) >= STALE_AFTER_DAYS
  ).length;

  // Sort by whichever date actually put it in this queue — a scheduled
  // follow-up date if it has one, otherwise how long it's been assigned.
  const myCallsQueue = [...myQueue]
    .sort((a, b) =>
      (a.nextActionDate ?? a.assignedAt ?? "").localeCompare(
        b.nextActionDate ?? b.assignedAt ?? ""
      )
    )
    .slice(0, 6);

  const recentCalls = [...entries]
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
    .slice(0, 6);

  // Org-wide numbers only an admin needs — a rep has no use for, and no
  // visibility into, the whole team's book.
  const team = isAdmin
    ? {
        unclaimedCount: leads.filter(belongsInPipeline).length,
        invalidCount: leads.filter(belongsInInvalidLeads).length,
        callsToday: entries.filter((e) => isSameDay(e.loggedAt, now)).length,
        reassignedThisWeek: leads.filter(
          (l) => l.reassignedAt && daysSince(l.reassignedAt) <= 7
        ).length,
      }
    : null;

  return {
    myQueueCount: myQueue.length,
    myFollowUpsDue,
    myCallsToday,
    myOpportunities,
    myResolvedRate,
    myStaleCount,
    myCallsQueue,
    recentCalls,
    team,
  };
}
