import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PhoneCall, Database, History, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const actions = [
  {
    label: "My Calls",
    description: "Work through the leads assigned to you",
    cta: "Open",
    href: "/my-calls",
    icon: PhoneCall,
    tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  {
    label: "Pipeline",
    description: "Import leads or assign unclaimed ones",
    cta: "Open",
    href: "/pipeline",
    icon: Database,
    tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  {
    label: "Call Log",
    description: "See the full history of every call made",
    cta: "Open",
    href: "/call-log",
    icon: History,
    tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    label: "Reports",
    description: "Performance and conversion breakdowns",
    cta: "Open",
    href: "/reports",
    icon: BarChart3,
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
];

export function QuickActions() {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="px-1 text-sm font-medium text-muted-foreground">
        Quick actions
      </h2>
      {actions.map((a) => (
        <Card key={a.label} className="py-4">
          <CardContent className="flex flex-col gap-3 px-4">
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-lg",
                a.tone
              )}
            >
              <a.icon className="size-4" />
            </div>
            <div>
              <div className="text-sm font-medium">{a.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {a.description}
              </div>
            </div>
            <Button
              size="sm"
              className="w-fit rounded-full px-4"
              nativeButton={false}
              render={<a href={a.href}>{a.cta}</a>}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
