import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-session";
import { isBackupSnapshot, restoreFromSnapshot } from "@/lib/backup";

// Replaces Pipeline/My Calls/Call Log/Opportunities/Invalid Leads and admin
// settings with whatever's in the uploaded file — admin-only, and there's
// no undo beyond restoring a different backup. User accounts are never
// touched by this.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "That file isn't valid JSON." }, { status: 400 });
  }

  if (!isBackupSnapshot(body)) {
    return NextResponse.json(
      { error: "That doesn't look like an Cold Call CRM backup file." },
      { status: 400 }
    );
  }

  try {
    const restored = await restoreFromSnapshot(body);
    return NextResponse.json({ ok: true, restored });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Restore failed. Nothing was changed." },
      { status: 500 }
    );
  }
}
