import "server-only";
import { readStore, withStore } from "@/lib/db";

export type StatusSettings = {
  // What happened technically when the call was placed.
  callStatuses: string[];
  // What the conversation actually resulted in, once known.
  callOutcomes: string[];
};

const SETTINGS_KEY = "status-settings";

const DEFAULTS: StatusSettings = {
  callStatuses: ["Picked Up", "Voicemail", "Not Connected"],
  callOutcomes: ["Interested", "Not Interested", "Not Decision Maker", "Bad Data"],
};

export async function getStatusSettings(): Promise<StatusSettings> {
  const stored = await readStore<Partial<StatusSettings> | null>(SETTINGS_KEY, null);
  return { ...DEFAULTS, ...stored };
}

export async function updateStatusSettings(
  patch: Partial<StatusSettings>
): Promise<StatusSettings> {
  return withStore<StatusSettings>(SETTINGS_KEY, DEFAULTS, (current) => ({
    ...DEFAULTS,
    ...current,
    ...patch,
  }));
}
