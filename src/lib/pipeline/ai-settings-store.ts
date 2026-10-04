import "server-only";
import { readStore, withStore } from "@/lib/db";

const SETTINGS_KEY = "ai-settings";

export type AiSettings = {
  scriptInstructions: string;
  emailInstructions: string;
};

// These are literal templates, not AI prompts — no external service, no API
// key, nothing sent off this machine. `{{token}}` gets swapped for that
// lead's real data at generate time; `{{token|fallback}}` is used when that
// field is empty. Edit in Settings any time — the next click uses whatever
// is saved here, with no other change needed.
const DEFAULTS: AiSettings = {
  scriptInstructions: `Hi {{firstName|there}}, this is [YOUR NAME] with [YOUR COMPANY].

I saw on your website that {{companyName|you}} [ONE OR TWO CORE SERVICES]. We help businesses like yours [ONE-LINE VALUE PROPOSITION].

Would it be worth a quick 15-minute call this week to see if it's a fit?

My callback number is [YOUR PHONE].`,

  emailInstructions: `Subject: Quick question for {{companyName}}

Hi {{firstName|there}},

I saw on your website that {{companyName}} [ONE OR TWO CORE SERVICES]. We help businesses like yours [ONE-LINE VALUE PROPOSITION].

Would you be open to a short call this week to see if it makes sense?

Best,
[YOUR NAME]
[YOUR PHONE]`,
};

export async function getAiSettings(): Promise<AiSettings> {
  const stored = await readStore<Partial<AiSettings> | null>(SETTINGS_KEY, null);
  return { ...DEFAULTS, ...stored };
}

export async function updateAiSettings(
  patch: Partial<AiSettings>
): Promise<AiSettings> {
  return withStore<AiSettings>(SETTINGS_KEY, DEFAULTS, (current) => ({
    ...DEFAULTS,
    ...current,
    ...patch,
  }));
}
