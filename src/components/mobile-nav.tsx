"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { navItems } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { LayoutDashboard, PhoneCall, Database, Menu, LogOut } from "lucide-react";

// The four most-used screens get their own tab; everything else (Call Log,
// Opportunities, Invalid Leads, Reports, and — for an admin — Users and
// Settings) lives behind "More", same as a real phone app with more
// sections than fit in one bar.
const PRIMARY = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "My Calls", url: "/my-calls", icon: PhoneCall },
  { title: "Pipeline", url: "/pipeline", icon: Database },
];

function isActivePath(pathname: string, url: string): boolean {
  return url === "/" ? pathname === "/" : pathname.startsWith(url);
}

export function MobileNav({ role }: { role: "admin" | "rep" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const moreItems = navItems.filter(
    (item) =>
      !PRIMARY.some((p) => p.url === item.url) && (!item.adminOnly || role === "admin")
  );
  const moreIsActive = moreItems.some((item) => isActivePath(pathname, item.url));

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {PRIMARY.map((item) => {
          const active = isActivePath(pathname, item.url);
          return (
            <Link
              key={item.url}
              href={item.url}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="size-5" />
              {item.title}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
            moreIsActive ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Menu className="size-5" />
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] rounded-t-2xl p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>More</SheetTitle>
            <SheetDescription>Everything else in Cold Call CRM</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-1 overflow-y-auto p-3">
            {moreItems.map((item) => {
              const active = isActivePath(pathname, item.url);
              return (
                <Link
                  key={item.url}
                  href={item.url}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium",
                    active ? "bg-primary/10 text-primary" : "hover:bg-accent"
                  )}
                >
                  <item.icon className="size-5" />
                  {item.title}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-5" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
