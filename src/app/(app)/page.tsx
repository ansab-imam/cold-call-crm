import { StatCard } from "@/components/stat-card";
import { QuickActions } from "@/components/quick-actions";
import { TodaysCalls } from "@/components/todays-calls";
import { RecentCalls } from "@/components/recent-opportunities";
import {
  PhoneCall,
  CalendarClock,
  History,
  TrendingUp,
  Target,
  AlertTriangle,
  Inbox,
  Ban,
  Users,
  Repeat,
} from "lucide-react";
import { getAllLeads } from "@/lib/pipeline/store";
import { getAllCallLogEntries } from "@/lib/pipeline/call-log-store";
import { computeDashboardStats } from "@/lib/pipeline/dashboard-stats";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [leads, entries, session] = await Promise.all([
    getAllLeads(),
    getAllCallLogEntries(),
    getCurrentUser(),
  ]);
  const currentUser = session?.name ?? "";
  const isAdmin = session?.role === "admin";
  const stats = computeDashboardStats(leads, entries, currentUser, isAdmin);
  const leadsById = new Map(leads.map((l) => [l.id, l]));

  // Everyone's own day — a rep and an admin who also works leads see the
  // exact same shape of numbers, just for their own name.
  const myStatCards = [
    {
      label: "Leads to call",
      value: stats.myQueueCount,
      hint: "Assigned to you, no outcome yet",
      icon: PhoneCall,
      tone: "default" as const,
    },
    {
      label: "Due today",
      value: stats.myFollowUpsDue,
      hint: "Your follow-ups, due or overdue",
      icon: CalendarClock,
      tone: "warning" as const,
    },
    {
      label: "Calls logged today",
      value: stats.myCallsToday,
      hint: "By you, today",
      icon: History,
      tone: "default" as const,
    },
    {
      label: "Opportunities",
      value: stats.myOpportunities,
      hint: "Your leads on the board",
      icon: Target,
      tone: "success" as const,
    },
    {
      label: "Resolved rate",
      value: `${stats.myResolvedRate}%`,
      hint: "Your assigned leads with an outcome",
      icon: TrendingUp,
      tone: "success" as const,
    },
    {
      label: "Going cold",
      value: stats.myStaleCount,
      hint: "Assigned 3+ days, still no outcome",
      icon: AlertTriangle,
      tone: stats.myStaleCount > 0 ? ("danger" as const) : ("default" as const),
    },
  ];

  const teamStatCards = stats.team
    ? [
        {
          label: "Unclaimed leads",
          value: stats.team.unclaimedCount,
          hint: "Sitting in Pipeline, nobody assigned",
          icon: Inbox,
          tone: stats.team.unclaimedCount > 0 ? ("warning" as const) : ("default" as const),
        },
        {
          label: "Team calls today",
          value: stats.team.callsToday,
          hint: "Logged by everyone, today",
          icon: Users,
          tone: "default" as const,
        },
        {
          label: "Reassigned this week",
          value: stats.team.reassignedThisWeek,
          hint: "Leads handed off to someone else",
          icon: Repeat,
          tone: "default" as const,
        },
        {
          label: "Invalid leads",
          value: stats.team.invalidCount,
          hint: "Marked bad data, not deleted",
          icon: Ban,
          tone: "default" as const,
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Good to see you, {currentUser.split(" ")[0] || "there"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what needs your attention today.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {myStatCards.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {stats.team && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Team overview
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {teamStatCards.map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TodaysCalls leads={stats.myCallsQueue} />
        </div>
        <div className="flex flex-col gap-4">
          <QuickActions />
          <RecentCalls entries={stats.recentCalls} leadsById={leadsById} />
        </div>
      </div>
    </div>
  );
}
