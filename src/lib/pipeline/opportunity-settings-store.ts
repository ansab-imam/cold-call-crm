import "server-only";
import { nanoid } from "nanoid";
import { readStore, withStore } from "@/lib/db";

export type OpportunityColumn = { id: string; name: string };

export type OpportunitySettings = {
  columns: OpportunityColumn[];
  // Which Call Outcome (from Settings' Call Outcome list) promotes a lead
  // onto the board, landing it in the first column.
  triggerOutcome: string;
};

const SETTINGS_KEY = "opportunity-settings";

const DEFAULTS: OpportunitySettings = {
  columns: [
    { id: "shown-interest", name: "Shown Interest" },
    { id: "highly-interested", name: "Highly Interested / Keep Engaged" },
    { id: "booked-demo", name: "Booked a Demo" },
    { id: "won", name: "Won" },
    { id: "lost", name: "Lost" },
  ],
  triggerOutcome: "Interested",
};

export async function getOpportunitySettings(): Promise<OpportunitySettings> {
  const stored = await readStore<Partial<OpportunitySettings> | null>(SETTINGS_KEY, null);
  return { ...DEFAULTS, ...stored };
}

export async function updateOpportunitySettings(
  patch: Partial<OpportunitySettings>
): Promise<OpportunitySettings> {
  return withStore<OpportunitySettings>(SETTINGS_KEY, DEFAULTS, (current) => ({
    ...DEFAULTS,
    ...current,
    ...patch,
  }));
}

export async function addOpportunityColumn(name: string): Promise<OpportunitySettings> {
  return withStore<OpportunitySettings>(SETTINGS_KEY, DEFAULTS, (current) => ({
    ...DEFAULTS,
    ...current,
    columns: [...(current.columns ?? DEFAULTS.columns), { id: nanoid(8), name }],
  }));
}

export async function renameOpportunityColumn(id: string, name: string): Promise<OpportunitySettings> {
  return withStore<OpportunitySettings>(SETTINGS_KEY, DEFAULTS, (current) => ({
    ...DEFAULTS,
    ...current,
    columns: (current.columns ?? DEFAULTS.columns).map((c) => (c.id === id ? { ...c, name } : c)),
  }));
}

export async function removeOpportunityColumn(id: string): Promise<OpportunitySettings> {
  return withStore<OpportunitySettings>(SETTINGS_KEY, DEFAULTS, (current) => ({
    ...DEFAULTS,
    ...current,
    columns: (current.columns ?? DEFAULTS.columns).filter((c) => c.id !== id),
  }));
}

export async function reorderOpportunityColumns(orderedIds: string[]): Promise<OpportunitySettings> {
  return withStore<OpportunitySettings>(SETTINGS_KEY, DEFAULTS, (current) => {
    const columns = current.columns ?? DEFAULTS.columns;
    const byId = new Map(columns.map((c) => [c.id, c]));
    return {
      ...DEFAULTS,
      ...current,
      columns: orderedIds.map((id) => byId.get(id)).filter((c): c is OpportunityColumn => !!c),
    };
  });
}
