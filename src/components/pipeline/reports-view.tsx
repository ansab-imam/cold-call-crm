"use client";

import * as React from "react";
import type { Lead } from "@/lib/pipeline/schema";
import type { CallLogEntry } from "@/lib/pipeline/call-log-schema";
import {
  EMPTY_FILTERS,
  computeReportAggregates,
  distinctFilterOptions,
  filterEntries,
  type ReportFilters,
} from "@/lib/pipeline/reports";
import { StatCard } from "@/components/stat-card";
import { BarList } from "./bar-list";
import { CallsTrendChart } from "./calls-trend-chart";
import { TeamWorkload } from "./team-workload";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhoneCall, Target, Users, Building2, X } from "lucide-react";

const ALL = "__all";

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
        <SelectTrigger size="sm" className="w-40">
          <SelectValue>{(v: unknown) => (v === ALL ? "All" : String(v))}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ReportsView({
  entries,
  leads,
  reps,
  isAdmin,
  defaultTrackOutcome,
}: {
  entries: CallLogEntry[];
  leads: Lead[];
  reps: string[];
  isAdmin: boolean;
  // The outcome that promotes a lead to Opportunities (set in Settings) —
  // starting point for the trend line, but changeable to track any outcome.
  defaultTrackOutcome: string | null;
}) {
  const [filters, setFilters] = React.useState<ReportFilters>(EMPTY_FILTERS);
  const [trackOutcome, setTrackOutcome] = React.useState<string | null>(defaultTrackOutcome);

  const leadsById = React.useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const options = React.useMemo(
    () => distinctFilterOptions(entries, leadsById),
    [entries, leadsById]
  );

  const filtered = React.useMemo(
    () => filterEntries(entries, leadsById, filters),
    [entries, leadsById, filters]
  );
  const agg = React.useMemo(
    () => computeReportAggregates(filtered, leadsById, trackOutcome),
    [filtered, leadsById, trackOutcome]
  );

  const callsByUser = React.useMemo(
    () => Object.fromEntries(agg.byUser.map((u) => [u.name, u.count])),
    [agg.byUser]
  );

  const hasActiveFilters = Object.values(filters).some((v) => v !== null);
  // Deliberately generic — Call Status/Outcome options are admin-defined
  // free text (Settings), so these stats never assume which specific option
  // means "good" or "bad"; they only count whether a result was recorded.
  const withOutcomeCount = filtered.filter((e) => e.callOutcome).length;
  const outcomeRate =
    filtered.length > 0 ? Math.round((withOutcomeCount / filtered.length) * 100) : 0;
  const uniqueLeadsReached = new Set(filtered.map((e) => e.leadId)).size;
  const avgAttempts =
    uniqueLeadsReached > 0 ? (filtered.length / uniqueLeadsReached).toFixed(1) : "0";

  function update<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-accent/30 p-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">From</Label>
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(e) => update("from", e.target.value || null)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">To</Label>
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(e) => update("to", e.target.value || null)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
        <FilterSelect
          label="Logged By"
          value={filters.loggedBy}
          options={options.loggedBy}
          onChange={(v) => update("loggedBy", v)}
        />
        <FilterSelect
          label="Call Status"
          value={filters.callStatus}
          options={options.callStatus}
          onChange={(v) => update("callStatus", v)}
        />
        <FilterSelect
          label="Call Outcome"
          value={filters.callOutcome}
          options={options.callOutcome}
          onChange={(v) => update("callOutcome", v)}
        />
        <FilterSelect
          label="Industry"
          value={filters.industry}
          options={options.industry}
          onChange={(v) => update("industry", v)}
        />
        <FilterSelect
          label="Lead Source"
          value={filters.leadSource}
          options={options.leadSource}
          onChange={(v) => update("leadSource", v)}
        />
        {hasActiveFilters && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            <X className="size-3.5" />
            Clear filters
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Calls in range" value={agg.total} icon={PhoneCall} />
        <StatCard
          label="Leads reached"
          value={uniqueLeadsReached}
          hint="Unique leads called"
          icon={Users}
          tone="default"
        />
        <StatCard
          label="Outcome logged"
          value={`${outcomeRate}%`}
          hint="Of calls with a result recorded"
          icon={Target}
          tone="success"
        />
        <StatCard
          label="Avg. attempts / lead"
          value={avgAttempts}
          icon={Building2}
          tone="warning"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-accent/30 p-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Track outcome on the graph</Label>
          <Select
            value={trackOutcome ?? ALL}
            onValueChange={(v) => setTrackOutcome(v === ALL ? null : v)}
          >
            <SelectTrigger size="sm" className="w-48">
              <SelectValue>{(v: unknown) => (v === ALL ? "None" : String(v))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>None</SelectItem>
              {options.callOutcome.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="pb-1.5 text-xs text-muted-foreground">
          Adds a second line to the chart below — how many calls landed on
          this outcome each day, so it&apos;s clear whether more calls is
          actually producing more of it.
        </p>
      </div>

      <CallsTrendChart data={agg.last30} trackedLabel={trackOutcome} />

      {isAdmin && (
        <TeamWorkload leads={leads} reps={reps} callsByUser={callsByUser} />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarList title="Calls by Status" items={agg.byStatus} />
        <BarList title="Calls by Outcome" items={agg.byOutcome} />
        <BarList title="By User" items={agg.byUser} emptyLabel="No calls logged in range" />
        <BarList title="By Industry" items={agg.byIndustry} />
        <BarList title="By Lead Source" items={agg.bySource} />
        {trackOutcome && (
          <>
            <BarList
              title={`${trackOutcome} by Industry`}
              items={agg.trackedByIndustry}
              emptyLabel={`No "${trackOutcome}" calls in range`}
            />
            <BarList
              title={`${trackOutcome} by Lead Source`}
              items={agg.trackedBySource}
              emptyLabel={`No "${trackOutcome}" calls in range`}
            />
          </>
        )}
      </div>
    </div>
  );
}
