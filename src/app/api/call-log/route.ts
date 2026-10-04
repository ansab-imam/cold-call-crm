import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  getAllCallLogEntries,
  getCallLogForLead,
  appendCallLogEntry,
  updateCallLogEntry,
} from "@/lib/pipeline/call-log-store";
import { getLeadById, updateLead } from "@/lib/pipeline/store";
import { withOpportunityPromotion } from "@/lib/pipeline/opportunity-promotion";
import { requireSession, requireAdmin } from "@/lib/auth/require-session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId");
  const entries = leadId
    ? await getCallLogForLead(leadId)
    : await getAllCallLogEntries();
  return NextResponse.json({ entries });
}

const bodySchema = z.object({
  leadId: z.string(),
  callStatus: z.string().nullable().optional(),
  callOutcome: z.string().nullable().optional(),
  attemptNumber: z.number().int().min(1).optional(),
  notes: z.string().nullable().optional(),
  nextActionDate: z.string().nullable().optional(),
});

// Logging a call is the one real action here: it writes a permanent history
// entry AND updates the lead's current callStatus/callOutcome/next-action in
// the same request — the log is the source of truth, the lead just reflects
// "where things stand right now."
export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid call log entry.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const lead = await getLeadById(parsed.data.leadId);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  const session = auth.session;

  const now = new Date().toISOString();
  // The rep's own explicit count, not an auto-increment — falls back to
  // "one more than before" only if the client somehow didn't send one.
  const attemptNumber = parsed.data.attemptNumber ?? lead.attemptCount + 1;
  const entry = {
    id: nanoid(),
    leadId: lead.id,
    loggedAt: now,
    loggedBy: session?.name ?? "Unknown",
    callStatus: parsed.data.callStatus ?? null,
    callOutcome: parsed.data.callOutcome ?? null,
    attemptNumber,
    notes: parsed.data.notes ?? null,
    nextActionDate: parsed.data.nextActionDate ?? null,
    editedAt: null,
    editedBy: null,
  };

  await appendCallLogEntry(entry);

  // Logging the admin-designated "trigger" outcome promotes a lead onto the
  // Opportunities board, landing it in the first column — after that it
  // moves only by being dragged between columns, not by further calls.
  const patch = await withOpportunityPromotion(lead, {
    callStatus: entry.callStatus,
    callOutcome: entry.callOutcome,
    nextActionDate: entry.nextActionDate,
    attemptCount: attemptNumber,
  });

  const updatedLead = await updateLead(lead.id, patch);

  return NextResponse.json({ entry, lead: updatedLead });
}

const patchBodySchema = z.object({
  id: z.string(),
  callStatus: z.string().nullable().optional(),
  callOutcome: z.string().nullable().optional(),
  attemptNumber: z.number().int().min(1).optional(),
  notes: z.string().nullable().optional(),
  nextActionDate: z.string().nullable().optional(),
});

// Correcting a mistaken entry after the fact — admin-only. If it's the
// lead's most recent call, the edit also re-syncs the lead's current
// callStatus/callOutcome/next-action so the two don't disagree; editing an
// older entry in the history only changes that record, since something
// more recent has already superseded it as "where things stand now."
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid call log entry.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { id, ...fields } = parsed.data;
  const patch = {
    ...fields,
    editedAt: new Date().toISOString(),
    editedBy: auth.session.name,
  };
  const updated = await updateCallLogEntry(id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Call log entry not found." }, { status: 404 });
  }

  const leadEntries = await getCallLogForLead(updated.leadId);
  const isLatest = leadEntries[0]?.id === updated.id;

  let updatedLead = null;
  if (isLatest) {
    const lead = await getLeadById(updated.leadId);
    if (lead) {
      const leadPatch = await withOpportunityPromotion(lead, {
        callStatus: updated.callStatus,
        callOutcome: updated.callOutcome,
        nextActionDate: updated.nextActionDate,
      });
      updatedLead = await updateLead(lead.id, leadPatch);
    }
  }

  return NextResponse.json({ entry: updated, lead: updatedLead });
}
