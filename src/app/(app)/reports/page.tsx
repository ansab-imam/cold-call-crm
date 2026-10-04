import { getAllLeads } from "@/lib/pipeline/store";
import { getAllCallLogEntries } from "@/lib/pipeline/call-log-store";
import { getAllUsers } from "@/lib/auth/users-store";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getOpportunitySettings } from "@/lib/pipeline/opportunity-settings-store";
import { ReportsView } from "@/components/pipeline/reports-view";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [entries, leads, users, session, opportunitySettings] = await Promise.all([
    getAllCallLogEntries(),
    getAllLeads(),
    getAllUsers(),
    getCurrentUser(),
    getOpportunitySettings(),
  ]);
  const isAdmin = session?.role === "admin";
  // Everyone on the team, not just reps — an admin who also works leads
  // (like James) should see their own workload here too.
  const teamMembers = users.map((u) => u.name);

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Call activity and conversion, filterable by date, user, status,
          outcome, industry, and lead source.
        </p>
      </div>
      <ReportsView
        entries={entries}
        leads={leads}
        reps={teamMembers}
        isAdmin={isAdmin}
        defaultTrackOutcome={opportunitySettings.triggerOutcome}
      />
    </div>
  );
}
