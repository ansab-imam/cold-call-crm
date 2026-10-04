import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./session";
import { getUserById } from "./users-store";

export type CurrentUser = SessionPayload & { superAdmin: boolean };

// The cookie proves who signed in; name and role are then read fresh from
// the users store, so renames, promotions/demotions and removals take effect
// on the next page load instead of lingering until the cookie expires.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user) return null;
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    superAdmin: user.role === "admin" && !!user.superAdmin,
  };
}
