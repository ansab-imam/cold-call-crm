import { getAllLeads } from "@/lib/pipeline/store";
import { PipelineResponsive } from "@/components/pipeline/pipeline-responsive";
import { belongsInPipeline } from "@/lib/pipeline/queues";
import { getStatusSettings } from "@/lib/pipeline/status-settings-store";
import { getAssignableUserNames } from "@/lib/auth/users-store";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [leads, statusOptions, assignableUsers, session] = await Promise.all([
    getAllLeads().then((all) => all.filter(belongsInPipeline)),
    getStatusSettings(),
    getAssignableUserNames(),
    getCurrentUser(),
  ]);
  const isAdmin = session?.role === "admin";
  const currentUser = session?.name ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Every lead not yet claimed lives here. Import a spreadsheet, then
          assign leads to send them to that person&apos;s My Calls — once
          assigned, a lead leaves this list.
        </p>
      </div>
      <PipelineResponsive
        initialLeads={leads}
        statusOptions={statusOptions}
        assignableUsers={assignableUsers}
        isAdmin={isAdmin}
        currentUser={currentUser}
      />
    </div>
  );
}
