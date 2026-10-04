import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser, getAllUsers, fromAccessLevel } from "@/lib/auth/users-store";
import { getActingAdmin, canGrantLevel } from "@/lib/auth/user-permissions";

export async function GET() {
  const users = await getAllUsers();
  return NextResponse.json({ users });
}

const bodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters."),
  level: z.enum(["rep", "admin", "superadmin"]),
});

export async function POST(request: Request) {
  const actor = await getActingAdmin();
  if (!actor) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { level, ...rest } = parsed.data;
  if (!canGrantLevel(actor, level)) {
    return NextResponse.json({ error: "Only a super admin can create admins." }, { status: 403 });
  }

  try {
    const user = await createUser({ ...rest, ...fromAccessLevel(level) });
    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
}
