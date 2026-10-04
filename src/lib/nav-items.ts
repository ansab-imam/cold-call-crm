import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  PhoneCall,
  Database,
  History,
  Kanban,
  BarChart3,
  Users,
  Settings,
  Ban,
} from "lucide-react";

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  description: string;
  status?: "active" | "planned";
  adminOnly?: boolean;
};

export const navItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    description: "Today's assigned calls, pipeline volume, and performance at a glance",
    status: "active",
  },
  {
    title: "My Calls",
    url: "/my-calls",
    icon: PhoneCall,
    description: "Your personal queue: assigned leads, follow-ups, and callbacks due today",
    status: "planned",
  },
  {
    title: "Pipeline",
    url: "/pipeline",
    icon: Database,
    description: "The master list of leads not yet turned into opportunities",
    status: "planned",
  },
  {
    title: "Call Log",
    url: "/call-log",
    icon: History,
    description: "Complete history of every call made against every lead",
    status: "planned",
  },
  {
    title: "Opportunities",
    url: "/opportunities",
    icon: Kanban,
    description: "Leads with genuine buying interest, tracked through your sales stages",
    status: "planned",
  },
  {
    title: "Invalid Leads",
    url: "/invalid-leads",
    icon: Ban,
    description: "Leads marked as bad data or the wrong fit — kept, not deleted, for another campaign later",
    status: "planned",
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
    description: "Conversion analytics filterable by date, user, source, and outcome",
    status: "planned",
  },
  {
    title: "Users",
    url: "/users",
    icon: Users,
    description: "Manage the SDRs and teammates using Cold Call CRM",
    status: "planned",
    adminOnly: true,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    description: "AI instructions, lead statuses, call outcomes, stages, and permissions",
    status: "planned",
    adminOnly: true,
  },
];
