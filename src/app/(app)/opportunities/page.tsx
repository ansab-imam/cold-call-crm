import { getAllLeads } from "@/lib/pipeline/store";
import { belongsInOpportunities } from "@/lib/pipeline/queues";
import { getStatusSettings } from "@/lib/pipeline/status-settings-store";
import { getOpportunitySettings } from "@/lib/pipeline/opportunity-settings-store";
import { getAssignableUserNames } from "@/lib/auth/users-store";
import { OpportunitiesBoard } from "@/components/pipeline/opportunities-board";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const [leads, statusOptions, boardSettings, assignableUsers, session] = await Promise.all([
    getAllLeads().then((all) => all.filter(belongsInOpportunities)),
    getStatusSettings(),
    getOpportunitySettings(),
    getAssignableUserNames(),
    getCurrentUser(),
  ]);
  const isAdmin = session?.role === "admin";
  const currentUser = session?.name ?? "";

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="text-sm text-muted-foreground">
          Leads that logged &quot;{boardSettings.triggerOutcome}&quot; as their
          Call Outcome land here — drag a card between columns as it moves
          forward. Board columns are managed in Settings.
        </p>
      </div>
      <OpportunitiesBoard
        initialLeads={leads}
        boardSettings={boardSettings}
        statusOptions={statusOptions}
        assignableUsers={assignableUsers}
        isAdmin={isAdmin}
        currentUser={currentUser}
      />
    </div>
  );
}
