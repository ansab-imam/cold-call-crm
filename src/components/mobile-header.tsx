"use client";

import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav-items";
import { UniversalSearch } from "@/components/universal-search";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function MobileHeader({ name }: { name: string; role: "admin" | "rep" }) {
  const pathname = usePathname();
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

  return (
    <header
      className="sticky top-0 z-30 flex flex-col gap-2 border-b bg-background/95 px-4 pt-3 pb-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-semibold leading-none">{current.title}</span>
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
      <UniversalSearch currentUser={name} />
    </header>
  );
}
