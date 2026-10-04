"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Loader2, RotateCcw, Upload, Database, Trash2, AlertTriangle } from "lucide-react";

type BackupRow = { date: string; exportedAt: string };

function formatDate(d: string): string {
  // d is "YYYY-MM-DD" — parse as UTC so it never drifts a day either way.
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function downloadBlob(res: Response, fallbackName: string) {
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const RESTORE_PHRASE = "RESTORE";
// Must match CLEAR_PHRASE in app/api/backup/clear/route.ts
const CLEAR_PHRASE = "DELETE ALL DATA";

type Summary = { leads: number; callLog: number; importBatches: number; customFields: number };
type SnapshotShape = {
  exportedAt?: string;
  data: { leads: unknown[]; callLog: unknown[]; importBatches: unknown[]; customFields: unknown[] };
};

function isSnapshotShape(v: unknown): v is SnapshotShape {
  const d = (v as SnapshotShape | null)?.data;
  return !!d && [d.leads, d.callLog, d.importBatches, d.customFields].every(Array.isArray);
}

function summarize(s: SnapshotShape): Summary {
  return {
    leads: s.data.leads.length,
    callLog: s.data.callLog.length,
    importBatches: s.data.importBatches.length,
    customFields: s.data.customFields.length,
  };
}

const SUMMARY_LABELS: [keyof Summary, string][] = [
  ["leads", "Leads"],
  ["callLog", "Call log entries"],
  ["importBatches", "Import history"],
  ["customFields", "Custom fields"],
];

// Restore and clear only go ahead once this download has succeeded.
async function downloadSafetyCopy(fallbackName: string) {
  const res = await fetch("/api/backup/export");
  if (!res.ok) throw new Error("Couldn't download a safety copy first, so nothing was changed.");
  await downloadBlob(res, fallbackName);
}

function SummaryTable({ title, after, now }: { title: string; after: Summary; now?: Summary | null }) {
  return (
    <div className="overflow-hidden rounded-lg border text-sm">
      <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">{title}</div>
      <table className="w-full">
        {now !== undefined && (
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-3 py-1.5 text-left font-medium">Data</th>
              <th className="px-3 py-1.5 text-right font-medium">Now</th>
              <th className="px-3 py-1.5 text-right font-medium">After restore</th>
            </tr>
          </thead>
        )}
        <tbody>
          {SUMMARY_LABELS.map(([k, label]) => (
            <tr key={k} className="border-t">
              <td className="px-3 py-1.5">{label}</td>
              {now !== undefined && (
                <td className="px-3 py-1.5 text-right text-muted-foreground">{now ? now[k].toLocaleString() : "…"}</td>
              )}
              <td className={`px-3 py-1.5 text-right font-medium ${now && now[k] !== after[k] ? "text-amber-600" : ""}`}>
                {after[k].toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BackupSettingsForm() {
  const [backups, setBackups] = React.useState<BackupRow[] | null>(null);
  const [downloading, setDownloading] = React.useState<string | null>(null);
  const [snapshotting, setSnapshotting] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState<{ snapshot: SnapshotShape; label: string } | null>(null);
  const [current, setCurrent] = React.useState<Summary | null>(null);
  const [confirmText, setConfirmText] = React.useState("");
  const [restored, setRestored] = React.useState<Summary | null>(null);
  const [step, setStep] = React.useState("");
  const [clearOpen, setClearOpen] = React.useState(false);
  const [clearText, setClearText] = React.useState("");
  const [clearing, setClearing] = React.useState(false);
  const [cleared, setCleared] = React.useState<Summary | null>(null);
  const busy = restoring || clearing;

  const loadBackups = React.useCallback(async () => {
    const res = await fetch("/api/backup");
    if (res.ok) {
      const { backups } = await res.json();
      setBackups(backups);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBackups();
  }, [loadBackups]);

  async function handleDownloadNow() {
    setDownloading("now");
    setError(null);
    try {
      const res = await fetch("/api/backup/export");
      if (!res.ok) throw new Error("Couldn't create a backup.");
      await downloadBlob(res, "coldcall-backup.json");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create a backup.");
    } finally {
      setDownloading(null);
    }
  }

  async function handleSnapshotNow() {
    setSnapshotting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      if (!res.ok) throw new Error("Couldn't take a snapshot.");
      await loadBackups();
      setMessage("Today's backup is saved below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't take a snapshot.");
    } finally {
      setSnapshotting(false);
    }
  }

  async function handleDownloadDate(date: string) {
    setDownloading(date);
    setError(null);
    try {
      const res = await fetch(`/api/backup/${date}`);
      if (!res.ok) throw new Error("Couldn't download that backup.");
      await downloadBlob(res, `coldcall-backup-${date}.json`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't download that backup.");
    } finally {
      setDownloading(null);
    }
  }

  // Step 1: load the snapshot and show a preview (now vs. after restore).
  async function openRestorePreview(snapshot: unknown, label: string) {
    setError(null);
    setMessage(null);
    setRestored(null);
    setConfirmText("");
    if (!isSnapshotShape(snapshot)) {
      setError("That doesn't look like an Cold Call CRM backup file.");
      return;
    }
    setPending({ snapshot, label });
    setCurrent(null);
    const res = await fetch("/api/backup/summary");
    if (res.ok) setCurrent((await res.json()).summary);
  }

  // Step 2: after typing RESTORE — safety copy first, then the all-or-nothing restore.
  async function handleConfirmRestore() {
    if (!pending || confirmText !== RESTORE_PHRASE) return;
    setRestoring(true);
    setError(null);
    setMessage(null);
    try {
      setStep("Downloading a safety copy of your current data…");
      await downloadSafetyCopy("coldcall-before-restore.json");

      setStep("Restoring and checking everything…");
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending.snapshot),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Restore failed.");
      setRestored(body.restored);
      setPending(null);
      setConfirmText("");
      setMessage("Restore complete — every module was checked against the backup. Reload any open page to see the restored data.");
    } catch (err) {
      setError(`${err instanceof Error ? err.message : "Restore failed."} Your data was not changed.`);
    } finally {
      setRestoring(false);
      setStep("");
    }
  }

  async function handleRestoreDate(date: string) {
    const res = await fetch(`/api/backup/${date}`);
    if (!res.ok) {
      setError("Couldn't load that backup.");
      return;
    }
    await openRestorePreview(await res.json(), `the ${formatDate(date)} backup`);
  }

  async function handleRestoreFile(file: File) {
    setError(null);
    try {
      const snapshot = JSON.parse(await file.text());
      await openRestorePreview(snapshot, `"${file.name}"`);
    } catch {
      setError("That file isn't valid JSON.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleClear() {
    if (clearText !== CLEAR_PHRASE) return;
    setClearing(true);
    setError(null);
    setMessage(null);
    try {
      // The daily backups are removed too, so this download is the only way back.
      setStep("Downloading a full backup first…");
      await downloadSafetyCopy("coldcall-before-clear.json");

      setStep("Clearing all data…");
      const res = await fetch("/api/backup/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: CLEAR_PHRASE }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Clearing failed.");
      setCleared(body.removed);
      setClearOpen(false);
      setClearText("");
      await loadBackups();
      setMessage('All data cleared. A full backup was downloaded first — use "Restore from a file" with it to bring everything back.');
    } catch (err) {
      setError(`${err instanceof Error ? err.message : "Clearing failed."} Nothing was deleted.`);
    } finally {
      setClearing(false);
      setStep("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="size-4" />
            Download a backup
          </CardTitle>
          <CardDescription>
            Every lead, call log entry, and admin setting (status/outcome
            options, the Opportunities board, script &amp; email templates) in
            one JSON file. User logins aren&apos;t included — those are
            managed separately in Users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleDownloadNow} disabled={downloading === "now"} className="gap-2">
            {downloading === "now" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Download backup now
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automatic daily backups</CardTitle>
          <CardDescription>
            Cold Call CRM saves one of these every day on its own, keeping the last two
            weeks — no need to remember to click anything.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            size="sm"
            variant="outline"
            className="w-fit gap-2"
            onClick={handleSnapshotNow}
            disabled={snapshotting}
          >
            {snapshotting ? <Loader2 className="size-3.5 animate-spin" /> : <Database className="size-3.5" />}
            Take a snapshot right now
          </Button>

          {backups === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : backups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No automatic backups yet — the first one lands after tonight, or
              click &quot;Take a snapshot right now&quot; above.
            </p>
          ) : (
            <div className="flex flex-col divide-y rounded-lg border">
              {backups.map((b) => (
                <div key={b.date} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-sm">{formatDate(b.date)}</span>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5"
                      onClick={() => handleDownloadDate(b.date)}
                      disabled={downloading === b.date}
                    >
                      {downloading === b.date ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Download className="size-3.5" />
                      )}
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => handleRestoreDate(b.date)}
                      disabled={busy}
                    >
                      <RotateCcw className="size-3.5" />
                      Restore
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="size-4" />
            Restore from a file
          </CardTitle>
          <CardDescription>
            Pick a backup JSON file you downloaded earlier to restore
            everything back to that point.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleRestoreFile(file);
            }}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            disabled={busy}
          />
          {restored && <SummaryTable title="Restored" after={restored} />}
        </CardContent>
      </Card>

      {pending && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RotateCcw className="size-4" />
              Restore {pending.label}?
            </CardTitle>
            <CardDescription>
              {pending.snapshot.exportedAt &&
                `Backup made ${new Date(pending.snapshot.exportedAt).toLocaleString()}. `}
              Cold Call CRM will become an exact copy of this backup.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <SummaryTable title="Compare: now vs. after restore" after={summarize(pending.snapshot)} now={current} />
            <ul className="list-disc space-y-0.5 rounded-lg border border-amber-200 bg-amber-50 py-2 pl-7 pr-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <li>Leads, call log, import history and admin settings are replaced with the backup.</li>
              <li>A safety copy of your current data downloads automatically first, so you can undo this.</li>
              <li>It&apos;s all-or-nothing: if anything goes wrong, nothing is changed.</li>
              <li>User logins aren&apos;t affected.</li>
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder={`Type ${RESTORE_PHRASE} to confirm`}
                className="w-56"
                disabled={restoring}
              />
              <Button
                onClick={handleConfirmRestore}
                disabled={confirmText !== RESTORE_PHRASE || restoring}
                className="gap-2 bg-amber-600 text-white hover:bg-amber-700"
              >
                {restoring ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                Restore this backup
              </Button>
              {!restoring && (
                <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
                  Cancel
                </Button>
              )}
            </div>
            {restoring && <p className="text-xs text-muted-foreground">{step} Please keep this page open.</p>}
          </CardContent>
        </Card>
      )}

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trash2 className="size-4 text-destructive" />
            Start fresh
          </CardTitle>
          <CardDescription>
            Removes every lead, call log entry and import record so you can
            start with new data. Your settings (statuses, Opportunities board,
            custom fields, templates, AI settings) and user logins stay.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!clearOpen ? (
            <Button
              variant="outline"
              className="w-fit gap-2 border-destructive/50 text-destructive hover:text-destructive"
              onClick={() => {
                setClearOpen(true);
                setCleared(null);
                setMessage(null);
                setError(null);
              }}
              disabled={busy}
            >
              <Trash2 className="size-4" />
              Clear all data…
            </Button>
          ) : (
            <>
              <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <p className="flex items-center gap-1.5 font-semibold text-destructive">
                  <AlertTriangle className="size-3.5" /> This will remove
                </p>
                <p>All leads (Pipeline, My Calls, Opportunities, Invalid Leads), the call log, import history, and all automatic daily backups.</p>
                <p className="pt-1 font-semibold">Kept</p>
                <p>Statuses, Opportunities board, custom fields, templates, AI settings and user logins.</p>
                <p className="pt-1">
                  A full backup downloads automatically first — since the daily backups are removed too, keep that
                  file: it&apos;s the only way to bring the data back.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={clearText}
                  onChange={(e) => setClearText(e.target.value.toUpperCase())}
                  placeholder={`Type ${CLEAR_PHRASE} to confirm`}
                  className="w-64"
                  disabled={clearing}
                />
                <Button
                  variant="destructive"
                  onClick={handleClear}
                  disabled={clearText !== CLEAR_PHRASE || clearing}
                  className="gap-2"
                >
                  {clearing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  Clear all data
                </Button>
                {!clearing && (
                  <Button variant="ghost" size="sm" onClick={() => { setClearOpen(false); setClearText(""); }}>
                    Cancel
                  </Button>
                )}
              </div>
              {clearing && <p className="text-xs text-muted-foreground">{step} Please keep this page open.</p>}
            </>
          )}
          {cleared && <SummaryTable title="Removed" after={cleared} />}
        </CardContent>
      </Card>

      {message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
