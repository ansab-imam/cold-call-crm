import { getAllLeads } from "@/lib/pipeline/store";
import { getAllCallLogEntries } from "@/lib/pipeline/call-log-store";
import { CallLogTable } from "@/components/pipeline/call-log-table";
import { getStatusSettings } from "@/lib/pipeline/status-settings-store";
import { getAssignableUserNames } from "@/lib/auth/users-store";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function CallLogPage() {
  const [entries, leads, statusOptions, assignableUsers, session] = await Promise.all([
    getAllCallLogEntries(),
    getAllLeads(),
    getStatusSettings(),
    getAssignableUserNames(),
    getCurrentUser(),
  ]);
  const isAdmin = session?.role === "admin";
  const currentUser = session?.name ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold tracking-tight">Call Log</h1>
        <p className="text-sm text-muted-foreground">
          A record of every call made against every lead. Entries aren&apos;t
          removed{isAdmin ? ", but an admin can correct one if it was logged wrong" : ""}.
        </p>
      </div>
      <CallLogTable
        initialEntries={entries}
        initialLeads={leads}
        statusOptions={statusOptions}
        assignableUsers={assignableUsers}
        isAdmin={isAdmin}
        currentUser={currentUser}
      />
    </div>
  );
}
