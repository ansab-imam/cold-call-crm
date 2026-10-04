import { NextResponse } from "next/server";
import { z } from "zod";
import { getStatusSettings, updateStatusSettings } from "@/lib/pipeline/status-settings-store";

export async function GET() {
  const settings = await getStatusSettings();
  return NextResponse.json(settings);
}

const bodySchema = z.object({
  callStatuses: z.array(z.string()).optional(),
  callOutcomes: z.array(z.string()).optional(),
});

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
  }
  const settings = await updateStatusSettings(parsed.data);
  return NextResponse.json(settings);
}
