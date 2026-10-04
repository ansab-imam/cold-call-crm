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
import { Loader2, UserRound } from "lucide-react";

// Only admins can hand out a lead's *first* assignment — reps can only ever
// reassign a lead they already hold, and have to say why. This dialog is
// that one gate, shared by every place "Assigned To" can be edited.
export function ReassignDialog({
  open,
  onOpenChange,
  targetUser,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: string | null;
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setReason("");
    setError(null);
  }

  async function handleSubmit() {
    if (!reason.trim()) {
      setError("Say why you're reassigning this lead.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onOpenChange(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reassign this lead.");
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
            <UserRound className="size-4" />
            Reassign to {targetUser ?? "—"}
          </DialogTitle>
          <DialogDescription>
            This lead is already assigned — reassigning it needs a reason on
            record.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label>Reason</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. client asked for a senior rep, wrong region, out of my depth…"
            rows={3}
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
