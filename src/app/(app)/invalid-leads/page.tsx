import { getAllLeads } from "@/lib/pipeline/store";
import { belongsInInvalidLeads } from "@/lib/pipeline/queues";
import { getStatusSettings } from "@/lib/pipeline/status-settings-store";
import { getAssignableUserNames } from "@/lib/auth/users-store";
import { InvalidLeadsTable } from "@/components/pipeline/invalid-leads-table";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function InvalidLeadsPage() {
  const [leads, statusOptions, assignableUsers, session] = await Promise.all([
    getAllLeads().then((all) => all.filter(belongsInInvalidLeads)),
    getStatusSettings(),
    getAssignableUserNames(),
    getCurrentUser(),
  ]);
  const isAdmin = session?.role === "admin";
  const currentUser = session?.name ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold tracking-tight">Invalid Leads</h1>
        <p className="text-sm text-muted-foreground">
          Marked invalid instead of deleted — bad data, wrong fit, whatever
          the reason. Nothing here is lost; restore a lead any time to send
          it back where it came from.
        </p>
      </div>
      <InvalidLeadsTable
        initialLeads={leads}
        statusOptions={statusOptions}
        assignableUsers={assignableUsers}
        isAdmin={isAdmin}
        currentUser={currentUser}
      />
    </div>
  );
}
