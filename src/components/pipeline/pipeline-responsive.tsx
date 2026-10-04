"use client";

import type { Lead } from "@/lib/pipeline/schema";
import type { StatusSettings } from "@/lib/pipeline/status-settings-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { PipelineTable } from "./pipeline-table";
import { PipelineMobileList } from "./pipeline-mobile-list";

export function PipelineResponsive(props: {
  initialLeads: Lead[];
  statusOptions: StatusSettings;
  assignableUsers: string[];
  isAdmin: boolean;
  currentUser: string;
}) {
  const isMobile = useIsMobile();
  return isMobile ? <PipelineMobileList {...props} /> : <PipelineTable {...props} />;
}
