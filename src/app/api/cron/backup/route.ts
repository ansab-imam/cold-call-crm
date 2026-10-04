import { NextResponse } from "next/server";
import { runDailyBackup } from "@/lib/backup";

// Hit once a day by the Vercel Cron job in vercel.json — not tied to any
// logged-in session, so it checks a shared secret instead when one is
// configured. Worst case without CRON_SECRET set is an extra snapshot
// taken by someone who guesses the URL — not a data-loss risk either way,
// since this only ever writes a new backup, never restores one.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const key = await runDailyBackup();
  return NextResponse.json({ ok: true, date: key.split(":")[1] });
}
