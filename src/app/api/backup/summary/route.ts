import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-session";
import { getCurrentSummary } from "@/lib/backup";

// Admin-only item counts for what's in Cold Call CRM right now — the "Now" column of
// the restore preview.
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  return NextResponse.json({ summary: await getCurrentSummary() });
}
