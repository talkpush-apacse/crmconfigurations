"use client";

import { type RefObject } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { NavItem } from "./TopNav";
import { chunkSections } from "./section-groups";

interface SectionSelectProps {
  items: NavItem[];
  hasPendingChangesRef?: RefObject<boolean>;
}

function statusText(status: NavItem["status"]) {
  if (status === "complete") return "Complete";
  if (status === "in-progress") return "In progress";
  if (status === "not-started") return "Not started";
  return "";
}

/**
 * Phone replacement for the section rail. Below 640px the rail is hidden, and
 * a row of identical icons said nothing about where you were. This names the
 * current section, shows how far along the checklist is, and lists every
 * section with its state. A native select, so it gets the platform picker.
 */
export function SectionSelect({ items, hasPendingChangesRef }: SectionSelectProps) {
  const pathname = usePathname();
  const router = useRouter();

  if (items.length === 0) return null;

  const active = items.find((item) => item.href === pathname) ?? items[0];
  const statusItems = items.filter((item) => item.status !== null);
  const completeCount = statusItems.filter((item) => item.status === "complete").length;
  const activeIndex = items.findIndex((item) => item.href === active.href);

  const handleChange = (href: string) => {
    if (href === pathname) return;
    if (
      hasPendingChangesRef?.current &&
      !window.confirm("You have unpublished changes. Leave this page without publishing?")
    ) {
      return;
    }
    router.push(href);
  };

  const renderOption = (item: NavItem) => {
    const text = statusText(item.status);
    return (
      <option key={item.href} value={item.href}>
        {text ? `${item.label} (${text})` : item.label}
      </option>
    );
  };

  const chunks = items.length > 6 ? chunkSections(items) : null;

  return (
    <div className="border-b border-border bg-card px-4 py-3 sm:hidden">
      <label htmlFor="section-select" className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold text-foreground">Sections</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {activeIndex + 1} of {items.length}
          {statusItems.length > 0 && ` · ${completeCount} of ${statusItems.length} complete`}
        </span>
      </label>
      <div className="relative mt-2">
        <select
          id="section-select"
          value={active.href}
          onChange={(event) => handleChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-md border border-muted-foreground/40 bg-background py-2 pl-3 pr-10 text-[15px] font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
        >
          {chunks
            ? chunks.map((chunk) => (
                <optgroup key={chunk.id} label={chunk.label}>
                  {chunk.items.map(renderOption)}
                </optgroup>
              ))
            : items.map(renderOption)}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
