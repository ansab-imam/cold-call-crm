import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CallLogEntry } from "@/lib/pipeline/call-log-schema";
import type { Lead } from "@/lib/pipeline/schema";
import { ArrowUpRight } from "lucide-react";

function initials(name: string | null) {
  if (!name) return "—";
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function RecentCalls({
  entries,
  leadsById,
}: {
  entries: CallLogEntry[];
  leadsById: Map<string, Lead>;
}) {
  return (
    <Card className="py-4">
      <CardHeader className="flex flex-row items-center justify-between px-4">
        <CardTitle className="text-base">Recently logged calls</CardTitle>
        <a href="/call-log" className="text-muted-foreground hover:text-foreground">
          <ArrowUpRight className="size-4" />
        </a>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-4">
        {entries.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No calls logged yet.
          </p>
        )}
        {entries.map((e) => {
          const lead = leadsById.get(e.leadId);
          return (
            <div
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-medium">
                  {initials(lead?.fullName ?? null)}
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-medium">
                    {lead?.fullName ?? "Unnamed lead"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {lead?.companyName ?? "—"}
                  </div>
                </div>
              </div>
              {e.callOutcome ? (
                <Badge variant="secondary" className="shrink-0 bg-primary/10 font-normal text-primary">
                  {e.callOutcome}
                </Badge>
              ) : e.callStatus ? (
                <Badge variant="secondary" className="shrink-0 font-normal">
                  {e.callStatus}
                </Badge>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
