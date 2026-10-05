/**
 * The portal's modules. The header switcher, the sidebar and the /admin/home
 * picker all read this list, so adding a module is a one-place change.
 */

export type ModuleId = "checklist" | "tracker" | "workflows";

export interface PortalModule {
  id: ModuleId;
  label: string;
  /** Short name used in the header chip. */
  shortLabel: string;
  description: string;
  href: string;
}

export const PORTAL_MODULES: PortalModule[] = [
  {
    id: "checklist",
    label: "CRM Config Checklist",
    shortLabel: "Config Checklist",
    description: "Collect and track the configuration details each client needs for their Talkpush CRM.",
    href: "/admin",
  },
  {
    id: "tracker",
    label: "Project Tracker",
    shortLabel: "Project Tracker",
    description: "Follow each client implementation: open items, owners, dependencies and success metrics.",
    href: "/admin/tracker",
  },
  {
    id: "workflows",
    label: "Workflow Builder",
    shortLabel: "Workflow Builder",
    description: "Map a client's hiring process, version it and share it for review.",
    href: "/admin/workflows",
  },
];

/** Which module a path belongs to. The module picker and the Connected apps page belong to neither. */
export function getActiveModule(pathname: string | null): ModuleId | null {
  if (!pathname) return null;
  if (pathname === "/admin/home" || pathname.startsWith("/admin/home/")) return null;
  if (pathname === "/admin/connections") return null;
  if (pathname === "/admin/tracker" || pathname.startsWith("/admin/tracker/")) return "tracker";
  if (pathname === "/admin/workflows" || pathname.startsWith("/admin/workflows/")) return "workflows";
  if (pathname.startsWith("/admin")) return "checklist";
  return null;
}

export const TRACKER_NAV = [
  { href: "/admin/tracker", label: "Portfolio", match: "exact" as const },
  { href: "/admin/tracker/accounts", label: "Accounts", match: "prefix" as const },
  { href: "/admin/tracker/team", label: "Team", match: "prefix" as const },
  { href: "/admin/tracker/plan", label: "Standard plan", match: "prefix" as const },
];
