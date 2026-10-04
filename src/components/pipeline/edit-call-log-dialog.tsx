"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Lead } from "@/lib/pipeline/schema";
import type { StatusSettings } from "@/lib/pipeline/status-settings-store";
import { updateCallLog } from "@/lib/pipeline/api-client";
import type { CallLogEntry } from "@/lib/pipeline/call-log-schema";
import { Loader2, Pencil } from "lucide-react";
import { ordinal } from "@/lib/utils";

const NONE = "__none";
const MAX_ATTEMPT_OPTIONS = 12;

export function EditCallLogDialog({
  entry,
  statusOptions,
  open,
  onOpenChange,
  onSaved,
}: {
  entry: CallLogEntry | null;
  statusOptions: StatusSettings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (result: { entry: CallLogEntry; lead: Lead | null }) => void;
}) {
  const [callStatus, setCallStatus] = React.useState<string>(NONE);
  const [callOutcome, setCallOutcome] = React.useState<string>(NONE);
  const [attemptNumber, setAttemptNumber] = React.useState(1);
  const [notes, setNotes] = React.useState("");
  const [nextActionDate, setNextActionDate] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Seed every field from the entry being edited each time the dialog
  // opens — not on every prop change, so it doesn't reset mid-edit.
  React.useEffect(() => {
    if (open && entry) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCallStatus(entry.callStatus ?? NONE);
      setCallOutcome(entry.callOutcome ?? NONE);
      setAttemptNumber(entry.attemptNumber);
      setNotes(entry.notes ?? "");
      setNextActionDate(entry.nextActionDate ? entry.nextActionDate.slice(0, 10) : "");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id]);

  async function handleSubmit() {
    if (!entry) return;
    setLoading(true);
    setError(null);
    try {
      const result = await updateCallLog(entry.id, {
        callStatus: callStatus === NONE ? null : callStatus,
        callOutcome: callOutcome === NONE ? null : callOutcome,
        attemptNumber,
        notes: notes.trim() || null,
        nextActionDate: nextActionDate ? new Date(nextActionDate).toISOString() : null,
      });
      onSaved(result);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that change.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4" />
            Edit call log entry
          </DialogTitle>
          <DialogDescription>
            Fixes what&apos;s on record for this call — logged{" "}
            {entry ? new Date(entry.loggedAt).toLocaleString() : ""} by{" "}
            {entry?.loggedBy}. The edit itself is tracked too.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Call Status</Label>
            <Select value={callStatus} onValueChange={(v) => setCallStatus(v ?? NONE)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: unknown) => (v === NONE ? "— Not set —" : String(v))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Not set —</SelectItem>
                {statusOptions.callStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Call Outcome</Label>
            <Select value={callOutcome} onValueChange={(v) => setCallOutcome(v ?? NONE)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: unknown) => (v === NONE ? "— Not decided yet —" : String(v))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Not decided yet —</SelectItem>
                {statusOptions.callOutcomes.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Attempt Number</Label>
            <Select
              value={String(attemptNumber)}
              onValueChange={(v) => v && setAttemptNumber(Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{(v: unknown) => `${ordinal(Number(v))} attempt`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: MAX_ATTEMPT_OPTIONS }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {ordinal(n)} attempt
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Next follow-up</Label>
            <div className="flex gap-2">
              <input
                type="date"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              />
              {nextActionDate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setNextActionDate("")}
                >
                  No date
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What happened on the call…"
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
