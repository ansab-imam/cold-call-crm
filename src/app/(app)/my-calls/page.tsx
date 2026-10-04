import { getAllLeads } from "@/lib/pipeline/store";
import { MyCallsResponsive } from "@/components/pipeline/my-calls-responsive";
import { belongsInMyCalls } from "@/lib/pipeline/queues";
import { getStatusSettings } from "@/lib/pipeline/status-settings-store";
import { getAssignableUserNames } from "@/lib/auth/users-store";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function MyCallsPage() {
  const [leads, statusOptions, assignableUsers, session] = await Promise.all([
    getAllLeads(),
    getStatusSettings(),
    getAssignableUserNames(),
    getCurrentUser(),
  ]);
  const currentUser = session?.name ?? "";
  const isAdmin = session?.role === "admin";
  const myCalls = leads.filter((l) => belongsInMyCalls(l, currentUser));

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold tracking-tight">My Calls</h1>
        <p className="text-sm text-muted-foreground">
          Leads assigned to you that still need a call. Assign leads from
          Pipeline to send them here.
        </p>
      </div>
      <MyCallsResponsive
        initialLeads={myCalls}
        statusOptions={statusOptions}
        assignableUsers={assignableUsers}
        currentUser={currentUser}
        isAdmin={isAdmin}
      />
    </div>
  );
}
