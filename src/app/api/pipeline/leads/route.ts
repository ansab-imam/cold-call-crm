import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAllLeads, insertLeads } from "@/lib/pipeline/store";
import { emptyLead } from "@/lib/pipeline/import";
import type { Lead } from "@/lib/pipeline/schema";
import { requireSession } from "@/lib/auth/require-session";

export async function GET() {
  const leads = await getAllLeads();
  return NextResponse.json({ leads });
}

// Manually added lead — same shape as an imported one, just created blank so
// it can be filled in by hand instead of coming from a spreadsheet.
export async function POST() {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const now = new Date().toISOString();
  const lead: Lead = {
    ...emptyLead(),
    id: nanoid(),
    createdAt: now,
    updatedAt: now,
    leadSource: "Manual Entry",
  };
  await insertLeads([lead]);
  return NextResponse.json({ lead });
}
