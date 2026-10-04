import type { Lead } from "./schema";
import { isDueOrOverdue } from "./dates";

// Where a lead lives is decided by these rules alone, so both the server
// pages and the client tables (and anything else later) stay in sync without
// duplicating the logic. Plain (non-"use client") so a Server Component can
// call it too.

// Pipeline holds only unclaimed leads — the moment one is assigned, it
// belongs to My Calls instead, not both places at once. A lead marked
// invalid never shows here regardless of assignment.
export function belongsInPipeline(l: Lead): boolean {
  return !l.assignedTo && !l.isInvalid;
}

// A lead sits in My Calls while it's assigned to you, and either:
//  - no outcome has been recorded yet (never actioned), or
//  - a next follow-up date was set and it's now due or overdue.
// Logging a call with an outcome and no follow-up date is what resolves it
// for good — from then on it lives only in Call Log. Setting a follow-up
// date on that same call is what brings it back here, on that date, the
// rep's own explicit choice rather than anything automatic.
export function belongsInMyCalls(l: Lead, currentUser: string): boolean {
  if (l.assignedTo !== currentUser || l.doNotCall || l.isInvalid) return false;
  if (!l.callOutcome) return true;
  return !!l.nextActionDate && isDueOrOverdue(l.nextActionDate);
}

// A lead sits on the Opportunities board once it's been promoted there —
// set the moment the admin-designated "trigger" Call Outcome is logged, and
// from then on moved purely by dragging between board columns.
export function belongsInOpportunities(l: Lead): boolean {
  return !!l.opportunityStage && !l.isInvalid;
}

// Marked invalid instead of deleted — pulled out of every active queue
// above, but still here, in case it fits a different campaign later.
export function belongsInInvalidLeads(l: Lead): boolean {
  return l.isInvalid;
}
