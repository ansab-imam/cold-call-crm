import type { Lead } from "./schema";
import type { ColumnMapping } from "./mapping";
import type { CallLogEntry } from "./call-log-schema";
import type { StatusSettings } from "./status-settings-store";
import type { OpportunitySettings } from "./opportunity-settings-store";
import type { CustomFieldDef } from "./custom-fields-store";

export type PreviewResponse = {
  fileName: string;
  sheetName: string | null;
  headers: string[];
  rows: string[][];
  mappings: ColumnMapping[];
  totalRows: number;
  missingRequiredCount: number;
  duplicateCount: number;
  sampleDrafts: {
    rowIndex: number;
    companyName: string | null;
    fullName: string | null;
    email: string | null;
    primaryPhone: string | null;
    missingRequired: string[];
    duplicate: boolean;
    flags: string[];
  }[];
};

export type CommitResponse = {
  batchId: string;
  insertedCount: number;
  skippedDuplicateCount: number;
  skippedInvalidCount: number;
};

async function asJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}

export async function fetchLeads(): Promise<Lead[]> {
  const res = await fetch("/api/pipeline/leads");
  const body = await asJson<{ leads: Lead[] }>(res);
  return body.leads;
}

export async function previewImport(file: File): Promise<PreviewResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/pipeline/import/preview", {
    method: "POST",
    body: formData,
  });
  return asJson<PreviewResponse>(res);
}

export async function commitImport(payload: {
  fileName: string;
  sheetName: string | null;
  headers: string[];
  rows: string[][];
  mappings: ColumnMapping[];
}): Promise<CommitResponse> {
  const res = await fetch("/api/pipeline/import/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return asJson<CommitResponse>(res);
}

export async function undoImport(batchId: string): Promise<{ removed: number }> {
  const res = await fetch("/api/pipeline/import/undo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batchId }),
  });
  return asJson(res);
}

export async function createLead(): Promise<Lead> {
  const res = await fetch("/api/pipeline/leads", { method: "POST" });
  const body = await asJson<{ lead: Lead }>(res);
  return body.lead;
}

export async function patchLead(
  id: string,
  patch: Partial<Lead>
): Promise<Lead> {
  const res = await fetch(`/api/pipeline/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const body = await asJson<{ lead: Lead }>(res);
  return body.lead;
}

export async function markLeadInvalid(id: string, reason: string): Promise<Lead> {
  const res = await fetch(`/api/pipeline/leads/${id}/invalidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  const body = await asJson<{ lead: Lead }>(res);
  return body.lead;
}

export async function restoreLead(id: string): Promise<Lead> {
  const res = await fetch(`/api/pipeline/leads/${id}/restore`, { method: "POST" });
  const body = await asJson<{ lead: Lead }>(res);
  return body.lead;
}

export async function bulkPatchLeads(
  ids: string[],
  patch: Partial<Lead>
): Promise<number> {
  const res = await fetch("/api/pipeline/leads/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, patch }),
  });
  const body = await asJson<{ count: number }>(res);
  return body.count;
}

export async function deleteLeads(ids: string[]): Promise<number> {
  const res = await fetch("/api/pipeline/leads/bulk", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const body = await asJson<{ count: number }>(res);
  return body.count;
}

export async function fetchCallLog(leadId?: string): Promise<CallLogEntry[]> {
  const url = leadId
    ? `/api/call-log?leadId=${encodeURIComponent(leadId)}`
    : "/api/call-log";
  const res = await fetch(url);
  const body = await asJson<{ entries: CallLogEntry[] }>(res);
  return body.entries;
}

export async function logCall(
  leadId: string,
  data: {
    callStatus: string | null;
    callOutcome: string | null;
    attemptNumber: number;
    notes: string | null;
    nextActionDate: string | null;
  }
): Promise<{ entry: CallLogEntry; lead: Lead }> {
  const res = await fetch("/api/call-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leadId, ...data }),
  });
  return asJson(res);
}

export async function updateCallLog(
  id: string,
  data: {
    callStatus: string | null;
    callOutcome: string | null;
    attemptNumber: number;
    notes: string | null;
    nextActionDate: string | null;
  }
): Promise<{ entry: CallLogEntry; lead: Lead | null }> {
  const res = await fetch("/api/call-log", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  });
  return asJson(res);
}

export async function fetchStatusSettings(): Promise<StatusSettings> {
  const res = await fetch("/api/status-settings");
  return asJson(res);
}

export async function saveStatusSettings(
  patch: Partial<StatusSettings>
): Promise<StatusSettings> {
  const res = await fetch("/api/status-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return asJson(res);
}

async function patchOpportunitySettings(action: Record<string, unknown>): Promise<OpportunitySettings> {
  const res = await fetch("/api/opportunity-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  return asJson(res);
}

export const opportunitySettingsApi = {
  addColumn: (name: string) => patchOpportunitySettings({ action: "addColumn", name }),
  renameColumn: (id: string, name: string) =>
    patchOpportunitySettings({ action: "renameColumn", id, name }),
  removeColumn: (id: string) => patchOpportunitySettings({ action: "removeColumn", id }),
  reorderColumns: (orderedIds: string[]) =>
    patchOpportunitySettings({ action: "reorderColumns", orderedIds }),
  setTriggerOutcome: (triggerOutcome: string) =>
    patchOpportunitySettings({ action: "setTriggerOutcome", triggerOutcome }),
};

export type AiSettings = {
  scriptInstructions: string;
  emailInstructions: string;
  // Read-only: true when OPENAI_API_KEY is set on the server. Not a saved
  // setting — reflects the environment, computed fresh on every request.
  aiEnabled?: boolean;
};

export async function fetchAiSettings(): Promise<AiSettings> {
  const res = await fetch("/api/ai-settings");
  return asJson(res);
}

export async function saveAiSettings(patch: Partial<AiSettings>): Promise<AiSettings> {
  const res = await fetch("/api/ai-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return asJson(res);
}

export async function fetchCustomFields(): Promise<CustomFieldDef[]> {
  const res = await fetch("/api/custom-fields");
  const body = await asJson<{ fields: CustomFieldDef[] }>(res);
  return body.fields;
}

export async function createCustomField(label: string): Promise<CustomFieldDef> {
  const res = await fetch("/api/custom-fields", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  const body = await asJson<{ field: CustomFieldDef }>(res);
  return body.field;
}

export async function generateAiContent(
  leadId: string,
  type: "script" | "email"
): Promise<string> {
  const res = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leadId, type }),
  });
  const body = await asJson<{ text: string }>(res);
  return body.text;
}
