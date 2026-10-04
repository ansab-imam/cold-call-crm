import "server-only";
import type { Lead } from "./schema";
import { renderTemplate } from "./template-render";

export function isAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

function leadContext(lead: Lead): string {
  const fields: [string, string | null][] = [
    ["Contact name", lead.fullName],
    ["Job title", lead.jobTitle],
    ["Company", lead.companyName],
    ["Industry", lead.industry],
    ["Company description", lead.companyDescription],
    ["Location", [lead.city, lead.stateRegion].filter(Boolean).join(", ") || null],
    ["Employee count", lead.employeeCount != null ? String(lead.employeeCount) : null],
    ["Research notes", lead.researchNotes],
    ["Website", lead.websiteUrl],
  ];
  return fields
    .filter(([, v]) => v)
    .map(([label, v]) => `${label}: ${v}`)
    .join("\n");
}

// When an OpenAI key is configured (set in Vercel, never seen by this app's
// code or anyone in chat), the Settings instructions become the prompt for
// a real AI generation instead of a literal template — the same text field
// works either way, so switching providers on/off never breaks Settings.
export async function generateAiText(
  type: "script" | "email",
  instructions: string,
  lead: Lead
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return renderTemplate(instructions, lead);
  }

  const kind = type === "script" ? "cold call script" : "cold outreach email";
  const system = `You write a personalized ${kind} for a B2B sales rep to use on a real call or send as a real email. Use only the lead details given — never invent facts not present. Keep it natural, concise, and immediately usable as-is: no placeholders left unfilled, no meta-commentary, no explanation of what you did.`;
  // Instructions may still contain {{token}} placeholders left over from
  // template-mode — fill those in first so switching AI on doesn't require
  // rewriting Settings, and the model never sees raw placeholder syntax.
  const filledInstructions = renderTemplate(instructions, lead);
  const user = `Instructions for what to write:\n${filledInstructions}\n\nLead details:\n${leadContext(lead) || "(no additional details on file)"}\n\nWrite the final ${kind} now.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`OpenAI request failed (${res.status}): ${errBody.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned no content.");
  return text;
}
