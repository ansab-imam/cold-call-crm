import { getAllUsers } from "@/lib/auth/users-store";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UsersView } from "@/components/users-view";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [users, session] = await Promise.all([getAllUsers(), getCurrentUser()]);

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Create logins for your team. Reps can see Dashboard, My Calls, Call
          Log, Opportunities, and Reports — only admins see Pipeline, Users,
          and Settings.
        </p>
      </div>
      <UsersView initialUsers={users} currentUserId={session?.userId ?? ""} />
    </div>
  );
}
