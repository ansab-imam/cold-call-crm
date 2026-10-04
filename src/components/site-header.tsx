"use client";

import { usePathname, useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/nav-items";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UniversalSearch } from "@/components/universal-search";
import { LogOut } from "lucide-react";

export function SiteHeader({ name, roleLabel }: { name: string; roleLabel: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const current =
    navItems.find((item) =>
      item.url === "/" ? pathname === "/" : pathname.startsWith(item.url)
    ) ?? navItems[0];

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span className="hidden text-sm font-semibold leading-none sm:block">
          {current.title}
        </span>
      </div>
      <div className="min-w-0 flex-1 px-2 sm:px-6">
        <UniversalSearch currentUser={name} />
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-sm font-medium">{name}</div>
            <div className="text-xs text-muted-foreground">{roleLabel}</div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
