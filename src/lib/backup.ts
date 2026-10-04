import "server-only";
import { readStore, overwriteStore, listKeysWithPrefix, deleteStoreKey, replaceStoresAtomically } from "./db";
import type { Lead, ImportBatch } from "./pipeline/schema";
import type { CallLogEntry } from "./pipeline/call-log-schema";
import { getStatusSettings, type StatusSettings } from "./pipeline/status-settings-store";
import { getOpportunitySettings, type OpportunitySettings } from "./pipeline/opportunity-settings-store";
import { getCustomFields } from "./pipeline/custom-fields-store";
import type { CustomFieldDef } from "./pipeline/custom-fields-store";
import { getAiSettings, type AiSettings } from "./pipeline/ai-settings-store";

// Every key below must match the constant in its own *-store.ts exactly —
// this is the one place that knows all of them at once, so a backup can
// cover every module in a single snapshot.
const KEYS = {
  leads: "leads",
  importBatches: "import-batches",
  callLog: "call-log",
  statusSettings: "status-settings",
  opportunitySettings: "opportunity-settings",
  customFields: "custom-fields",
  aiSettings: "ai-settings",
} as const;

const BACKUP_PREFIX = "backup:";
// Keep roughly two weeks of automatic daily snapshots — enough to recover
// from "noticed a few days late," without the table growing forever.
const RETENTION_DAYS = 14;

export const BACKUP_VERSION = 1;

export type BackupSnapshot = {
  version: number;
  exportedAt: string;
  data: {
    leads: Lead[];
    importBatches: ImportBatch[];
    callLog: CallLogEntry[];
    statusSettings: StatusSettings;
    opportunitySettings: OpportunitySettings;
    customFields: CustomFieldDef[];
    aiSettings: AiSettings;
  };
};

// User accounts (logins) are deliberately never included — restoring them
// could overwrite the password/role of whoever is doing the restoring, or
// lock people out. Accounts are managed separately, in Users.
export async function createBackupSnapshot(): Promise<BackupSnapshot> {
  const [leads, importBatches, callLog, statusSettings, opportunitySettings, customFields, aiSettings] =
    await Promise.all([
      readStore<Lead[]>(KEYS.leads, []),
      readStore<ImportBatch[]>(KEYS.importBatches, []),
      readStore<CallLogEntry[]>(KEYS.callLog, []),
      getStatusSettings(),
      getOpportunitySettings(),
      getCustomFields(),
      getAiSettings(),
    ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      leads,
      importBatches,
      callLog,
      statusSettings,
      opportunitySettings,
      customFields,
      aiSettings,
    },
  };
}

export function isBackupSnapshot(value: unknown): value is BackupSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.version !== "number" || !v.data || typeof v.data !== "object") return false;
  const d = v.data as Record<string, unknown>;
  return (
    Array.isArray(d.leads) &&
    Array.isArray(d.importBatches) &&
    Array.isArray(d.callLog) &&
    Array.isArray(d.customFields) &&
    typeof d.statusSettings === "object" &&
    typeof d.opportunitySettings === "object" &&
    typeof d.aiSettings === "object"
  );
}

// Item counts shown on the restore preview and after restore / clear.
export type BackupSummary = {
  leads: number;
  callLog: number;
  importBatches: number;
  customFields: number;
};

export function summarizeSnapshot(snapshot: BackupSnapshot): BackupSummary {
  const { data } = snapshot;
  return {
    leads: data.leads.length,
    callLog: data.callLog.length,
    importBatches: data.importBatches.length,
    customFields: data.customFields.length,
  };
}

export async function getCurrentSummary(): Promise<BackupSummary> {
  return summarizeSnapshot(await createBackupSnapshot());
}

// A full replace of every module this snapshot covers — not a merge. This
// is what "restore from the file I downloaded yesterday" has to mean: the
// whole point is to undo whatever happened since, not partially blend it.
// All-or-nothing: every module is written and verified in one transaction.
export async function restoreFromSnapshot(snapshot: BackupSnapshot): Promise<BackupSummary> {
  const { data } = snapshot;
  await replaceStoresAtomically({
    [KEYS.leads]: data.leads,
    [KEYS.importBatches]: data.importBatches,
    [KEYS.callLog]: data.callLog,
    [KEYS.statusSettings]: data.statusSettings,
    [KEYS.opportunitySettings]: data.opportunitySettings,
    [KEYS.customFields]: data.customFields,
    [KEYS.aiSettings]: data.aiSettings,
  });
  return summarizeSnapshot(snapshot);
}

// "Start fresh": removes every lead, call log entry and import record, plus
// the automatic daily backups. Settings (statuses, opportunities, custom
// fields, AI settings) and user logins are kept. All-or-nothing, verified.
export async function clearAllData(): Promise<BackupSummary> {
  const before = await getCurrentSummary();
  await replaceStoresAtomically(
    { [KEYS.leads]: [], [KEYS.importBatches]: [], [KEYS.callLog]: [] },
    { deletePrefix: BACKUP_PREFIX }
  );
  return before;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Called once a day by a Vercel Cron job — snapshots everything under a
// date-stamped key so it shows up in Settings without anyone having to
// remember to click anything.
export async function runDailyBackup(): Promise<string> {
  const snapshot = await createBackupSnapshot();
  const key = `${BACKUP_PREFIX}${dateKey(new Date())}`;
  await overwriteStore(key, snapshot);

  const allKeys = await listKeysWithPrefix(BACKUP_PREFIX);
  const stale = allKeys.slice(RETENTION_DAYS);
  await Promise.all(stale.map((k) => deleteStoreKey(k)));

  return key;
}

export async function listDailyBackups(): Promise<{ date: string; exportedAt: string }[]> {
  const keys = await listKeysWithPrefix(BACKUP_PREFIX);
  const snapshots = await Promise.all(
    keys.map(async (key) => {
      const snap = await readStore<BackupSnapshot | null>(key, null);
      return snap ? { date: key.slice(BACKUP_PREFIX.length), exportedAt: snap.exportedAt } : null;
    })
  );
  return snapshots.filter((s): s is { date: string; exportedAt: string } => !!s);
}

export async function getDailyBackup(date: string): Promise<BackupSnapshot | null> {
  return readStore<BackupSnapshot | null>(`${BACKUP_PREFIX}${date}`, null);
}
