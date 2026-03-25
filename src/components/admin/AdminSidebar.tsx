"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutList, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const STORAGE_KEY = "admin-sidebar-collapsed";

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setCollapsed(stored === "true");

    fetch("/api/auth/check")
      .then((res) => res.json())
      .then((json) => {
        if (json.authenticated && json.role) setUserRole(json.role as Role);
      })
      .catch(() => {});
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  const navItems = [
    { href: "/admin", label: "Checklists", icon: LayoutList, show: true },
    { href: "/admin/users", label: "Users", icon: Users, show: userRole === "ADMIN" },
  ];

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 border-r border-gray-200 bg-white transition-[width] duration-200 overflow-hidden",
        collapsed ? "w-12" : "w-48"
      )}
    >
      <nav className="flex flex-1 flex-col gap-1 p-2 pt-4">
        {navItems.filter((item) => item.show).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              pathname === item.href
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

      <div className="border-t border-gray-100 p-2">
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
