"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type Row,
  type SortingState,
  type Table as TanstackTable,
  type VisibilityState,
} from "@tanstack/react-table";
import type { Lead } from "@/lib/pipeline/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Columns3,
  FileText,
  Mail,
  PhoneCall,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { LogCallDialog } from "./log-call-dialog";
import { GenerateContentDialog } from "./generate-content-dialog";
import { getPipelineColumns, ALL_COLUMN_IDS, customFieldColumnId } from "./columns";
import { ColumnResizeHandle } from "@/components/ui/column-resize-handle";
import { ColumnSortMenu } from "./column-sort-menu";
import { LeadDetailSheet } from "./lead-detail-sheet";
import {
  bulkPatchLeads,
  deleteLeads as deleteLeadsApi,
  fetchLeads,
  fetchCustomFields,
  patchLead,
} from "@/lib/pipeline/api-client";
import type { CustomFieldDef } from "@/lib/pipeline/custom-fields-store";
import { belongsInMyCalls } from "@/lib/pipeline/queues";
import { daysSince, daysUntil } from "@/lib/pipeline/dates";
import { applyShiftRangeSelection } from "@/lib/pipeline/row-selection";
import type { StatusSettings } from "@/lib/pipeline/status-settings-store";
import { cn } from "@/lib/utils";
import { useColumnOrder } from "@/hooks/use-column-order";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useOpenLeadFromQuery } from "@/hooks/use-open-lead-from-query";

const DEFAULT_VISIBLE = new Set([
  "select",
  "rowNumber",
  "lead",
  "due",
  "leadType",
  "companyName",
  "primaryPhone",
  "callStatus",
  "callOutcome",
  "nextActionDate",
  "open",
]);

// A lead with a scheduled follow-up is "due" as of that date, chosen by
// whoever logged the call — not the original assignment date. One without
// a follow-up (never yet called) falls back to how long it's sat assigned.
function DueBadge({ assignedAt, nextActionDate }: { assignedAt: string | null; nextActionDate: string | null }) {
  if (nextActionDate) {
    const days = -daysUntil(nextActionDate);
    if (days < 0) {
      return (
        <Badge variant="secondary" className="font-normal">
          Due in {-days} {-days === 1 ? "day" : "days"}
        </Badge>
      );
    }
    if (days === 0) {
      return (
        <Badge variant="secondary" className="bg-sky-500/15 font-normal text-sky-600 dark:text-sky-400">
          Due today
        </Badge>
      );
    }
    return (
      <Badge
        variant="secondary"
        className={cn(
          "font-normal",
          days >= 3
            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
            : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        )}
      >
        {days} {days === 1 ? "day" : "days"} late
      </Badge>
    );
  }

  if (!assignedAt) return <span className="text-sm text-muted-foreground">—</span>;
  const days = daysSince(assignedAt);
  if (days <= 0) {
    return (
      <Badge variant="secondary" className="bg-sky-500/15 font-normal text-sky-600 dark:text-sky-400">
        Due today
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-normal",
        days >= 3
          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      )}
    >
      {days} {days === 1 ? "day" : "days"} late
    </Badge>
  );
}

