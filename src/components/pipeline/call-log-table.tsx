"use client";

import * as React from "react";
import type { Lead } from "@/lib/pipeline/schema";
import type { CallLogEntry } from "@/lib/pipeline/call-log-schema";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Pencil } from "lucide-react";
import { LeadDetailSheet } from "./lead-detail-sheet";
import { EditCallLogDialog } from "./edit-call-log-dialog";
import { patchLead } from "@/lib/pipeline/api-client";
import { formatDateOnly } from "@/lib/pipeline/dates";
import { useColumnOrder } from "@/hooks/use-column-order";
import { useOpenLeadFromQuery } from "@/hooks/use-open-lead-from-query";
import { useColumnSizing } from "@/hooks/use-column-sizing";
import { ColumnResizeHandle } from "@/components/ui/column-resize-handle";
import { cn } from "@/lib/utils";

type Ctx = { entry: CallLogEntry; index: number; lead: Lead | undefined };

const COLUMNS: { id: string; label: string; className?: string; render: (ctx: Ctx) => React.ReactNode }[] = [
  {
    id: "index",
    label: "#",
    className: "w-12 text-sm tabular-nums text-muted-foreground",
    render: ({ index }) => index + 1,
  },
  {
    id: "date",
    label: "Date",
    className: "text-sm text-muted-foreground",
    render: ({ entry }) => (
      <span>
        {new Date(entry.loggedAt).toLocaleString()}
        {entry.editedAt && (
          <span className="ml-1.5 text-xs text-muted-foreground/70" title={`Edited by ${entry.editedBy} on ${new Date(entry.editedAt).toLocaleString()}`}>
            (edited)
          </span>
        )}
      </span>
    ),
  },
  {
    id: "lead",
    label: "Lead",
    className: "text-sm font-medium",
    render: ({ lead }) => lead?.fullName ?? "Unnamed lead",
  },
  {
    id: "company",
    label: "Company",
    className: "text-sm text-muted-foreground",
    render: ({ lead }) => lead?.companyName ?? "—",
  },
  {
    id: "callStatus",
    label: "Call Status",
    render: ({ entry }) =>
      entry.callStatus ? (
        <Badge variant="secondary" className="font-normal">
          {entry.callStatus}
        </Badge>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      ),
  },
  {
    id: "callOutcome",
    label: "Call Outcome",
    render: ({ entry }) =>
      entry.callOutcome ? (
        <Badge variant="secondary" className="bg-primary/10 font-normal text-primary">
          {entry.callOutcome}
        </Badge>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      ),
  },
  {
    id: "attemptNumber",
    label: "Attempt #",
    className: "text-sm text-muted-foreground",
    render: ({ entry }) => entry.attemptNumber ?? "—",
  },
  {
    id: "notes",
    label: "Notes",
    className: "max-w-[240px] truncate text-sm text-muted-foreground",
    render: ({ entry }) => entry.notes || "—",
  },
  {
    id: "nextActionDate",
    label: "Next Follow-up",
    className: "text-sm text-muted-foreground",
    render: ({ entry }) =>
      entry.nextActionDate ? formatDateOnly(entry.nextActionDate) : "—",
  },
  {
    id: "loggedBy",
    label: "Logged By",
    className: "text-sm text-muted-foreground",
    render: ({ entry }) => entry.loggedBy,
  },
];

const DEFAULT_ORDER = COLUMNS.map((c) => c.id);
const DEFAULT_SIZES: Record<string, number> = {
  index: 48,
  date: 160,
  lead: 160,
  company: 180,
  callStatus: 140,
  callOutcome: 160,
  attemptNumber: 100,
  notes: 240,
  nextActionDate: 140,
  loggedBy: 140,
};

