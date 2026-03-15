"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
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
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type NavItem = {
  label: string;
  href: string;
  status: "complete" | "in-progress" | "not-started" | null;
  icon?: string;
};

interface TopNavProps {
  items: NavItem[];
  /** Ref to the pending-changes flag from useChecklist. When true, warn before navigating. */
  hasPendingChangesRef?: React.RefObject<boolean>;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  Building2,
  Users,
  Megaphone,
  MapPin,
  HelpCircle,
  ClipboardCheck: HelpCircle,
  MessageSquare,
  Share2: LinkIcon,
  Link: LinkIcon,
  Folder,
  FileText,
  MessagesSquare,
  MessageCircle: MessagesSquare,
  Camera,
  Instagram: Camera,
  Phone,
  Briefcase,
  Info,
};

function StatusDot({ status }: { status: NavItem["status"] }) {
  if (status === "complete")
    return (
      <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-green-600 pointer-events-none" />
    );
  if (status === "in-progress")
    return (
      <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-500 pointer-events-none" />
    );
  if (status === "not-started")
    return (
      <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full border-2 border-gray-400 bg-transparent pointer-events-none" />
    );
  return null;
}

export function TopNav({ items, hasPendingChangesRef }: TopNavProps) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  function confirmNavigation(href: string): boolean {
    if (hasPendingChangesRef?.current && href !== pathname) {
      return window.confirm(
        "You have unsaved changes. Your data is being saved — navigate anyway?"
      );
    }
    return true;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        ref={navRef}
        className="w-12 shrink-0 bg-background border-r border-border flex flex-col overflow-y-auto"
      >
        {items.map((item) => {
          const isActive = pathname === item.href;
          const Icon = ICON_MAP[item.icon ?? ""] ?? Info;
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  onClick={(e) => {
                    if (!confirmNavigation(item.href)) e.preventDefault();
                  }}
                  className={cn(
                    "relative w-full h-10 flex items-center justify-center transition-colors shrink-0",
                    isActive
                      ? "bg-blue-50 text-blue-600 border-l-2 border-blue-600"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent"
                  )}
                  aria-label={item.label}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                  <StatusDot status={item.status} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </aside>
    </TooltipProvider>
  );
}
