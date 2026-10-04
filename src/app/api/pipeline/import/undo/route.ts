import { NextResponse } from "next/server";
import { deleteLeadsByBatch, markBatchUndone } from "@/lib/pipeline/store";
import { requireAdmin } from "@/lib/auth/require-session";

export async function POST(request: Request) {
  // Undoing an import deletes leads — admin-only, same as any other delete.
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { batchId } = (await request.json()) as { batchId: string };
  if (!batchId) {
    return NextResponse.json({ error: "Missing batchId." }, { status: 400 });
  }
  const removed = await deleteLeadsByBatch(batchId);
  await markBatchUndone(batchId);
  return NextResponse.json({ removed });
}
