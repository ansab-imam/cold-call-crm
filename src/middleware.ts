import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

// Paths a rep is not allowed into — everything else (Dashboard, My Calls,
// Pipeline, Call Log, Opportunities, Reports) is open to any logged-in user.
const ADMIN_ONLY_PREFIXES = ["/users", "/settings"];
const ADMIN_ONLY_API_PREFIXES = [
  "/api/users",
  "/api/status-settings",
  "/api/ai-settings",
  "/api/opportunity-settings",
  "/api/backup",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    // Hit by Vercel's Cron Jobs, not a logged-in browser — it checks its
    // own shared secret instead (see src/app/api/cron/backup/route.ts).
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname === "/apple-icon.png"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const isAdminOnly =
    ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) ||
    ADMIN_ONLY_API_PREFIXES.some((p) => pathname.startsWith(p));

  if (isAdminOnly && session.role !== "admin") {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Admins only." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
