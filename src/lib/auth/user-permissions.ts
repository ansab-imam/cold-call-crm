import "server-only";
import { getCurrentUser } from "./current-user";
import { getUserById, accessLevel, type UserRecord, type AccessLevel } from "./users-store";

// Who may manage whom on the Users page:
//   - super admins: everyone, including other admins and super admins
//   - admins: reps only (plus their own name / email / password)
//   - reps: nobody
// The acting user is re-read from the database rather than trusted from the
// session cookie, so a demotion takes effect here immediately.
export async function getActingAdmin(): Promise<UserRecord | null> {
  const session = await getCurrentUser();
  if (!session) return null;
  const actor = await getUserById(session.userId);
  return actor && actor.role === "admin" ? actor : null;
}

export function isSuperAdmin(u: Pick<UserRecord, "role" | "superAdmin">): boolean {
  return accessLevel(u) === "superadmin";
}

// Can `actor` edit or remove `target` at all?
export function canManageUser(actor: UserRecord, target: UserRecord): boolean {
  if (isSuperAdmin(actor)) return true;
  return accessLevel(target) === "rep";
}

// Can `actor` give someone this access level (on create or change)?
export function canGrantLevel(actor: UserRecord, level: AccessLevel): boolean {
  return isSuperAdmin(actor) || level === "rep";
}
