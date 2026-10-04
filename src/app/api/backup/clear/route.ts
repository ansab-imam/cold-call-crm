import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-session";
import { clearAllData } from "@/lib/backup";

// Must match CLEAR_PHRASE in backup-settings-form.tsx
const CLEAR_PHRASE = "DELETE ALL DATA";

// "Start fresh" — admin-only, and the exact confirmation phrase must be sent
// so a stray request can't wipe anything. The page downloads a full backup
// before calling this, since the daily backups are removed too.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== CLEAR_PHRASE) {
    return NextResponse.json(
      { error: "Confirmation text didn't match. Nothing was deleted." },
      { status: 400 }
    );
  }

  try {
    const removed = await clearAllData();
    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Clearing failed. Nothing was deleted." },
      { status: 500 }
    );
  }
}
