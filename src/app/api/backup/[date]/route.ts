import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-session";
import { getDailyBackup } from "@/lib/backup";

// Download one specific day's automatic snapshot, admin-only.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { date } = await params;
  const snapshot = await getDailyBackup(date);
  if (!snapshot) {
    return NextResponse.json({ error: "No backup found for that date." }, { status: 404 });
  }

  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="coldcall-backup-${date}.json"`,
    },
  });
}
