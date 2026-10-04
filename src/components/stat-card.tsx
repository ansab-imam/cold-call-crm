import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "success" | "danger";
}) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 px-4">
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-xl",
            tone === "warning" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
            tone === "success" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
            tone === "danger" && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
            tone === "default" && "bg-primary/15 text-primary"
          )}
        >
          <Icon className="size-4" />
        </div>
        <button
          type="button"
          className="text-muted-foreground/50 transition-colors hover:text-muted-foreground"
          aria-label="More options"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </CardHeader>
      <CardContent className="px-4">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </div>
        <div className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
