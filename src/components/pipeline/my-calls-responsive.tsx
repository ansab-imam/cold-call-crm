"use client";

import type { Lead } from "@/lib/pipeline/schema";
import type { StatusSettings } from "@/lib/pipeline/status-settings-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { MyCallsTable } from "./my-calls-table";
import { MyCallsMobileList } from "./my-calls-mobile-list";

export function MyCallsResponsive(props: {
  initialLeads: Lead[];
  statusOptions: StatusSettings;
  assignableUsers: string[];
  currentUser: string;
  isAdmin: boolean;
}) {
  const isMobile = useIsMobile();
  return isMobile ? <MyCallsMobileList {...props} /> : <MyCallsTable {...props} />;
}
