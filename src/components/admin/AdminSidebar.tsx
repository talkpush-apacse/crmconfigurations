"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutList, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "admin-sidebar-collapsed";

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Initialise from localStorage after mount to avoid SSR hydration mismatch
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setCollapsed(stored === "true");
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 border-r border-gray-200 bg-white transition-[width] duration-200 overflow-hidden",
        collapsed ? "w-12" : "w-48"
      )}
    >
      <nav className="flex flex-1 flex-col gap-1 p-2 pt-4">
        <Link
          href="/admin"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            pathname === "/admin"
              ? "bg-primary/10 font-medium text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          title="Checklists"
        >
          <LayoutList className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate">Checklists</span>}
        </Link>
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
