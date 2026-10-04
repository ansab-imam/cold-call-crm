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
import type { Lead } from "@/lib/pipeline/schema";
import { markLeadInvalid } from "@/lib/pipeline/api-client";
import { Loader2, Ban } from "lucide-react";

export function MarkInvalidDialog({
  leadIds,
  open,
  onOpenChange,
  onMarked,
}: {
  leadIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarked: (leads: Lead[]) => void;
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
      setError("Enter a reason.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const leads = await Promise.all(leadIds.map((id) => markLeadInvalid(id, reason.trim())));
      onMarked(leads);
      onOpenChange(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't mark this as invalid.");
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
            <Ban className="size-4" />
            Mark as invalid
          </DialogTitle>
          <DialogDescription>
            {leadIds.length === 1
              ? "This lead moves to Invalid Leads instead of being deleted — nothing is lost, and it can be restored later."
              : `These ${leadIds.length} leads move to Invalid Leads instead of being deleted — nothing is lost, and they can be restored later.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label>Reason</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. website not working, wrong industry, no longer in business…"
            rows={3}
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            Mark as invalid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
