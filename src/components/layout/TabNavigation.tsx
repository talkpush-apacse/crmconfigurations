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
};

interface TabNavigationProps {
  slug: string;
  data: ChecklistData | null;
}

export function TabNavigation({ slug, data }: TabNavigationProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {getEnabledTabs(data?.enabledTabs ?? null).map((tab) => {
        const isActive = pathname === `/client/${slug}/${tab.slug}`;
        const Icon = iconMap[tab.icon];
        const hasData =
          tab.dataKey && data
            ? (() => {
                const val = data[tab.dataKey as keyof ChecklistData];
                if (val === null || val === undefined) return false;
                if (Array.isArray(val)) return val.length > 0;
                if (typeof val === "object") return Object.values(val).some((v) => v !== "" && v !== null);
                return true;
              })()
            : false;

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
            {tab.dataKey && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      "ml-auto h-2.5 w-2.5 shrink-0 rounded-full",
                      hasData ? "bg-amber-400" : "bg-muted-foreground/30"
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {hasData ? "Data entered" : "Not started"}
                </TooltipContent>
              </Tooltip>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
