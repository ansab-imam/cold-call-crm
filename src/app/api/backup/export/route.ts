import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-session";
import { createBackupSnapshot } from "@/lib/backup";

// On-demand full export, admin-only — the "download a backup right now"
// button in Settings, separate from the automatic daily one.
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const snapshot = await createBackupSnapshot();
  const filename = `coldcall-backup-${snapshot.exportedAt.slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
