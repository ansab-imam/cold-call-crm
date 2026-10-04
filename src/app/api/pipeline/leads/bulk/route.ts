import { NextResponse } from "next/server";
import { bulkUpdateLeads, deleteLeads, getLeadById } from "@/lib/pipeline/store";
import { leadSchema } from "@/lib/pipeline/schema";
import { z } from "zod";
import { requireSession, requireAdmin } from "@/lib/auth/require-session";

const patchBodySchema = z.object({
  ids: z.array(z.string()).min(1),
  patch: leadSchema.partial(),
});

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid bulk update.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Same assignment rule as the single-lead route: only an admin can bulk
  // hand out a *first* assignment. Bulk reassignment isn't exposed in any
  // UI (reassigning is a one-lead-at-a-time, reason-required action), so a
  // non-admin changing assignedTo in bulk is always a first assignment.
  if ("assignedTo" in parsed.data.patch && auth.session.role !== "admin") {
    const leads = await Promise.all(parsed.data.ids.map((id) => getLeadById(id)));
    if (leads.some((l) => l && !l.assignedTo)) {
      return NextResponse.json(
        { error: "Only an admin can make a lead's first assignment." },
        { status: 403 }
      );
    }
  }

  const count = await bulkUpdateLeads(parsed.data.ids, parsed.data.patch);
  return NextResponse.json({ count });
}

const deleteBodySchema = z.object({
  ids: z.array(z.string()).min(1),
});

export async function DELETE(request: Request) {
  // Deletion is admin-only — enforced here too, not just by hiding the
  // button, since a rep could otherwise call this endpoint directly.
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = deleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid delete request.", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const count = await deleteLeads(parsed.data.ids);
  return NextResponse.json({ count });
}
