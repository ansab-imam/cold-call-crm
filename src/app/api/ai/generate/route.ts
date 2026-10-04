import { NextResponse } from "next/server";
import { z } from "zod";
import { getLeadById } from "@/lib/pipeline/store";
import { getAiSettings } from "@/lib/pipeline/ai-settings-store";
import { generateAiText } from "@/lib/pipeline/ai-generate";
import { requireSession } from "@/lib/auth/require-session";

const bodySchema = z.object({
  leadId: z.string(),
  type: z.enum(["script", "email"]),
});

// Uses OpenAI when OPENAI_API_KEY is set (in Vercel's own env vars — never
// sent through this app's code or seen in chat); falls back to the plain
// template engine otherwise, so this never breaks before a key is added.
export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const lead = await getLeadById(parsed.data.leadId);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const settings = await getAiSettings();
  const instructions =
    parsed.data.type === "script"
      ? settings.scriptInstructions
      : settings.emailInstructions;

  try {
    const text = await generateAiText(parsed.data.type, instructions, lead);
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed." },
      { status: 502 }
    );
  }
}
