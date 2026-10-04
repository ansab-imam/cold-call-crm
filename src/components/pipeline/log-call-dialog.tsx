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
import { logCall } from "@/lib/pipeline/api-client";
import type { CallLogEntry } from "@/lib/pipeline/call-log-schema";
import { Loader2, PhoneCall } from "lucide-react";
import { ordinal } from "@/lib/utils";

const NONE = "__none";
const MAX_ATTEMPT_OPTIONS = 12;

export function LogCallDialog({
  leadIds,
  statusOptions,
  open,
  onOpenChange,
  onLogged,
  initialNotes,
  initialAttemptNumber,
}: {
  leadIds: string[];
  statusOptions: StatusSettings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged: (results: { entry: CallLogEntry; lead: Lead }[]) => void;
  // Carries over whatever's currently in the lead's live Comments field
  // (single-lead use only) so it doesn't have to be retyped here.
  initialNotes?: string;
  // Suggests the next logical attempt number (current highest + 1) — the
  // rep can still pick a different one, this is just a sane starting point.
  initialAttemptNumber?: number;
}) {
  const [callStatus, setCallStatus] = React.useState<string>(NONE);
  const [callOutcome, setCallOutcome] = React.useState<string>(NONE);
  const [attemptNumber, setAttemptNumber] = React.useState(1);
  const [notes, setNotes] = React.useState("");
  const [nextActionDate, setNextActionDate] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setCallStatus(NONE);
    setCallOutcome(NONE);
    setAttemptNumber(1);
    setNotes("");
    setNextActionDate("");
    setError(null);
  }

  // Pull in the current comment draft and a suggested attempt number each
  // time the dialog opens (not on every keystroke elsewhere) — `open` is
  // controlled by the parent, so there's no local event to hook this off
  // of instead.
  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotes(initialNotes ?? "");
      setAttemptNumber(initialAttemptNumber ?? 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        leadIds.map((id) =>
          logCall(id, {
            callStatus: callStatus === NONE ? null : callStatus,
            callOutcome: callOutcome === NONE ? null : callOutcome,
            attemptNumber,
            notes: notes.trim() || null,
            nextActionDate: nextActionDate
              ? new Date(nextActionDate).toISOString()
              : null,
          })
        )
      );
      onLogged(results);
      onOpenChange(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that call.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="size-4" />
            Log a call
          </DialogTitle>
          <DialogDescription>
            {leadIds.length === 1
              ? "This is saved permanently to this lead's call history."
              : `Applies the same status/outcome to all ${leadIds.length} selected leads, each saved to its own call history.`}
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
            <p className="text-xs text-muted-foreground">
              How many times you&apos;ve reached out to this lead so far,
              including this call.
            </p>
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
            <Label>Next follow-up (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Set a date and this lead comes back to My Calls on that day.
              Leave it blank and it stays resolved, sitting only in Call Log.
            </p>
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
            Save to history
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
