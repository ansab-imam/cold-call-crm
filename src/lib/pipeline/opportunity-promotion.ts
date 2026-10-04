import "server-only";
import type { Lead } from "./schema";
import { getOpportunitySettings } from "./opportunity-settings-store";

// The one place that decides "does this change send a lead to Opportunities?"
// Called from every path that can set callOutcome (the Log a Call dialog via
// /api/call-log, and editing the Call Outcome dropdown directly in the lead
// detail panel via PATCH /api/pipeline/leads/:id) so the board always
// reflects reality — nobody has to remember to flip a second field by hand.
export async function withOpportunityPromotion(
  current: Lead,
  patch: Partial<Lead>
): Promise<Partial<Lead>> {
  // An explicit stage change (dragging a card) always wins — never override it.
  if (patch.opportunityStage !== undefined) return patch;

  const nextOutcome = patch.callOutcome !== undefined ? patch.callOutcome : current.callOutcome;
  if (current.opportunityStage || !nextOutcome) return patch;

  const settings = await getOpportunitySettings();
  if (nextOutcome !== settings.triggerOutcome) return patch;

  return { ...patch, opportunityStage: settings.columns[0]?.id ?? null };
}
