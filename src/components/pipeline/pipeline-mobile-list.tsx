"use client";

import * as React from "react";
import type { Lead } from "@/lib/pipeline/schema";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Building2 } from "lucide-react";
import { LeadDetailSheet } from "./lead-detail-sheet";
import { AssignedToSelect } from "./assigned-to-select";
import { patchLead } from "@/lib/pipeline/api-client";
import type { StatusSettings } from "@/lib/pipeline/status-settings-store";

function initials(name: string | null) {
  if (!name) return "—";
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function PipelineMobileList({
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
  const [leads, setLeads] = React.useState(initialLeads);
  const [search, setSearch] = React.useState("");
  const [openLeadId, setOpenLeadId] = React.useState<string | null>(null);

  const handleUpdate = React.useCallback(async (id: string, patch: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const saved = await patchLead(id, patch);
    // Assigning a lead sends it to My Calls — it leaves Pipeline immediately.
    setLeads((prev) => (saved.assignedTo ? prev.filter((l) => l.id !== id) : prev.map((l) => (l.id === id ? saved : l))));
  }, []);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.fullName?.toLowerCase().includes(q) ||
        l.companyName?.toLowerCase().includes(q) ||
        l.primaryPhone?.includes(q)
    );
  }, [leads, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search leads…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>
      <span className="text-sm text-muted-foreground">{filtered.length} leads</span>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nothing here — import a spreadsheet from a desktop to get started.
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {filtered.map((lead) => (
          <Card key={lead.id} className="gap-2 p-3">
            <div className="flex items-start gap-3" onClick={() => setOpenLeadId(lead.id)}>
              <Avatar className="size-9 shrink-0">
                <AvatarFallback className="bg-secondary text-xs">
                  {initials(lead.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium leading-tight">
                  {lead.fullName ?? "Unnamed lead"}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="size-3 shrink-0" />
                  <span className="truncate">{lead.companyName ?? "—"}</span>
                </div>
              </div>
              {lead.industry && (
                <Badge variant="secondary" className="shrink-0 font-normal">
                  {lead.industry}
                </Badge>
              )}
            </div>

            <div onClick={(e) => e.stopPropagation()}>
              <AssignedToSelect
                value={lead.assignedTo}
                assignableUsers={assignableUsers}
                isAdmin={isAdmin}
                onChange={(next, reason) =>
                  handleUpdate(lead.id, {
                    assignedTo: next,
                    assignedAt: next ? new Date().toISOString() : null,
                    ...(reason
                      ? { reassignReason: reason, reassignedBy: currentUser, reassignedAt: new Date().toISOString() }
                      : {}),
                  })
                }
              />
            </div>
          </Card>
        ))}
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
