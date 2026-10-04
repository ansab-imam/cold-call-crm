import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteUser, updateUser, renameUser, getUserById, fromAccessLevel, accessLevel } from "@/lib/auth/users-store";
import { getActingAdmin, canManageUser, canGrantLevel } from "@/lib/auth/user-permissions";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  level: z.enum(["rep", "admin", "superadmin"]).optional(),
  // With a name change: also move their leads / call log entries to the new name
  moveRecords: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActingAdmin();
  if (!actor) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  const { id } = await params;
  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { level, moveRecords, name, ...details } = parsed.data;
  const isSelf = target.id === actor.id;
  const changesLevel = level !== undefined && level !== accessLevel(target);

  // Everyone may edit their own name / email / password; anything else needs
  // permission over the target account.
  if (!(isSelf && !changesLevel) && !canManageUser(actor, target)) {
    return NextResponse.json({ error: "Only a super admin can change admin accounts." }, { status: 403 });
  }
  if (changesLevel && !canGrantLevel(actor, level)) {
    return NextResponse.json({ error: "Only a super admin can make someone an admin." }, { status: 403 });
  }

  try {
    if (name !== undefined && name !== target.name) {
      await renameUser(id, name, moveRecords ?? true);
    }
    const user = await updateUser(id, { ...details, ...(changesLevel ? fromAccessLevel(level) : {}) });
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActingAdmin();
  if (!actor) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  const { id } = await params;
  if (id === actor.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }
  const target = await getUserById(id);
  if (!target) return NextResponse.json({ ok: true });
  if (!canManageUser(actor, target)) {
    return NextResponse.json({ error: "Only a super admin can remove admins." }, { status: 403 });
  }

  try {
    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
