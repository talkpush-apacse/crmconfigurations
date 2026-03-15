"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getEnabledTabs } from "@/lib/tab-config";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Home,
  BookOpen,
  Building2,
  Users,
  Megaphone,
  MapPin,
  HelpCircle,
  MessageSquare,
  Link as LinkIcon,
  Folder,
  FileText,
  MessagesSquare,
  Camera,
  Phone,
  Briefcase,
  Info,
} from "lucide-react";
import type { ChecklistData } from "@/lib/types";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  BookOpen,
  Building2,
  Users,
  Megaphone,
  MapPin,
  HelpCircle,
  MessageSquare,
  Link: LinkIcon,
  Folder,
  FileText,
  MessagesSquare,
  Camera,
  Phone,
  Briefcase,
  Info,
};

interface TabNavigationProps {
  slug: string;
  data: ChecklistData | null;
}

/** Returns "complete" | "in-progress" | "empty" for a section's data */
function getSectionState(val: unknown): "complete" | "in-progress" | "empty" {
  if (val === null || val === undefined) return "empty";
  if (Array.isArray(val)) {
    if (val.length === 0) return "empty";
    // Complete = 3+ rows, or all items have at least one filled field
    const nonEmptyItems = val.filter((item) =>
      typeof item === "object" && item !== null
        ? Object.values(item as Record<string, unknown>).some((v) => v !== "" && v !== null && v !== undefined)
        : true
    );
    return nonEmptyItems.length >= 3 ? "complete" : "in-progress";
  }
  if (typeof val === "object") {
    const values = Object.values(val as Record<string, unknown>);
    const filled = values.filter((v) => v !== "" && v !== null && v !== undefined).length;
    if (filled === 0) return "empty";
    return filled / values.length >= 0.6 ? "complete" : "in-progress";
  }
  return "in-progress";
}

export function TabNavigation({ slug, data }: TabNavigationProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {getEnabledTabs(data?.enabledTabs ?? null).map((tab) => {
        const isActive = pathname === `/client/${slug}/${tab.slug}`;
        const Icon = iconMap[tab.icon];

        const sectionState =
          tab.dataKey && data
            ? getSectionState(data[tab.dataKey as keyof ChecklistData])
            : null;

        const dotLabel =
          sectionState === "complete"
            ? "Complete"
            : sectionState === "in-progress"
            ? "In progress"
            : "Not started";

        return (
          <Link
            key={tab.slug}
            href={`/client/${slug}/${tab.slug}`}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            <span className="truncate">{tab.label}</span>
            {tab.dataKey && sectionState !== null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    aria-label={dotLabel}
                    className={cn(
                      "ml-auto h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
                      sectionState === "complete"
                        ? "bg-green-500"
                        : sectionState === "in-progress"
                        ? "bg-amber-400"
                        : "border-2 border-muted-foreground/40 bg-transparent"
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {dotLabel}
                </TooltipContent>
              </Tooltip>
            )}
          </Link>
        );
      })}

      {/* Legend */}
      <div className="mt-3 border-t pt-3 px-1">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
          Section status
        </p>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
            Complete
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
            In progress
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full border-2 border-muted-foreground/40 shrink-0" />
            Not started
          </div>
        </div>
      </div>
    </nav>
  );
}
