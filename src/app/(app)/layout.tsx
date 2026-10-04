import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();
  // Middleware already gates this, but a direct hit while cookies are stale
  // should still bounce cleanly rather than render a broken shell.
  if (!session) redirect("/login");

  return (
    <AppShell
      role={session.role}
      name={session.name}
      roleLabel={session.superAdmin ? "Super admin" : session.role === "admin" ? "Admin" : "Rep"}
    >
      {children}
    </AppShell>
  );
}
