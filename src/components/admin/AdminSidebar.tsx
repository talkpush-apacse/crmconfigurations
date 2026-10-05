"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutList, ChevronLeft, ChevronRight, FolderKanban, Building2, Users, GitBranch, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveModule } from "@/lib/modules";

const STORAGE_KEY = "admin-sidebar-collapsed";

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  const checklistNav = [
    { href: "/admin", label: "Checklists", icon: LayoutList, exact: true },
    { href: "/admin/requirements-templates", label: "Templates", icon: ClipboardList, exact: true },
  ];
  const trackerNav = [
    { href: "/admin/tracker", label: "Portfolio", icon: FolderKanban, exact: true },
    { href: "/admin/tracker/accounts", label: "Accounts", icon: Building2, exact: false },
    { href: "/admin/tracker/team", label: "Team", icon: Users, exact: false },
    { href: "/admin/tracker/plan", label: "Standard plan", icon: ListChecks, exact: false },
  ];
  const workflowNav = [{ href: "/admin/workflows", label: "Workflows", icon: GitBranch, exact: false }];
  const activeModule = getActiveModule(pathname);
  const navItems = activeModule === "tracker" ? trackerNav : activeModule === "workflows" ? workflowNav : checklistNav;
  const isActive = (item: { href: string; exact: boolean }) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 border-r border-border bg-card transition-[width] duration-200 overflow-hidden",
        collapsed ? "w-12" : "w-48"
      )}
    >
      <nav className="flex flex-1 flex-col gap-1 p-2 pt-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive(item)
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title={item.label}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        ))}
      </nav>

      <div className="border-t border-border p-2">
        <button
          onClick={toggle}
          className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
