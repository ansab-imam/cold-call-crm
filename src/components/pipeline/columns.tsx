"use client";

import type { ColumnDef, Row, Table } from "@tanstack/react-table";
import type { Lead } from "@/lib/pipeline/schema";
import { STAGES, PRIORITIES, FIT_LABELS } from "@/lib/pipeline/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ChevronRight, Globe, Mail, Phone, Copy, Check } from "lucide-react";
import { cn, copyToClipboard } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/pipeline/dates";
import { AssignedToSelect } from "./assigned-to-select";
import * as React from "react";

// A small always-visible copy affordance next to phone/email/website —
// for whenever clicking to call/email/open isn't what you want, just
// grabbing the raw value is.
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      title="Copy"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const ok = await copyToClipboard(value);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }
      }}
      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function initials(name: string | null) {
  if (!name) return "—";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const STAGE_TONE: Record<(typeof STAGES)[number], string> = {
  New: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  Attempted: "bg-muted text-muted-foreground",
  Contacted: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  Qualifying: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "Not Interested": "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "Bad Data": "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

const PRIORITY_TONE: Record<(typeof PRIORITIES)[number], string> = {
  Urgent: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  High: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  Normal: "bg-muted text-muted-foreground",
  Low: "bg-muted text-muted-foreground",
};

const FIT_TONE: Record<(typeof FIT_LABELS)[number], string> = {
  High: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  Medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  Low: "bg-muted text-muted-foreground",
  Unscored: "bg-muted text-muted-foreground",
};

export type PipelineActions = {
  onUpdate: (id: string, patch: Partial<Lead>) => void;
  onOpen: (lead: Lead) => void;
  assignableUsers: string[];
  // Handles plain and shift-click range selection. `table` is passed through
  // from the cell's own render context (always current), rather than the
  // parent closing over a table instance that could go stale.
  onSelectRow: (row: Row<Lead>, shiftKey: boolean, table: Table<Lead>) => void;
  // Admin-defined (or created during import) extra columns — shown as real,
  // editable Pipeline columns, not just buried in a lead's Raw Data.
  customFields?: { key: string; label: string }[];
  // Only admins can hand out a lead's first assignment — everyone else can
  // only reassign a lead they already hold, and has to say why.
  isAdmin: boolean;
  currentUser: string;
};

export function customFieldColumnId(key: string): string {
  return `custom:${key}`;
}

export function getPipelineColumns(actions: PipelineActions): ColumnDef<Lead>[] {
  return [
    {
      id: "select",
      size: 36,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row, table }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onClick={(e) => {
            e.stopPropagation();
            actions.onSelectRow(row, e.shiftKey, table);
          }}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "rowNumber",
      header: "#",
      size: 44,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row, table }) => {
        const rows = table.getRowModel().rows;
        const idx = rows.findIndex((r) => r.id === row.id);
        const { pageIndex, pageSize } = table.getState().pagination;
        return (
          <span className="text-sm tabular-nums text-muted-foreground">
            {pageIndex * pageSize + idx + 1}
          </span>
        );
      },
    },
    {
      id: "lead",
      accessorFn: (l) => l.fullName ?? "",
      header: "Lead",
      size: 190,
      enableHiding: false,
      cell: ({ row }) => {
        const l = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="size-8">
              <AvatarFallback className="bg-secondary text-xs">
                {initials(l.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <div className="text-sm font-medium">
                {l.fullName ?? "Unnamed lead"}
              </div>
              <div className="text-xs text-muted-foreground">
                {l.jobTitle ?? "—"}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "companyName",
      header: "Company",
      size: 160,
      cell: ({ getValue }) => (
        <span className="text-sm">{(getValue() as string) ?? "—"}</span>
      ),
    },
    {
      accessorKey: "industry",
      header: "Industry",
      size: 170,
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">
          {(getValue() as string) ?? "—"}
        </span>
      ),
    },
    {
      id: "location",
      accessorFn: (l) => [l.city, l.stateRegion].filter(Boolean).join(", "),
      header: "Location",
      size: 160,
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">
          {(getValue() as string) || "—"}
        </span>
      ),
    },
    {
      accessorKey: "primaryPhone",
      header: "Phone",
      size: 130,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        if (!v) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <div className="-m-2 flex min-w-0 items-center gap-1 p-2">
            <a
              href={`tel:${v}`}
              onClick={(e) => e.stopPropagation()}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-sm hover:text-primary"
            >
              <Phone className="size-3.5 shrink-0" />
              {/* Truncates to whatever width the column is resized to,
                  instead of a fixed pixel cap — needs min-w-0 the whole way
                  up the flex chain or it just overflows instead. */}
              <span className="min-w-0 flex-1 truncate">{v}</span>
            </a>
            <CopyButton value={v} />
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: "Email",
      size: 130,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        if (!v) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <div className="-m-2 flex min-w-0 items-center gap-1 p-2">
            <a
              href={`mailto:${v}`}
              onClick={(e) => e.stopPropagation()}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-sm hover:text-primary"
            >
              <Mail className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{v}</span>
            </a>
            <CopyButton value={v} />
          </div>
        );
      },
    },
    {
      accessorKey: "stage",
      header: "Stage",
      size: 130,
      cell: ({ getValue }) => {
        const stage = getValue() as Lead["stage"];
        return (
          <Badge variant="secondary" className={cn("font-normal", STAGE_TONE[stage])}>
            {stage}
          </Badge>
        );
      },
    },
    {
      accessorKey: "callStatus",
      header: "Call Status",
      size: 140,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        if (!v) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <Badge variant="secondary" className="font-normal">
            {v}
          </Badge>
        );
      },
    },
    {
      accessorKey: "callOutcome",
      header: "Call Outcome",
      size: 150,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        if (!v) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <Badge variant="secondary" className="font-normal">
            {v}
          </Badge>
        );
      },
    },
    {
      accessorKey: "priority",
      header: "Priority",
      size: 110,
      cell: ({ getValue }) => {
        const value = (getValue() as string) ?? "Normal";
        return (
          <Badge
            variant="secondary"
            className={cn("font-normal", PRIORITY_TONE[value as keyof typeof PRIORITY_TONE])}
          >
            {value}
          </Badge>
        );
      },
    },
    {
      accessorKey: "assignedTo",
      header: "Assigned To",
      size: 165,
      cell: ({ row }) => {
        const l = row.original;
        return (
          <div className="flex flex-col gap-0.5">
            <AssignedToSelect
              value={l.assignedTo}
              assignableUsers={actions.assignableUsers}
              isAdmin={actions.isAdmin}
              stopPropagation
              triggerClassName="h-7 border-none px-2 shadow-none text-sm"
              onChange={(next, reason) =>
                actions.onUpdate(l.id, {
                  assignedTo: next,
                  assignedAt: next ? new Date().toISOString() : null,
                  ...(reason
                    ? {
                        reassignReason: reason,
                        reassignedBy: actions.currentUser,
                        reassignedAt: new Date().toISOString(),
                      }
                    : {}),
                })
              }
            />
            {l.assignedTo && l.assignedAt && (
              <span className="px-2 text-xs text-muted-foreground">
                Assigned {formatRelativeDate(l.assignedAt)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "nextActionDate",
      header: "Next Action",
      size: 150,
      cell: ({ row }) => {
        const l = row.original;
        return (
          <input
            type="date"
            value={l.nextActionDate ? l.nextActionDate.slice(0, 10) : ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) =>
              actions.onUpdate(l.id, {
                nextActionDate: e.target.value
                  ? new Date(e.target.value).toISOString()
                  : null,
              })
            }
            className="h-7 w-full rounded-md border-none bg-transparent px-1 text-sm outline-none focus:bg-accent"
          />
        );
      },
    },
    {
      accessorKey: "fitLabel",
      header: "Fit",
      size: 110,
      cell: ({ getValue }) => {
        const v = (getValue() as string) ?? "Unscored";
        return (
          <Badge variant="secondary" className={cn("font-normal", FIT_TONE[v as keyof typeof FIT_TONE])}>
            {v}
          </Badge>
        );
      },
    },
    {
      accessorKey: "attemptCount",
      header: "Attempts",
      size: 100,
      cell: ({ getValue }) => (
        <span className="text-sm tabular-nums">{getValue() as number}</span>
      ),
    },
    {
      accessorKey: "doNotCall",
      header: "Do Not Call",
      size: 110,
      cell: ({ row }) => {
        const l = row.original;
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={l.doNotCall}
              onCheckedChange={(v) => actions.onUpdate(l.id, { doNotCall: v })}
            />
          </div>
        );
      },
    },
    {
      accessorKey: "assignedAt",
      header: "Assigned On",
      size: 130,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return (
          <span className="text-sm text-muted-foreground">
            {v ? formatRelativeDate(v) : "—"}
          </span>
        );
      },
    },
    {
      id: "tags",
      accessorFn: (l) => l.tags.join(", "),
      header: "Tags",
      size: 180,
      cell: ({ row }) => {
        const tags = row.original.tags;
        if (tags.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((t) => (
              <Badge key={t} variant="outline" className="font-normal">
                {t}
              </Badge>
            ))}
            {tags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>
            )}
          </div>
        );
      },
    },
    // Less commonly needed columns — hidden by default, available via "Columns".
    { accessorKey: "subIndustry", header: "Sub-Industry", size: 150 },
    { accessorKey: "employeeCount", header: "Employees", size: 110 },
    { accessorKey: "employeeBand", header: "Employee Band", size: 130 },
    { accessorKey: "seniority", header: "Seniority", size: 150 },
    { accessorKey: "country", header: "Country", size: 130 },
    { accessorKey: "timezone", header: "Timezone", size: 130 },
    { accessorKey: "fitScore", header: "Fit Score", size: 100 },
    { accessorKey: "product", header: "Product", size: 130 },
    { accessorKey: "leadSource", header: "Lead Source", size: 130 },
    { accessorKey: "sourceFile", header: "Source File", size: 160 },
    { accessorKey: "phoneStatus", header: "Phone Status", size: 130 },
    { accessorKey: "emailStatus", header: "Email Status", size: 130 },
    {
      accessorKey: "websiteDomain",
      header: "Website Domain",
      size: 130,
      cell: ({ getValue, row }) => {
        const v = getValue() as string | null;
        if (!v) return <span className="text-sm text-muted-foreground">—</span>;
        // A stored websiteUrl without "http(s)://" (common from imports/manual
        // edits) is a *relative* href — the browser resolves it against the
        // current page instead of opening the actual site. Always force an
        // absolute URL.
        const raw = row.original.websiteUrl || v;
        const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        return (
          <div className="-m-2 flex min-w-0 items-center gap-1 p-2">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-sm hover:text-primary"
            >
              <Globe className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{v}</span>
            </a>
            <CopyButton value={v} />
          </div>
        );
      },
    },
    { accessorKey: "companyLinkedin", header: "Company LinkedIn", size: 180 },
    { accessorKey: "contactLinkedin", header: "Contact LinkedIn", size: 180 },
    { accessorKey: "googleMaps", header: "Google Maps", size: 160 },
    { accessorKey: "mobilePhone", header: "Mobile Phone", size: 150 },
    { accessorKey: "additionalPhone", header: "Additional Phone", size: 150 },
    { accessorKey: "createdAt", header: "Created At", size: 150 },
    { accessorKey: "leadCode", header: "Lead Code", size: 110 },
    ...(actions.customFields ?? []).map(
      (f): ColumnDef<Lead> => ({
        id: customFieldColumnId(f.key),
        header: f.label,
        size: 150,
        accessorFn: (lead) => lead.customFields?.[f.key] ?? null,
        cell: ({ getValue, row }) => {
          const v = getValue() as string | null;
          return (
            <input
              defaultValue={v ?? ""}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) =>
                actions.onUpdate(row.original.id, {
                  customFields: { ...row.original.customFields, [f.key]: e.target.value || null },
                })
              }
              className="h-7 w-full rounded-md border-none bg-transparent px-1 text-sm outline-none focus:bg-accent"
            />
          );
        },
      })
    ),
    {
      id: "open",
      size: 44,
      enableHiding: false,
      header: "",
      cell: ({ row }) => (
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={(e) => {
            e.stopPropagation();
            actions.onOpen(row.original);
          }}
        >
          <ChevronRight className="size-4" />
        </Button>
      ),
    },
  ];
}

