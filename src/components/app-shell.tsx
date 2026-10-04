"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { MobileHeader } from "@/components/mobile-header";
import { MobileNav } from "@/components/mobile-nav";
import { useIsMobile } from "@/hooks/use-mobile";

// A phone gets its own shell entirely — a top bar + bottom tab nav instead
// of the desktop sidebar — not the sidebar's own built-in mobile mode
// (an overlay drawer triggered by a hamburger), which is still fundamentally
// a shrunk desktop layout rather than something native-app-shaped.
export function AppShell({
  role,
  name,
  roleLabel,
  children,
}: {
  role: "admin" | "rep";
  name: string;
  roleLabel: string;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <MobileHeader name={name} role={role} />
        <main className="flex-1 overflow-y-auto p-4 pb-24">{children}</main>
        <MobileNav role={role} />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar role={role} />
      <SidebarInset>
        <SiteHeader name={name} roleLabel={roleLabel} />
        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
