"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Ban,
  Columns3,
  Plus,
  Search,
  Trash2,
  Upload,
  Download,
  X,
} from "lucide-react";
import {
  ALL_COLUMN_IDS,
  DEFAULT_VISIBLE_COLUMNS,
  getPipelineColumns,
  customFieldColumnId,
} from "./columns";
import { ColumnResizeHandle } from "@/components/ui/column-resize-handle";
import { ColumnSortMenu } from "./column-sort-menu";
import { LeadDetailSheet } from "./lead-detail-sheet";
import { MarkInvalidDialog } from "./mark-invalid-dialog";
import { ImportDialog } from "./import-dialog";
import {
  bulkPatchLeads,
  createLead,
  deleteLeads as deleteLeadsApi,
  fetchLeads,
  fetchCustomFields,
  patchLead,
} from "@/lib/pipeline/api-client";
import type { CustomFieldDef } from "@/lib/pipeline/custom-fields-store";

import { belongsInPipeline } from "@/lib/pipeline/queues";
import type { StatusSettings } from "@/lib/pipeline/status-settings-store";
import { applyShiftRangeSelection } from "@/lib/pipeline/row-selection";
import { useColumnOrder } from "@/hooks/use-column-order";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useOpenLeadFromQuery } from "@/hooks/use-open-lead-from-query";
import { cn } from "@/lib/utils";

export function PipelineTable({
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
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [sortMenuColumnId, setSortMenuColumnId] = React.useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = React.useState({});
  // Track just the id, not a snapshot of the lead — so the open detail panel
  // always reflects the latest edits instead of freezing at whatever it
  // looked like the moment it was opened.
  const [openLeadId, setOpenLeadId] = React.useState<string | null>(null);
  useOpenLeadFromQuery(leads, setOpenLeadId);
  const [importOpen, setImportOpen] = React.useState(false);
  const [invalidOpen, setInvalidOpen] = React.useState(false);
  const [columnVisibility, setColumnVisibility] = usePersistedState<VisibilityState>(
    "coldcall:pipeline:column-visibility",
    Object.fromEntries(
      ALL_COLUMN_IDS.map((id) => [id, DEFAULT_VISIBLE_COLUMNS.includes(id)])
    )
  );
  const { columnOrder, handleDragStart, handleDrop } = useColumnOrder(
    "coldcall:pipeline:column-order",
    ALL_COLUMN_IDS
  );
  const [customFields, setCustomFields] = React.useState<CustomFieldDef[]>([]);
  const [columnSizing, setColumnSizing] = usePersistedState<ColumnSizingState>(
    "coldcall:pipeline:column-sizing",
    {}
  );

  React.useEffect(() => {
    fetchCustomFields().then((fields) => {
      setCustomFields(fields);
      // New custom columns default to visible — only fall back to hidden
      // once the viewer has actually made a visibility choice for them.
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

  const refresh = React.useCallback(async () => {
    const fresh = await fetchLeads();
    setLeads(fresh.filter(belongsInPipeline));
  }, []);

  const handleUpdate = React.useCallback(async (id: string, patch: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    try {
      // The server may derive extra fields (e.g. Full Name from First/Last),
      // so reconcile with what it actually stored rather than trusting the
      // optimistic patch alone. Assigning a lead also sends it straight to
      // My Calls — it stops belonging here the instant that happens.
      const saved = await patchLead(id, patch);
      setLeads((prev) =>
        belongsInPipeline(saved)
          ? prev.map((l) => (l.id === id ? saved : l))
          : prev.filter((l) => l.id !== id)
      );
    } catch {
      refresh();
    }
  }, [refresh]);

  function handleCallsLogged(results: { lead: Lead }[]) {
    const updatedById = new Map(results.map((r) => [r.lead.id, r.lead]));
    setLeads((prev) =>
      prev
        .map((l) => updatedById.get(l.id) ?? l)
        .filter((l) => (updatedById.has(l.id) ? belongsInPipeline(l) : true))
    );
  }

  async function handleAddLead() {
    const lead = await createLead();
    setLeads((prev) => [lead, ...prev]);
    setOpenLeadId(lead.id);
  }

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

  const columns = React.useMemo(
    () =>
      getPipelineColumns({
        onUpdate: handleUpdate,
        onOpen: (lead) => setOpenLeadId(lead.id),
        onSelectRow: handleSelectRow,
        assignableUsers: assignableUsers,
        customFields,
        isAdmin,
        currentUser,
      }),
    [handleUpdate, handleSelectRow, assignableUsers, customFields, isAdmin, currentUser]
  );

  const table = useReactTable({
    data: leads,
    columns,
    state: { sorting, globalFilter, columnFilters, rowSelection, columnVisibility, columnOrder, columnSizing },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
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
      pagination: { pageSize: 50 },
    },
  });

  const selectedIds = Object.keys(rowSelection);
  const selectedCount = selectedIds.length;

  async function bulkAssign(user: string | null) {
    if (!user) return;
    const assignedAt = new Date().toISOString();
    await bulkPatchLeads(selectedIds, { assignedTo: user, assignedAt });
    // Assigned leads leave Pipeline immediately — they now belong to that
    // person's My Calls instead.
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
            placeholder="Search leads…"
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
          {table.getFilteredRowModel().rows.length} leads
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={handleAddLead}
          >
            <Plus className="size-4" />
            Add lead
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            nativeButton={false}
            render={
              <a href="/api/pipeline/template" download>
                <Download className="size-4" />
                Download sample
              </a>
            }
          />
          <Button size="sm" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" />
            Import
          </Button>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-accent/50 px-3 py-2">
          <Badge variant="secondary">{selectedCount} selected</Badge>
          {isAdmin && (
            <>
              <span className="text-sm text-muted-foreground">Assign to</span>
              <Select onValueChange={bulkAssign}>
                <SelectTrigger size="sm" className="w-44">
                  <SelectValue placeholder="Choose a person…" />
                </SelectTrigger>
                <SelectContent>
                  {assignableUsers.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setInvalidOpen(true)}
          >
            <Ban className="size-3.5" />
            Mark invalid
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
                  No leads yet. Import a spreadsheet to get started.
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

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={refresh}
        isAdmin={isAdmin}
      />

      <MarkInvalidDialog
        leadIds={selectedIds}
        open={invalidOpen}
        onOpenChange={setInvalidOpen}
        onMarked={(marked) => {
          const markedIds = new Set(marked.map((l) => l.id));
          setLeads((prev) => prev.filter((l) => !markedIds.has(l.id)));
          setRowSelection({});
        }}
      />
    </div>
  );
}
