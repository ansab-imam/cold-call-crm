import "server-only";
import type { ImportBatch, Lead } from "./schema";
import { readStore, withStore } from "@/lib/db";

const LEADS_KEY = "leads";
const BATCHES_KEY = "import-batches";

export async function getAllLeads(): Promise<Lead[]> {
  return readStore<Lead[]>(LEADS_KEY, []);
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const leads = await getAllLeads();
  return leads.find((l) => l.id === id) ?? null;
}

export async function insertLeads(newLeads: Lead[]): Promise<void> {
  await withStore<Lead[]>(LEADS_KEY, [], (leads) => [...leads, ...newLeads]);
}

export async function updateLead(id: string, patch: Partial<Lead>): Promise<Lead | null> {
  let updated: Lead | null = null;
  await withStore<Lead[]>(LEADS_KEY, [], (leads) => {
    const idx = leads.findIndex((l) => l.id === id);
    if (idx === -1) return leads;
    const next = [...leads];
    next[idx] = { ...next[idx], ...patch, updatedAt: new Date().toISOString() };
    updated = next[idx];
    return next;
  });
  return updated;
}

export async function deleteLeads(ids: string[]): Promise<number> {
  let removed = 0;
  await withStore<Lead[]>(LEADS_KEY, [], (leads) => {
    const idSet = new Set(ids);
    const remaining = leads.filter((l) => !idSet.has(l.id));
    removed = leads.length - remaining.length;
    return remaining;
  });
  return removed;
}

export async function bulkUpdateLeads(ids: string[], patch: Partial<Lead>): Promise<number> {
  let count = 0;
  await withStore<Lead[]>(LEADS_KEY, [], (leads) => {
    const idSet = new Set(ids);
    return leads.map((l) => {
      if (!idSet.has(l.id)) return l;
      count++;
      return { ...l, ...patch, updatedAt: new Date().toISOString() };
    });
  });
  return count;
}

export async function deleteLeadsByBatch(batchId: string): Promise<number> {
  let removed = 0;
  await withStore<Lead[]>(LEADS_KEY, [], (leads) => {
    const remaining = leads.filter((l) => l.importBatchId !== batchId);
    removed = leads.length - remaining.length;
    return remaining;
  });
  return removed;
}

export async function listBatches(): Promise<ImportBatch[]> {
  return readStore<ImportBatch[]>(BATCHES_KEY, []);
}

export async function saveBatch(batch: ImportBatch): Promise<void> {
  await withStore<ImportBatch[]>(BATCHES_KEY, [], (batches) => [batch, ...batches]);
}

export async function markBatchUndone(batchId: string): Promise<void> {
  await withStore<ImportBatch[]>(BATCHES_KEY, [], (batches) =>
    batches.map((b) => (b.id === batchId ? { ...b, undone: true } : b))
  );
}
