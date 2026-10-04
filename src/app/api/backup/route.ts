import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-session";
import { listDailyBackups, runDailyBackup } from "@/lib/backup";

// Admin-only list of the automatic daily snapshots currently on file.
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const backups = await listDailyBackups();
  return NextResponse.json({ backups });
}

// Lets an admin trigger today's snapshot on the spot (e.g. right before a
// risky change) instead of waiting for the nightly cron job.
export async function POST() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const key = await runDailyBackup();
  return NextResponse.json({ date: key.split(":")[1] });
}
