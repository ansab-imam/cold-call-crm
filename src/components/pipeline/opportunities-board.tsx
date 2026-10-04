"use client";

import * as React from "react";
import type { Lead } from "@/lib/pipeline/schema";
import type { StatusSettings } from "@/lib/pipeline/status-settings-store";
import type { OpportunitySettings } from "@/lib/pipeline/opportunity-settings-store";
import { patchLead } from "@/lib/pipeline/api-client";
import { LeadDetailSheet } from "./lead-detail-sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Phone } from "lucide-react";
import { useOpenLeadFromQuery } from "@/hooks/use-open-lead-from-query";
import { cn } from "@/lib/utils";

function OpportunityCard({
  lead,
  onOpen,
  onDragStart,
  dragging,
  columns,
  onMoveStage,
}: {
  lead: Lead;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  dragging: boolean;
  columns: { id: string; name: string }[];
  onMoveStage: (columnId: string) => void;
}) {
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className={cn(
        "cursor-pointer gap-2 p-3 transition-opacity hover:ring-1 hover:ring-ring/40",
        dragging && "opacity-40"
      )}
    >
      <div className="text-sm font-medium leading-tight">
        {lead.fullName || "Unnamed lead"}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="size-3" />
        <span className="truncate">{lead.companyName || "—"}</span>
      </div>
      {lead.primaryPhone && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="size-3" />
          {lead.primaryPhoneRaw ?? lead.primaryPhone}
        </div>
      )}
      {lead.assignedTo && (
        <Badge variant="secondary" className="mt-1 w-fit font-normal">
          {lead.assignedTo}
        </Badge>
      )}
      {/* Dragging between columns needs a mouse — this is the touch-friendly
          equivalent, shown only below the desktop breakpoint. */}
      <select
        value={lead.opportunityStage ?? ""}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onMoveStage(e.target.value)}
        className="mt-1 h-8 rounded-md border border-input bg-transparent px-2 text-xs md:hidden"
      >
        {columns.map((col) => (
          <option key={col.id} value={col.id}>
            Move to: {col.name}
          </option>
        ))}
      </select>
    </Card>
  );
}

export function OpportunitiesBoard({
  initialLeads,
  boardSettings,
  statusOptions,
  assignableUsers,
  isAdmin,
  currentUser,
}: {
  initialLeads: Lead[];
  boardSettings: OpportunitySettings;
  statusOptions: StatusSettings;
  assignableUsers: string[];
  isAdmin: boolean;
  currentUser: string;
}) {
  const [leads, setLeads] = React.useState(initialLeads);
  const [openLeadId, setOpenLeadId] = React.useState<string | null>(null);
  useOpenLeadFromQuery(leads, setOpenLeadId);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = React.useState<string | null>(null);

  const byColumn = React.useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const col of boardSettings.columns) map.set(col.id, []);
    for (const lead of leads) {
      if (lead.opportunityStage) map.get(lead.opportunityStage)?.push(lead);
    }
    return map;
  }, [leads, boardSettings.columns]);

  async function moveLead(id: string, columnId: string) {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, opportunityStage: columnId } : l))
    );
    try {
      await patchLead(id, { opportunityStage: columnId });
    } catch {
      // Reload from server state on failure rather than leaving a lie on screen.
    }
  }

  function handleUpdate(id: string, patch: Partial<Lead>) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  const openLead = leads.find((l) => l.id === openLeadId) ?? null;

  return (
    <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-3 pb-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {boardSettings.columns.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No board columns yet — add some in Settings.
        </p>
      )}
      {boardSettings.columns.map((col) => {
        const items = byColumn.get(col.id) ?? [];
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverColumn(col.id);
            }}
            onDragLeave={() => setDragOverColumn((c) => (c === col.id ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverColumn(null);
              const id = e.dataTransfer.getData("text/plain");
              if (id) moveLead(id, col.id);
              setDraggingId(null);
            }}
            className={cn(
              "flex min-w-0 flex-col gap-2 rounded-lg border bg-accent/20 p-2",
              dragOverColumn === col.id && "ring-2 ring-primary/50"
            )}
          >
            <div className="flex items-center justify-between gap-2 px-1 py-1">
              <span className="truncate text-sm font-semibold" title={col.name}>
                {col.name}
              </span>
              <Badge variant="secondary" className="font-normal">
                {items.length}
              </Badge>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto">
              {items.length === 0 && (
                <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                  Drop a lead here
                </p>
              )}
              {items.map((lead) => (
                <OpportunityCard
                  key={lead.id}
                  lead={lead}
                  dragging={draggingId === lead.id}
                  onOpen={() => setOpenLeadId(lead.id)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", lead.id);
                    setDraggingId(lead.id);
                  }}
                  columns={boardSettings.columns}
                  onMoveStage={(columnId) => moveLead(lead.id, columnId)}
                />
              ))}
            </div>
          </div>
        );
      })}

      <LeadDetailSheet
        lead={openLead}
        onOpenChange={(open) => !open && setOpenLeadId(null)}
        onUpdate={handleUpdate}
        onDeleted={(id) => {
          setLeads((prev) => prev.filter((l) => l.id !== id));
          setOpenLeadId(null);
        }}
        assignableUsers={assignableUsers}
        statusOptions={statusOptions}
        isAdmin={isAdmin}
        currentUser={currentUser}
      />
    </div>
  );
}
