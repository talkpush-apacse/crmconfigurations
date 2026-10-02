"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TRACKER_NAV } from "@/lib/modules";
import { cn } from "@/lib/utils";

/** The sidebar is hidden on phones, so the tracker gets a simple tab strip under the header. */
export function TrackerMobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Project Tracker" className="flex gap-1 border-b border-border bg-card px-3 py-2 md:hidden">
      {TRACKER_NAV.map((item) => {
        const active =
          item.match === "exact" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center rounded-lg px-4 text-sm",
              active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
