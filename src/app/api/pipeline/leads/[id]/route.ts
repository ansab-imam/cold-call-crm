import { NextResponse } from "next/server";
import { getLeadById, updateLead } from "@/lib/pipeline/store";
import { leadSchema } from "@/lib/pipeline/schema";
import { withOpportunityPromotion } from "@/lib/pipeline/opportunity-promotion";
import { requireSession } from "@/lib/auth/require-session";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const { id } = await params;
  const patch = await request.json();

  // Only allow known, partial fields through — validated against the master
  // schema so a bad request can't write an unexpected shape into storage.
  const partialSchema = leadSchema.partial();
  const parsed = partialSchema.safeParse(patch);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  let data = { ...parsed.data };

  const current = await getLeadById(id);
  if (!current) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  // Assignment rule, enforced here too — not just in the UI, since a rep
  // could otherwise call this endpoint directly: only an admin can hand out
  // a lead's *first* assignment. Once it's assigned, anyone can reassign it
  // to someone else, but has to say why.
  if ("assignedTo" in parsed.data && parsed.data.assignedTo !== current.assignedTo) {
    if (auth.session.role !== "admin") {
      if (!current.assignedTo) {
        return NextResponse.json(
          { error: "Only an admin can make a lead's first assignment." },
          { status: 403 }
        );
      }
      if (parsed.data.assignedTo && !parsed.data.reassignReason?.trim()) {
        return NextResponse.json(
          { error: "Say why you're reassigning this lead." },
          { status: 400 }
        );
      }
    }
  }

  // Editing First/Last Name by hand should keep Full Name (what the table
  // and every other screen actually display) in sync, same as an import
  // does — otherwise a manually-entered lead stays "Unnamed" forever.
  if (
    ("firstName" in data || "lastName" in data) &&
    !("fullName" in data)
  ) {
    const firstName = data.firstName !== undefined ? data.firstName : current.firstName;
    const lastName = data.lastName !== undefined ? data.lastName : current.lastName;
    data.fullName = [firstName, lastName].filter(Boolean).join(" ") || null;
  }

  // Setting Call Outcome to whatever Settings designates as the trigger
  // (directly here, not just via Log a Call) is what sends a lead to
  // Opportunities — the rep never has to remember a separate step.
  if ("callOutcome" in data) {
    data = await withOpportunityPromotion(current, data);
  }

  const updated = await updateLead(id, data);
  if (!updated) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  return NextResponse.json({ lead: updated });
}
