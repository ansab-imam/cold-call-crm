import { NextResponse } from "next/server";
import { z } from "zod";
import { updateLead } from "@/lib/pipeline/store";
import { requireSession } from "@/lib/auth/require-session";

const bodySchema = z.object({
  reason: z.string().trim().min(1, "Reason is required."),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const updated = await updateLead(id, {
    isInvalid: true,
    invalidReason: parsed.data.reason,
    invalidAt: new Date().toISOString(),
    invalidBy: auth.session.name,
  });
  if (!updated) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  return NextResponse.json({ lead: updated });
}
