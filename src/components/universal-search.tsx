"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchLeads } from "@/lib/pipeline/api-client";
import type { Lead } from "@/lib/pipeline/schema";
import {
  belongsInPipeline,
  belongsInMyCalls,
  belongsInOpportunities,
  belongsInInvalidLeads,
} from "@/lib/pipeline/queues";

const SEARCH_FIELDS: (keyof Lead)[] = [
  "companyName",
  "fullName",
  "firstName",
  "lastName",
  "jobTitle",
  "email",
  "primaryPhone",
  "mobilePhone",
  "additionalPhone",
  "websiteUrl",
  "websiteDomain",
  "industry",
  "subIndustry",
  "city",
  "stateRegion",
  "country",
  "researchNotes",
  "callNotes",
  "leadSource",
  "leadCode",
  "assignedTo",
];

function leadModule(
  lead: Lead,
  currentUser: string
): { label: string; href: string } {
  if (belongsInInvalidLeads(lead)) return { label: "Invalid Leads", href: "/invalid-leads" };
  if (belongsInOpportunities(lead)) return { label: "Opportunities", href: "/opportunities" };
  if (belongsInMyCalls(lead, currentUser)) return { label: "My Calls", href: "/my-calls" };
  if (belongsInPipeline(lead)) return { label: "Pipeline", href: "/pipeline" };
  return { label: "Call Log", href: "/call-log" };
}

function matches(lead: Lead, query: string): boolean {
  for (const field of SEARCH_FIELDS) {
    const v = lead[field];
    if (typeof v === "string" && v.toLowerCase().includes(query)) return true;
  }
  if (lead.customFields) {
    for (const v of Object.values(lead.customFields)) {
      if (v && v.toLowerCase().includes(query)) return true;
    }
  }
  return false;
}

export function UniversalSearch({ currentUser }: { currentUser: string }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [leads, setLeads] = React.useState<Lead[] | null>(null);
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Refetch every time the search opens, not just once ever — this bar
  // stays mounted for the whole session (it's in the shared header), so a
  // one-time fetch would go stale as soon as anyone logs a call, reassigns
  // a lead, or moves one through the pipeline. A stale result still shows
  // up in the list, but clicking it sends you to a module the lead no
  // longer actually belongs to, where it silently fails to open.
  React.useEffect(() => {
    if (!open) return;
    fetchLeads().then(setLeads).catch(() => setLeads((prev) => prev ?? []));
  }, [open]);

  // Ctrl+K / Cmd+K jumps into the search box from anywhere in the app.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const q = query.trim().toLowerCase();
  const results = React.useMemo(() => {
    if (!q || !leads) return [];
    return leads.filter((l) => matches(l, q)).slice(0, 20);
  }, [q, leads]);

  function goTo(lead: Lead) {
    const { href } = leadModule(lead, currentUser);
    setOpen(false);
    setQuery("");
    router.push(`${href}?lead=${lead.id}`);
  }

  return (
    <Popover
      open={open && q.length > 0}
      onOpenChange={setOpen}
    >
      <PopoverTrigger
        nativeButton={false}
        render={
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search all leads…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              className="pl-8 pr-14"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setOpen(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                Ctrl K
              </kbd>
            )}
          </div>
        }
      />
      <PopoverContent
        align="start"
        sideOffset={6}
        initialFocus={inputRef}
        finalFocus={inputRef}
        className="w-[34rem] max-w-[92vw] overflow-hidden p-0"
      >
        {results.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">
            No leads match &quot;{query}&quot;.
          </div>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto overflow-x-hidden py-1">
            {results.map((lead) => {
              const mod = leadModule(lead, currentUser);
              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => goTo(lead)}
                  className="flex w-full min-w-0 flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-muted"
                >
                  <div className="flex w-full min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">
                      {lead.companyName || lead.fullName || "Untitled lead"}
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {mod.label}
                    </span>
                  </div>
                  <span className="min-w-0 w-full truncate text-xs text-muted-foreground">
                    {[lead.fullName, lead.email, lead.primaryPhone]
                      .filter(Boolean)
                      .join(" · ") || "No additional details"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
