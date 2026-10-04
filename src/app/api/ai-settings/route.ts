import { NextResponse } from "next/server";
import { z } from "zod";
import { getAiSettings, updateAiSettings } from "@/lib/pipeline/ai-settings-store";
import { isAiConfigured } from "@/lib/pipeline/ai-generate";

export async function GET() {
  const settings = await getAiSettings();
  return NextResponse.json({ ...settings, aiEnabled: isAiConfigured() });
}

const bodySchema = z.object({
  scriptInstructions: z.string().optional(),
  emailInstructions: z.string().optional(),
});

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
  }
  const settings = await updateAiSettings(parsed.data);
  return NextResponse.json({ ...settings, aiEnabled: isAiConfigured() });
}