// A lead with no outcome yet has never actually been called — everything
// else in this queue came back because a follow-up date was set on a
// previous call, meaning there's call history worth reading first.
function LeadTypeBadge({ callOutcome }: { callOutcome: string | null }) {
  if (!callOutcome) {
    return (
      <Badge variant="secondary" className="bg-sky-500/15 font-normal text-sky-600 dark:text-sky-400">
        Fresh
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-violet-500/15 font-normal text-violet-600 dark:text-violet-400">
      Callback
    </Badge>
  );
}

export function MyCallsTable({
  initialLeads,
  statusOptions,
  assignableUsers,
  currentUser,
  isAdmin,
}: {
  initialLeads: Lead[];
  statusOptions: StatusSettings;
  assignableUsers: string[];
  currentUser: string;
  isAdmin: boolean;
}) {
  const [leads, setLeads] = React.useState<Lead[]>(initialLeads);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [sortMenuColumnId, setSortMenuColumnId] = React.useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState({});
  const [openLeadId, setOpenLeadId] = React.useState<string | null>(null);
  useOpenLeadFromQuery(leads, setOpenLeadId);

  const refresh = React.useCallback(async () => {
    const fresh = await fetchLeads();
    setLeads(fresh.filter((l) => belongsInMyCalls(l, currentUser)));
  }, [currentUser]);

  const handleUpdate = React.useCallback(async (id: string, patch: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    try {
      const saved = await patchLead(id, patch);
      setLeads((prev) => {
        // Stage moving past New/Attempted, losing its assignment, or being
        // reassigned to someone else means it's resolved (for you) — drop it
        // out of today's queue rather than leaving a stale row sitting here.
        if (!belongsInMyCalls(saved, currentUser)) return prev.filter((l) => l.id !== id);
        return prev.map((l) => (l.id === id ? saved : l));
      });
    } catch {
      refresh();
    }
  }, [refresh, currentUser]);

  // Anchor for shift-click range selection — the index (within the current
  // page's row order) of the last row clicked, plain or shift.
  const lastClickedIndexRef = React.useRef<number | null>(null);

  const handleSelectRow = React.useCallback(
    (row: Row<Lead>, shiftKey: boolean, table: TanstackTable<Lead>) => {
      const rows = table.getRowModel().rows;
      const targetIndex = rows.findIndex((r) => r.id === row.id);
      const willSelect = !row.getIsSelected();

      if (shiftKey && lastClickedIndexRef.current !== null) {
        setRowSelection((prev) =>
          applyShiftRangeSelection(
            prev,
            rows.map((r) => r.id),
            lastClickedIndexRef.current!,
            targetIndex,
            willSelect
          )
        );
      } else {
        row.toggleSelected(willSelect);
      }
      lastClickedIndexRef.current = targetIndex;
    },
    []
  );

  const [customFields, setCustomFields] = React.useState<CustomFieldDef[]>([]);

  React.useEffect(() => {
    fetchCustomFields().then((fields) => {
      setCustomFields(fields);
      setColumnVisibility((prev) => {
        const next = { ...prev };
        for (const f of fields) {
          const id = customFieldColumnId(f.key);
          if (!(id in next)) next[id] = true;
        }
        return next;
      });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const baseColumns = React.useMemo(
    () =>
      getPipelineColumns({
        onUpdate: handleUpdate,
        onOpen: (lead) => setOpenLeadId(lead.id),
        onSelectRow: handleSelectRow,
        assignableUsers,
        customFields,
        isAdmin,
        currentUser,
      }),
    [handleUpdate, handleSelectRow, assignableUsers, customFields, isAdmin, currentUser]
  );

  const columns = React.useMemo<ColumnDef<Lead>[]>(() => {
    const dueColumn: ColumnDef<Lead> = {
      id: "due",
      accessorFn: (l) => l.nextActionDate ?? l.assignedAt ?? "",
      header: "Due",
      size: 130,
      cell: ({ row }) => (
        <DueBadge
          assignedAt={row.original.assignedAt}
          nextActionDate={row.original.nextActionDate}
        />
      ),
    };
    const leadTypeColumn: ColumnDef<Lead> = {
      id: "leadType",
      accessorFn: (l) => (l.callOutcome ? "Callback" : "Fresh"),
      header: "Lead Type",
      size: 110,
      cell: ({ row }) => <LeadTypeBadge callOutcome={row.original.callOutcome} />,
    };
    const leadIdx = baseColumns.findIndex((c) => c.id === "lead");
    const next = [...baseColumns];
    next.splice(leadIdx + 1, 0, dueColumn, leadTypeColumn);
    return next;
  }, [baseColumns]);

  // Built from the authoritative id list, not by reading `.id` off the raw
  // column defs — accessorKey-based columns don't carry an explicit `.id` on
  // that plain object (react-table derives it internally), so deriving ids
  // that way silently drops most columns and leaves them defaulted visible.
  const [columnVisibility, setColumnVisibility] = usePersistedState<VisibilityState>(
    "coldcall:my-calls:column-visibility",
    Object.fromEntries(
      [...ALL_COLUMN_IDS, "due", "leadType"].map((id) => [id, DEFAULT_VISIBLE.has(id)])
    )
  );
  const { columnOrder, handleDragStart, handleDrop } = useColumnOrder(
    "coldcall:my-calls:column-order",
    // "due" and "leadType" sit right after "lead" by default — insert them
    // there so a first-time (no saved order yet) layout still makes sense.
    (() => {
      const withExtras = [...ALL_COLUMN_IDS];
      withExtras.splice(withExtras.indexOf("lead") + 1, 0, "due", "leadType");
      return withExtras;
    })()
  );

  const [columnSizing, setColumnSizing] = usePersistedState<ColumnSizingState>(
    "coldcall:my-calls:column-sizing",
    {}
  );

  const table = useReactTable({
    data: leads,
    columns,
    state: { sorting, globalFilter, rowSelection, columnVisibility, columnOrder, columnSizing },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    initialState: {
      sorting: [{ id: "due", desc: true }],
      pagination: { pageSize: 50 },
    },
  });

  const selectedIds = Object.keys(rowSelection);
  const selectedCount = selectedIds.length;

  const [logCallOpen, setLogCallOpen] = React.useState(false);
  const [generateOpen, setGenerateOpen] = React.useState<"script" | "email" | null>(null);
  const primarySelectedLead = leads.find((l) => l.id === selectedIds[0]) ?? null;
  // Bulk-logging several leads at once suggests the next attempt based on
  // whichever selected lead has been reached out to the most — still just
  // a starting point, freely overridable in the dialog.
  const selectedLeads = leads.filter((l) => selectedIds.includes(l.id));
  const suggestedAttemptNumber =
    selectedLeads.length > 0
      ? Math.max(...selectedLeads.map((l) => l.attemptCount)) + 1
      : 1;

  function handleCallsLogged(results: { entry: unknown; lead: Lead }[]) {
    const updatedById = new Map(results.map((r) => [r.lead.id, r.lead]));
    setLeads((prev) =>
      prev
        .map((l) => updatedById.get(l.id) ?? l)
        .filter((l) => (updatedById.has(l.id) ? belongsInMyCalls(l, currentUser) : true))
    );
    setRowSelection({});
  }

  async function bulkUnassign() {
    await bulkPatchLeads(selectedIds, { assignedTo: null, assignedAt: null });
    setLeads((prev) => prev.filter((l) => !selectedIds.includes(l.id)));
    setRowSelection({});
  }

  async function handleBulkDelete() {
    const confirmed = window.confirm(
      selectedCount === 1
        ? "Delete this lead? This can't be undone."
        : `Delete these ${selectedCount} leads? This can't be undone.`
    );
    if (!confirmed) return;
    await deleteLeadsApi(selectedIds);
    setLeads((prev) => prev.filter((l) => !selectedIds.includes(l.id)));
    setRowSelection({});
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search your calls…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="gap-2">
                <Columns3 className="size-4" />
                Columns
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
            {table
              .getAllColumns()
              .filter((c) => c.getCanHide())
              .map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={c.getIsVisible()}
                  onCheckedChange={(v) => c.toggleVisibility(!!v)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {typeof c.columnDef.header === "string" ? c.columnDef.header : c.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} to call
        </span>
      </div>

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-accent/50 px-3 py-2">
          <Badge variant="secondary">{selectedCount} selected</Badge>
          <Button size="sm" className="gap-2" onClick={() => setLogCallOpen(true)}>
            <PhoneCall className="size-3.5" />
            Log a call
          </Button>
          <Button size="sm" variant="outline" onClick={bulkUnassign}>
            Send back to Pipeline
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-none bg-violet-500/15 text-violet-600 hover:bg-violet-500/25 dark:text-violet-400"
            onClick={() => setGenerateOpen("script")}
          >
            <FileText className="size-3.5" />
            Generate script
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-none bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400"
            onClick={() => setGenerateOpen("email")}
          >
            <Mail className="size-3.5" />
            Generate email
          </Button>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={handleBulkDelete}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto gap-1.5"
            onClick={() => setRowSelection({})}
          >
            <X className="size-3.5" />
            Clear
          </Button>
        </div>
      )}

      <div className="rounded-lg border">
        <Table className="table-fixed">
          <colgroup>
            {table.getFlatHeaders().map((header) => (
              <col key={header.id} style={{ width: header.getSize() }} />
            ))}
          </colgroup>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const reorderable = header.id !== "select" && header.id !== "open";
                  return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "relative overflow-hidden select-none",
                      reorderable && "cursor-grab active:cursor-grabbing"
                    )}
                    title={reorderable ? "Drag to reorder columns" : undefined}
                    draggable={reorderable}
                    onDragStart={(e) => {
                      if (!reorderable) return;
                      e.stopPropagation();
                      handleDragStart(header.id);
                    }}
                    onDragOver={(e) => reorderable && e.preventDefault()}
                    onDrop={(e) => {
                      if (!reorderable) return;
                      e.preventDefault();
                      e.stopPropagation();
                      handleDrop(header.id);
                    }}
                    onContextMenu={(e) => {
                      if (!header.column.getCanSort()) return;
                      e.preventDefault();
                      setSortMenuColumnId(header.id);
                    }}
                  >
                    <div className="flex items-center gap-1 truncate">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() &&
                        header.id !== "select" &&
                        header.id !== "open" && (
                          <ColumnSortMenu
                            column={header.column}
                            open={sortMenuColumnId === header.id}
                            onOpenChange={(o) => setSortMenuColumnId(o ? header.id : null)}
                          />
                        )}
                    </div>
                    {header.column.getCanResize() && (
                      <ColumnResizeHandle
                        onMouseDown={header.getResizeHandler()}
                      />
                    )}
                  </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  Nothing to call right now. Assign yourself some leads from Pipeline.
                </TableCell>
              </TableRow>
            )}
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => setOpenLeadId(row.original.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="overflow-hidden text-ellipsis">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {Math.max(1, table.getPageCount())}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      <LeadDetailSheet
        lead={leads.find((l) => l.id === openLeadId) ?? null}
        onOpenChange={(open) => !open && setOpenLeadId(null)}
        onUpdate={handleUpdate}
        onCallLogged={handleCallsLogged}
        onDeleted={(id) => setLeads((prev) => prev.filter((l) => l.id !== id))}
        assignableUsers={assignableUsers}
        statusOptions={statusOptions}
        isAdmin={isAdmin}
        currentUser={currentUser}
      />

      <LogCallDialog
        leadIds={selectedIds}
        statusOptions={statusOptions}
        open={logCallOpen}
        onOpenChange={setLogCallOpen}
        onLogged={handleCallsLogged}
        initialAttemptNumber={suggestedAttemptNumber}
      />

      <GenerateContentDialog
        leadId={primarySelectedLead?.id ?? null}
        leadName={primarySelectedLead?.fullName ?? primarySelectedLead?.companyName ?? null}
        type={generateOpen ?? "script"}
        open={generateOpen !== null}
        onOpenChange={(o) => !o && setGenerateOpen(null)}
      />
    </div>
  );
}
