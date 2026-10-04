"use client";

import * as React from "react";
import type { Lead } from "@/lib/pipeline/schema";
import type { StatusSettings } from "@/lib/pipeline/status-settings-store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw, Loader2 } from "lucide-react";
import { LeadDetailSheet } from "./lead-detail-sheet";
import { patchLead, restoreLead } from "@/lib/pipeline/api-client";
import { useOpenLeadFromQuery } from "@/hooks/use-open-lead-from-query";
import { useColumnSizing } from "@/hooks/use-column-sizing";
import { ColumnResizeHandle } from "@/components/ui/column-resize-handle";

const COLUMN_IDS = ["lead", "company", "reason", "markedBy", "markedAt", "actions"] as const;
const DEFAULT_SIZES: Record<string, number> = {
  lead: 180,
  company: 200,
  reason: 280,
  markedBy: 140,
  markedAt: 130,
  actions: 130,
};

export function InvalidLeadsTable({
  initialLeads,
  statusOptions,
  assignableUsers,
  isAdmin,
  currentUser,
}: {
  initialLeads: Lead[];
  statusOptions: StatusSettings;
  assignableUsers: string[];
  isAdmin: boolean;
  currentUser: string;
}) {
  const [leads, setLeads] = React.useState<Lead[]>(initialLeads);
  const [search, setSearch] = React.useState("");
  const [openLeadId, setOpenLeadId] = React.useState<string | null>(null);
  useOpenLeadFromQuery(leads, setOpenLeadId);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);
  const { getWidth, startResize } = useColumnSizing(
    "coldcall:invalid-leads:column-sizing",
    DEFAULT_SIZES
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.fullName?.toLowerCase().includes(q) ||
        l.companyName?.toLowerCase().includes(q) ||
        l.invalidReason?.toLowerCase().includes(q)
    );
  }, [search, leads]);

  const handleUpdate = React.useCallback(async (id: string, patch: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const saved = await patchLead(id, patch);
    setLeads((prev) =>
      saved.isInvalid ? prev.map((l) => (l.id === id ? saved : l)) : prev.filter((l) => l.id !== id)
    );
  }, []);

  async function handleRestore(id: string) {
    setRestoringId(id);
    try {
      await restoreLead(id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search invalid leads…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>
      <span className="text-sm text-muted-foreground">{filtered.length} invalid leads</span>

      <div className="rounded-lg border">
        <Table className="table-fixed">
          <colgroup>
            {COLUMN_IDS.map((id) => (
              <col key={id} style={{ width: getWidth(id) }} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {(
                [
                  ["lead", "Lead"],
                  ["company", "Company"],
                  ["reason", "Reason"],
                  ["markedBy", "Marked By"],
                  ["markedAt", "Marked At"],
                  ["actions", ""],
                ] as const
              ).map(([id, label]) => (
                <TableHead key={id} className="relative overflow-hidden">
                  <span className="block truncate">{label}</span>
                  {id !== "actions" && <ColumnResizeHandle onMouseDown={startResize(id)} />}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                  Nothing here — leads marked invalid from Pipeline show up in this list instead of
                  being deleted.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((lead) => (
              <TableRow
                key={lead.id}
                className="cursor-pointer"
                onClick={() => setOpenLeadId(lead.id)}
              >
                <TableCell className="overflow-hidden truncate text-sm font-medium">
                  {lead.fullName ?? "Unnamed lead"}
                </TableCell>
                <TableCell className="overflow-hidden truncate text-sm text-muted-foreground">
                  {lead.companyName ?? "—"}
                </TableCell>
                <TableCell className="overflow-hidden truncate text-sm text-muted-foreground">
                  {lead.invalidReason ?? "—"}
                </TableCell>
                <TableCell className="overflow-hidden truncate text-sm text-muted-foreground">
                  {lead.invalidBy ?? "—"}
                </TableCell>
                <TableCell className="overflow-hidden truncate text-sm text-muted-foreground">
                  {lead.invalidAt ? new Date(lead.invalidAt).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={restoringId === lead.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestore(lead.id);
                    }}
                  >
                    {restoringId === lead.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    Restore
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <LeadDetailSheet
        lead={leads.find((l) => l.id === openLeadId) ?? null}
        onOpenChange={(open) => !open && setOpenLeadId(null)}
        onUpdate={handleUpdate}
        onDeleted={(id) => setLeads((prev) => prev.filter((l) => l.id !== id))}
        assignableUsers={assignableUsers}
        statusOptions={statusOptions}
        isAdmin={isAdmin}
        currentUser={currentUser}
      />
    </div>
  );
}