export function CallLogTable({
  initialEntries,
  initialLeads,
  statusOptions,
  assignableUsers,
  isAdmin,
  currentUser,
}: {
  initialEntries: CallLogEntry[];
  initialLeads: Lead[];
  statusOptions: StatusSettings;
  assignableUsers: string[];
  isAdmin: boolean;
  currentUser: string;
}) {
  const [leads, setLeads] = React.useState<Lead[]>(initialLeads);
  const [entries, setEntries] = React.useState<CallLogEntry[]>(initialEntries);
  const [editingEntry, setEditingEntry] = React.useState<CallLogEntry | null>(null);
  const [search, setSearch] = React.useState("");
  const [openLeadId, setOpenLeadId] = React.useState<string | null>(null);
  useOpenLeadFromQuery(leads, setOpenLeadId);
  const { columnOrder, handleDragStart, handleDrop } = useColumnOrder(
    "coldcall:call-log:column-order",
    DEFAULT_ORDER
  );
  const { getWidth, startResize } = useColumnSizing(
    "coldcall:call-log:column-sizing",
    DEFAULT_SIZES
  );

  const orderedColumns = React.useMemo(
    () => columnOrder.map((id) => COLUMNS.find((c) => c.id === id)).filter((c) => !!c),
    [columnOrder]
  );

  const leadsById = React.useMemo(
    () => new Map(leads.map((l) => [l.id, l])),
    [leads]
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      const lead = leadsById.get(e.leadId);
      return (
        lead?.fullName?.toLowerCase().includes(q) ||
        lead?.companyName?.toLowerCase().includes(q) ||
        e.notes?.toLowerCase().includes(q) ||
        e.callStatus?.toLowerCase().includes(q) ||
        e.callOutcome?.toLowerCase().includes(q)
      );
    });
  }, [search, entries, leadsById]);

  const handleUpdate = React.useCallback(async (id: string, patch: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const saved = await patchLead(id, patch);
    setLeads((prev) => prev.map((l) => (l.id === id ? saved : l)));
  }, []);

  function handleCallsLogged(results: { lead: Lead }[]) {
    const updatedById = new Map(results.map((r) => [r.lead.id, r.lead]));
    setLeads((prev) => prev.map((l) => updatedById.get(l.id) ?? l));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search call history…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>
      <span className="text-sm text-muted-foreground">{filtered.length} calls logged</span>

      <div className="rounded-lg border">
        <Table className="table-fixed">
          <colgroup>
            {orderedColumns.map((col) => (
              <col key={col.id} style={{ width: getWidth(col.id) }} />
            ))}
            {isAdmin && <col style={{ width: 56 }} />}
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {orderedColumns.map((col) => (
                <TableHead
                  key={col.id}
                  className="relative cursor-grab select-none overflow-hidden active:cursor-grabbing"
                  title="Drag to reorder columns"
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    handleDragStart(col.id);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDrop(col.id);
                  }}
                >
                  <span className="block truncate">{col.label}</span>
                  <ColumnResizeHandle onMouseDown={startResize(col.id)} />
                </TableHead>
              ))}
              {isAdmin && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={orderedColumns.length + (isAdmin ? 1 : 0)} className="h-32 text-center text-sm text-muted-foreground">
                  No calls logged yet. Log a call from My Calls to see it here.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((e, i) => {
              const lead = leadsById.get(e.leadId);
              const ctx: Ctx = { entry: e, index: i, lead };
              return (
                <TableRow
                  key={e.id}
                  className="cursor-pointer"
                  onClick={() => setOpenLeadId(e.leadId)}
                >
                  {orderedColumns.map((col) => (
                    <TableCell key={col.id} className={cn(col.className, "overflow-hidden truncate")}>
                      {col.render(ctx)}
                    </TableCell>
                  ))}
                  {isAdmin && (
                    <TableCell className="overflow-hidden">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        title="Edit this call log entry"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setEditingEntry(e);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <LeadDetailSheet
        lead={leadsById.get(openLeadId ?? "") ?? null}
        onOpenChange={(open) => !open && setOpenLeadId(null)}
        onUpdate={handleUpdate}
        onCallLogged={handleCallsLogged}
        onDeleted={(id) => setLeads((prev) => prev.filter((l) => l.id !== id))}
        assignableUsers={assignableUsers}
        statusOptions={statusOptions}
        isAdmin={isAdmin}
        currentUser={currentUser}
      />

      <EditCallLogDialog
        entry={editingEntry}
        statusOptions={statusOptions}
        open={!!editingEntry}
        onOpenChange={(o) => !o && setEditingEntry(null)}
        onSaved={({ entry: saved, lead: savedLead }) => {
          setEntries((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
          if (savedLead) {
            setLeads((prev) => prev.map((l) => (l.id === savedLead.id ? savedLead : l)));
          }
        }}
      />
    </div>
  );
}
