import "server-only";
import type { CallLogEntry } from "./call-log-schema";
import { readStore, withStore } from "@/lib/db";

const CALL_LOG_KEY = "call-log";

export async function getAllCallLogEntries(): Promise<CallLogEntry[]> {
  return readStore<CallLogEntry[]>(CALL_LOG_KEY, []);
}

export async function getCallLogForLead(leadId: string): Promise<CallLogEntry[]> {
  const all = await getAllCallLogEntries();
  return all
    .filter((e) => e.leadId === leadId)
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}

export async function appendCallLogEntry(entry: CallLogEntry): Promise<void> {
  await withStore<CallLogEntry[]>(CALL_LOG_KEY, [], (all) => [entry, ...all]);
}

export async function updateCallLogEntry(
  id: string,
  patch: Partial<CallLogEntry>
): Promise<CallLogEntry | null> {
  let updated: CallLogEntry | null = null;
  await withStore<CallLogEntry[]>(CALL_LOG_KEY, [], (all) => {
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return all;
    const next = [...all];
    next[idx] = { ...next[idx], ...patch };
    updated = next[idx];
    return next;
  });
  return updated;
}
