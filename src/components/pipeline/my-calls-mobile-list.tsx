"use client";

import * as React from "react";
import type { Lead } from "@/lib/pipeline/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Phone, Building2, PhoneCall } from "lucide-react";
import { belongsInMyCalls } from "@/lib/pipeline/queues";
import { daysSince, daysUntil } from "@/lib/pipeline/dates";
import { cn } from "@/lib/utils";
import { LeadDetailSheet } from "./lead-detail-sheet";
import { LogCallDialog } from "./log-call-dialog";
import { fetchLeads, patchLead } from "@/lib/pipeline/api-client";
import type { StatusSettings } from "@/lib/pipeline/status-settings-store";

function DueBadge({ assignedAt, nextActionDate }: { assignedAt: string | null; nextActionDate: string | null }) {
  let label: string;
  let tone: "today" | "late" | "upcoming" = "upcoming";

  if (nextActionDate) {
    const days = -daysUntil(nextActionDate);
    if (days < 0) {
      label = `Due in ${-days} ${-days === 1 ? "day" : "days"}`;
    } else if (days === 0) {
      label = "Due today";
      tone = "today";
    } else {
      label = `${days} ${days === 1 ? "day" : "days"} late`;
      tone = "late";
    }
  } else if (assignedAt) {
    const days = daysSince(assignedAt);
    if (days <= 0) {
      label = "Due today";
      tone = "today";
    } else {
      label = `${days} ${days === 1 ? "day" : "days"} late`;
      tone = days >= 3 ? "late" : "upcoming";
    }
  } else {
    return null;
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-normal",
        tone === "today" && "bg-sky-500/15 text-sky-600 dark:text-sky-400",
        tone === "late" && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
        tone === "upcoming" && "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      )}
    >
      {label}
    </Badge>
  );
}

function LeadTypeBadge({ callOutcome }: { callOutcome: string | null }) {
  return callOutcome ? (
    <Badge variant="secondary" className="bg-violet-500/15 font-normal text-violet-600 dark:text-violet-400">
      Callback
    </Badge>
  ) : (
    <Badge variant="secondary" className="bg-sky-500/15 font-normal text-sky-600 dark:text-sky-400">
      Fresh
    </Badge>
  );
}

function initials(name: string | null) {
  if (!name) return "—";
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function MyCallsMobileList({
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
  const [leads, setLeads] = React.useState(initialLeads);
  const [search, setSearch] = React.useState("");
  const [openLeadId, setOpenLeadId] = React.useState<string | null>(null);
  const [logCallFor, setLogCallFor] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const fresh = await fetchLeads();
    setLeads(fresh.filter((l) => belongsInMyCalls(l, currentUser)));
  }, [currentUser]);

  const handleUpdate = React.useCallback(
    async (id: string, patch: Partial<Lead>) => {
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      try {
        const saved = await patchLead(id, patch);
        setLeads((prev) => {
          if (!belongsInMyCalls(saved, currentUser)) return prev.filter((l) => l.id !== id);
          return prev.map((l) => (l.id === id ? saved : l));
        });
      } catch {
        refresh();
      }
    },
    [refresh, currentUser]
  );

  function handleCallsLogged(results: { lead: Lead }[]) {
    const updatedById = new Map(results.map((r) => [r.lead.id, r.lead]));
    setLeads((prev) =>
      prev
        .map((l) => updatedById.get(l.id) ?? l)
        .filter((l) => (updatedById.has(l.id) ? belongsInMyCalls(l, currentUser) : true))
    );
  }

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...leads].sort((a, b) =>
      (a.nextActionDate ?? a.assignedAt ?? "").localeCompare(b.nextActionDate ?? b.assignedAt ?? "")
    );
    if (!q) return sorted;
    return sorted.filter(
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
          placeholder="Search your calls…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>
      <span className="text-sm text-muted-foreground">{filtered.length} to call</span>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nothing assigned to you right now.
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {filtered.map((lead) => (
          <Card
            key={lead.id}
            className="cursor-pointer gap-2 p-3"
            onClick={() => setOpenLeadId(lead.id)}
          >
            <div className="flex items-start gap-3">
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
              {lead.primaryPhone && (
                <a
                  href={`tel:${lead.primaryPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                >
                  <Phone className="size-4" />
                </a>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <DueBadge assignedAt={lead.assignedAt} nextActionDate={lead.nextActionDate} />
              <LeadTypeBadge callOutcome={lead.callOutcome} />
              {lead.callStatus && (
                <Badge variant="secondary" className="font-normal">
                  {lead.callStatus}
                </Badge>
              )}
            </div>

            <Button
              size="sm"
              variant="outline"
              className="w-fit gap-1.5"
              onClick={(e) => {
                e.stopPropagation();
                setLogCallFor(lead.id);
              }}
            >
              <PhoneCall className="size-3.5" />
              Log a call
            </Button>
          </Card>
        ))}
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
        leadIds={logCallFor ? [logCallFor] : []}
        statusOptions={statusOptions}
        open={!!logCallFor}
        onOpenChange={(o) => !o && setLogCallFor(null)}
        onLogged={handleCallsLogged}
        initialAttemptNumber={
          (leads.find((l) => l.id === logCallFor)?.attemptCount ?? 0) + 1
        }
      />
    </div>
  );
}