export const DEFAULT_VISIBLE_COLUMNS = [
  "select",
  "rowNumber",
  "lead",
  "companyName",
  "primaryPhone",
  "email",
  "assignedTo",
  "open",
];

// All column ids, in the same order getPipelineColumns emits them — used to
// build a complete visibility map (defaults not listed above start hidden).
export const ALL_COLUMN_IDS = [
  "select",
  "rowNumber",
  "lead",
  "companyName",
  "industry",
  "location",
  "primaryPhone",
  "email",
  "stage",
  "callStatus",
  "callOutcome",
  "priority",
  "assignedTo",
  "assignedAt",
  "nextActionDate",
  "fitLabel",
  "attemptCount",
  "doNotCall",
  "tags",
  "subIndustry",
  "employeeCount",
  "employeeBand",
  "seniority",
  "country",
  "timezone",
  "fitScore",
  "product",
  "leadSource",
  "sourceFile",
  "phoneStatus",
  "emailStatus",
  "websiteDomain",
  "companyLinkedin",
  "contactLinkedin",
  "googleMaps",
  "mobilePhone",
  "additionalPhone",
  "createdAt",
  "leadCode",
  "open",
];

// Custom fields sit right before "open" (matching the order
// getPipelineColumns actually emits them in) — used anywhere a full column
// id list is needed (visibility defaults, drag-to-reorder defaults).
export function allColumnIdsWithCustomFields(
  customFields: { key: string }[],
  base: string[] = ALL_COLUMN_IDS
): string[] {
  const withoutOpen = base.filter((id) => id !== "open");
  return [...withoutOpen, ...customFields.map((f) => customFieldColumnId(f.key)), "open"];
}
