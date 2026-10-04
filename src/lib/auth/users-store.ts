import "server-only";
import { nanoid } from "nanoid";
import { hashPassword, verifyPassword } from "./password";
import { readStore, withStore, withStores } from "@/lib/db";

export type Role = "admin" | "rep";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
  // Super admins are admins who also manage other admins. Only they can
  // create, promote, demote, edit or remove admin accounts, and there is
  // always at least one.
  superAdmin?: boolean;
};

export type PublicUser = Omit<UserRecord, "passwordHash">;

// The three levels shown in Users: rep < admin < super admin.
export type AccessLevel = "rep" | "admin" | "superadmin";

export function accessLevel(u: Pick<UserRecord, "role" | "superAdmin">): AccessLevel {
  if (u.role !== "admin") return "rep";
  return u.superAdmin ? "superadmin" : "admin";
}

export function fromAccessLevel(level: AccessLevel): { role: Role; superAdmin: boolean } {
  return { role: level === "rep" ? "rep" : "admin", superAdmin: level === "superadmin" };
}

const USERS_KEY = "users";

// Sites that predate super admins have none yet: the original admin (the
// INITIAL_ADMIN_EMAIL account, else the earliest admin) becomes one.
function withSuperAdmin(users: UserRecord[]): UserRecord[] {
  if (users.some((u) => u.role === "admin" && u.superAdmin)) return users;
  const admins = users
    .filter((u) => u.role === "admin")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const initialEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();
  const pick = admins.find((u) => u.email.toLowerCase() === initialEmail) ?? admins[0];
  if (!pick) return users;
  return users.map((u) => (u.id === pick.id ? { ...u, superAdmin: true } : u));
}

function assertSuperAdminRemains(users: UserRecord[]) {
  if (!users.some((u) => u.role === "admin" && u.superAdmin)) {
    throw new Error("There must always be at least one super admin.");
  }
}

function seedInitialAdmin(): UserRecord[] {
  // If this table were ever empty on a cold start (it shouldn't be, now that
  // it's a real database row, not a file on an ephemeral disk) this is the
  // only account created — require an explicit password via env in
  // production so it can never quietly seed a known default.
  const email = process.env.INITIAL_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!password && process.env.NODE_ENV === "production") {
    throw new Error(
      "No users exist and INITIAL_ADMIN_PASSWORD is not set. Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD in your environment before first run."
    );
  }
  if (!password) {
    console.warn(
      "[coldcall] No INITIAL_ADMIN_PASSWORD set — seeding a dev-only admin account (coldcall-admin). Set INITIAL_ADMIN_PASSWORD before deploying."
    );
  }
  // INITIAL_ADMIN_NAME lets each install name its first account.
  const name = process.env.INITIAL_ADMIN_NAME?.trim() || email.split("@")[0];
  return [
    {
      id: nanoid(),
      name,
      email,
      passwordHash: hashPassword(password ?? "coldcall-admin"),
      role: "admin",
      superAdmin: true,
      createdAt: new Date().toISOString(),
    },
  ];
}

async function readUsers(): Promise<UserRecord[]> {
  const existing = await readStore<UserRecord[] | null>(USERS_KEY, null);
  if (existing) {
    if (withSuperAdmin(existing) === existing) return existing;
    return withStore<UserRecord[]>(USERS_KEY, [], (current) => withSuperAdmin(current));
  }
  // First run — seed and persist in the same atomic step so a concurrent
  // request can't race this and seed a second admin.
  return withStore<UserRecord[]>(USERS_KEY, [], (current) =>
    current.length ? current : seedInitialAdmin()
  );
}

function toPublic(u: UserRecord): PublicUser {
  const { passwordHash, ...rest } = u;
  void passwordHash;
  return rest;
}

export async function getAllUsers(): Promise<PublicUser[]> {
  const users = await readUsers();
  return users.map(toPublic);
}

export async function getAssignableUserNames(): Promise<string[]> {
  const users = await readUsers();
  return users.map((u) => u.name);
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const users = await readUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const users = await readUsers();
  return users.find((u) => u.id === id) ?? null;
}

export async function verifyCredentials(email: string, password: string): Promise<UserRecord | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;
  return verifyPassword(password, user.passwordHash) ? user : null;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
  superAdmin?: boolean;
}): Promise<PublicUser> {
  let created: UserRecord | null = null;
  await withStore<UserRecord[]>(USERS_KEY, [], (users) => {
    if (users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error("A user with that email already exists.");
    }
    // Leads and calls are filed by name, so two people can't share one
    if (users.some((u) => u.name.toLowerCase() === input.name.trim().toLowerCase())) {
      throw new Error("Someone already has that name.");
    }
    const user: UserRecord = {
      id: nanoid(),
      name: input.name,
      email: input.email,
      passwordHash: hashPassword(input.password),
      role: input.role,
      superAdmin: input.role === "admin" && !!input.superAdmin,
      createdAt: new Date().toISOString(),
    };
    created = user;
    return [...users, user];
  });
  return toPublic(created!);
}

export async function updateUser(
  id: string,
  patch: Partial<{ name: string; email: string; password: string; role: Role; superAdmin: boolean }>
): Promise<PublicUser | null> {
  let updated: UserRecord | null = null;
  await withStore<UserRecord[]>(USERS_KEY, [], (users) => {
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return users;
    const current = users[idx];
    const role = patch.role ?? current.role;
    const next: UserRecord = {
      ...current,
      name: patch.name ?? current.name,
      email: patch.email ?? current.email,
      role,
      superAdmin: role === "admin" && (patch.superAdmin ?? current.superAdmin ?? false),
      passwordHash: patch.password ? hashPassword(patch.password) : current.passwordHash,
    };
    updated = next;
    const copy = [...users];
    copy[idx] = next;
    assertSuperAdminRemains(copy);
    return copy;
  });
  return updated ? toPublic(updated) : null;
}

// Leads and call log entries refer to people by name (assignedTo / loggedBy),
// so a rename can optionally carry those over in the same transaction —
// otherwise the person's My Calls and stats would lose everything filed
// under their old name. Older history notes keep the name they were written with.
export async function renameUser(id: string, newName: string, moveRecords: boolean): Promise<void> {
  const name = newName.trim();
  if (!name) throw new Error("Name can't be empty.");
  await withStores([USERS_KEY, "leads", "call-log"], (current) => {
    const users = (current[USERS_KEY] as UserRecord[] | undefined) ?? [];
    const user = users.find((u) => u.id === id);
    if (!user) throw new Error("User not found.");
    const oldName = user.name;
    if (oldName === name) return {};
    if (users.some((u) => u.id !== id && u.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Someone else already has that name.");
    }

    const next: Record<string, unknown> = {
      [USERS_KEY]: users.map((u) => (u.id === id ? { ...u, name } : u)),
    };
    if (moveRecords) {
      const leads = (current["leads"] as { assignedTo: string | null }[] | undefined) ?? [];
      const calls = (current["call-log"] as { loggedBy: string }[] | undefined) ?? [];
      next["leads"] = leads.map((l) => (l.assignedTo === oldName ? { ...l, assignedTo: name } : l));
      next["call-log"] = calls.map((c) => (c.loggedBy === oldName ? { ...c, loggedBy: name } : c));
    }
    return next;
  });
}

export async function deleteUser(id: string): Promise<void> {
  await withStore<UserRecord[]>(USERS_KEY, [], (users) => {
    const next = users.filter((u) => u.id !== id);
    assertSuperAdminRemains(next);
    return next;
  });
}
