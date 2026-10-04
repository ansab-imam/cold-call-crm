import { NextResponse } from "next/server";
import { updateLead } from "@/lib/pipeline/store";
import { requireSession } from "@/lib/auth/require-session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const { id } = await params;
  const updated = await updateLead(id, {
    isInvalid: false,
    invalidReason: null,
    invalidAt: null,
    invalidBy: null,
  });
  if (!updated) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  return NextResponse.json({ lead: updated });
}
