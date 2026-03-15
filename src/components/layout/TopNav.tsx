"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = {
  label: string;
  href: string;
  status: "complete" | "in-progress" | "not-started" | null;
};

interface TopNavProps {
  items: NavItem[];
  /** Ref to the pending-changes flag from useChecklist. When true, warn before navigating. */
  hasPendingChangesRef?: React.RefObject<boolean>;
}

function StatusDot({ status }: { status: NavItem["status"] }) {
  if (status === "complete")
    return <span className="h-1.5 w-1.5 rounded-full bg-green-600 shrink-0" />;
  if (status === "in-progress")
    return <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />;
  if (status === "not-started")
    return <span className="h-1.5 w-1.5 rounded-full border-2 border-gray-400 bg-transparent shrink-0" />;
  return null;
}

export function TopNav({ items, hasPendingChangesRef }: TopNavProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [drawerOpen]);

  const activeItem = items.find((i) => i.href === pathname);

  /** Returns false (and shows a confirm) if there are unsaved changes. */
  function confirmNavigation(href: string): boolean {
    if (hasPendingChangesRef?.current && href !== pathname) {
      return window.confirm("You have unsaved changes. Your data is being saved — navigate anyway?");
    }
    return true;
  }

  return (
    <nav className="border-b border-border bg-background shrink-0">
      {/* Desktop: wrapping tabs (≥520px) */}
      <ul className="hidden sm:flex flex-wrap items-stretch list-none px-1 m-0">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href} className="flex items-stretch">
              <Link
                href={item.href}
                onClick={(e) => {
                  if (!confirmNavigation(item.href)) e.preventDefault();
                }}
                className={cn(
                  "flex items-center gap-1.5 h-11 px-3.5 text-[13px] font-medium whitespace-nowrap relative transition-colors",
                  isActive
                    ? "text-blue-600 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm"
                )}
              >
                <StatusDot status={item.status} />
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t pointer-events-none" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Mobile: single row button (<520px) */}
      <div className="flex sm:hidden items-center h-11 px-4 border-b border-border">
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          className="flex items-center gap-2 text-[13px] font-semibold text-blue-600"
        >
          <Menu className="h-4 w-4" />
          {activeItem?.label ?? "Menu"}
        </button>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div
          ref={drawerRef}
          className="sm:hidden fixed left-0 right-0 z-50 bg-background border-b shadow-xl max-h-[60vh] overflow-y-auto p-1"
          style={{ top: "calc(56px + 44px + 28px)" }}
        >
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  if (!confirmNavigation(item.href)) {
                    e.preventDefault();
                  } else {
                    setDrawerOpen(false);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded text-[13px] font-medium",
                  isActive
                    ? "bg-blue-50 text-blue-600 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <StatusDot status={item.status} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
