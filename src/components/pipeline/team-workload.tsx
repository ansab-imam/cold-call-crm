"use client";

import * as React from "react";
import type { Lead } from "@/lib/pipeline/schema";
import { belongsInMyCalls } from "@/lib/pipeline/queues";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

// Always computed from the live, unfiltered lead set — a rep's current book
// of business isn't something a date-range filter should be able to hide.
// "Calls in range" is the one column that does respect the report filters,
// so it lines up with everything else on the page.
export function TeamWorkload({
  leads,
  reps,
  callsByUser,
}: {
  leads: Lead[];
  reps: string[];
  callsByUser: Record<string, number>;
}) {
  const rows = React.useMemo(() => {
    return reps
      .map((rep) => {
        const assigned = leads.filter((l) => l.assignedTo === rep && !l.isInvalid);
        const pending = assigned.filter((l) => belongsInMyCalls(l, rep));
        const resolvedCount = assigned.length - pending.length;
        return {
          rep,
          assignedCount: assigned.length,
          pendingCount: pending.length,
          resolvedCount,
          resolvedRate:
            assigned.length > 0 ? Math.round((resolvedCount / assigned.length) * 100) : 0,
          callsInRange: callsByUser[rep] ?? 0,
        };
      })
      .sort((a, b) => b.assignedCount - a.assignedCount);
  }, [leads, reps, callsByUser]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4" />
          Team Workload
        </CardTitle>
        <CardDescription>
          Each rep&apos;s current book — how many leads they hold, how many
          still need a call, and how many they&apos;ve resolved. &quot;Calls
          in range&quot; respects the filters above; everything else is
          right now.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Rep</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Resolved</TableHead>
                <TableHead>Resolved Rate</TableHead>
                <TableHead>Calls in range</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                    No reps yet — add one in Users.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.rep}>
                  <TableCell className="text-sm font-medium">{r.rep}</TableCell>
                  <TableCell className="text-sm">{r.assignedCount}</TableCell>
                  <TableCell className="text-sm">
                    {r.pendingCount > 0 ? (
                      <Badge variant="secondary" className="bg-amber-500/15 font-normal text-amber-600 dark:text-amber-400">
                        {r.pendingCount} pending
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <Badge variant="secondary" className="bg-emerald-500/15 font-normal text-emerald-600 dark:text-emerald-400">
                      {r.resolvedCount} resolved
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.resolvedRate}%</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.callsInRange}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
