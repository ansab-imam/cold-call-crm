"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReassignDialog } from "./reassign-dialog";
import { cn } from "@/lib/utils";

// The one rule everywhere "Assigned To" can be edited: an admin can assign
// freely. A rep can only ever *reassign* a lead they already hold to someone
// else — and picking a new person (not clearing it) prompts for a reason,
// recorded on the lead. A rep never sees an unassigned lead in the first
// place (Pipeline hands those out), so this alone covers "only admins make
// the first assignment."
export function AssignedToSelect({
  value,
  assignableUsers,
  isAdmin,
  onChange,
  triggerClassName,
  stopPropagation,
}: {
  value: string | null;
  assignableUsers: string[];
  isAdmin: boolean;
  onChange: (next: string | null, reason: string | null) => void;
  triggerClassName?: string;
  stopPropagation?: boolean;
}) {
  const [pendingTarget, setPendingTarget] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  function handleValueChange(v: string | null) {
    const next = !v || v === "__unassigned" ? null : v;

    if (isAdmin || next === null || !value) {
      // Admin: free rein. Clearing an assignment, or a rep somehow hitting
      // an unassigned lead, needs no reason — there's nothing to explain yet.
      onChange(next, null);
      return;
    }

    setPendingTarget(next);
    setDialogOpen(true);
  }

  return (
    <>
      <Select value={value ?? "__unassigned"} onValueChange={handleValueChange}>
        <SelectTrigger
          size="sm"
          onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
          className={cn("w-full", triggerClassName)}
        >
          <SelectValue>
            {(v: unknown) => (v === "__unassigned" ? "Unassigned" : String(v))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__unassigned">Unassigned</SelectItem>
          {assignableUsers.map((u) => (
            <SelectItem key={u} value={u}>
              {u}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ReassignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        targetUser={pendingTarget}
        onConfirm={(reason) => {
          onChange(pendingTarget, reason);
        }}
      />
    </>
  );
}
