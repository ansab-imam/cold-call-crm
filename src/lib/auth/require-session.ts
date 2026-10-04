import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "./current-user";
import type { SessionPayload } from "./session";

// Defense in depth: middleware.ts already gates these paths, but a route
// shouldn't rely solely on that — a future matcher change, rewrite, or
// internal fetch that bypasses middleware would otherwise silently remove
// auth from the handler with nothing else catching it.
export async function requireSession(): Promise<
  { session: SessionPayload; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const session = await getCurrentUser();
  if (!session) {
    return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  }
  return { session };
}

export async function requireAdmin(): Promise<
  { session: SessionPayload; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const result = await requireSession();
  if (result.error) return result;
  if (result.session.role !== "admin") {
    return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  }
  return result;
}
