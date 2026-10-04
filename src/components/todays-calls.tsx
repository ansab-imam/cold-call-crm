import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PhoneCall } from "lucide-react";
import type { Lead } from "@/lib/pipeline/schema";
import { daysSince } from "@/lib/pipeline/dates";
import { cn } from "@/lib/utils";

function initials(name: string | null) {
  if (!name) return "—";
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function DueBadge({ assignedAt }: { assignedAt: string | null }) {
  if (!assignedAt) return <span className="text-xs text-muted-foreground">—</span>;
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
      {days}d late
    </Badge>
  );
}

export function TodaysCalls({ leads }: { leads: Lead[] }) {
  return (
    <Card className="py-4">
      <CardHeader className="flex flex-row items-center justify-between px-4">
        <CardTitle className="text-base">Your call queue</CardTitle>
        <span className="text-xs text-muted-foreground">{leads.length} assigned</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-2 sm:px-4">
        {leads.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Nothing assigned to you right now — go claim some leads in Pipeline.
          </p>
        )}
        {leads.map((l) => (
          <div
            key={l.id}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent"
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-secondary text-xs">
                {initials(l.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium">
                {l.fullName ?? "Unnamed lead"}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {l.companyName ?? "—"}
              </div>
            </div>
            <DueBadge assignedAt={l.assignedAt} />
            {l.primaryPhone && (
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                nativeButton={false}
                render={
                  <a href={`tel:${l.primaryPhone}`}>
                    <PhoneCall className="size-4" />
                  </a>
                }
              />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
