"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Camera,
  ChevronDown,
  FileText,
  Folder,
  GripVertical,
  HelpCircle,
  Home,
  Info,
  Link as LinkIcon,
  MapPin,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  Paperclip,
  Phone,
  Plus,
  Briefcase,
  Shield,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { cn, arrayMove } from "@/lib/utils";

export type NavItem = {
  label: string;
  href: string;
  status: "complete" | "in-progress" | "not-started" | null;
  icon?: string;
  slug?: string;
  filledBy?: "talkpush" | "client";
  hasAttachments?: boolean;
};

interface TopNavProps {
  items: NavItem[];
  clientName: string;
  hasPendingChangesRef?: RefObject<boolean>;
  onReorder?: (slugs: string[]) => void;
  onFilledByChange?: (map: Record<string, "talkpush" | "client">) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  Building2,
  Users,
  Megaphone,
  HelpCircle,
  MessageSquare,
  Share2: LinkIcon,
  Link: LinkIcon,
  MapPin,
  Folder,
  FileText,
  MessagesSquare,
  MessageCircle: MessagesSquare,
  Camera,
  Instagram: Camera,
  Phone,
  Briefcase,
  Shield,
  Tags,
};


function getStatusLabel(status: NavItem["status"]) {
  if (status === "complete") return "Complete";
  if (status === "in-progress") return "In progress";
  if (status === "not-started") return "Not started";
  return "Overview";
}

function StatusIndicator({ status }: { status: NavItem["status"] }) {
  if (status === "complete") {
    return <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]" />;
  }

  if (status === "in-progress") {
    return <span className="h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_0_4px_rgba(251,191,36,0.14)]" />;
  }

  if (status === "not-started") {
    return <span className="h-2.5 w-2.5 rounded-full border border-slate-400/60 bg-transparent" />;
  }

  return <span className="h-2.5 w-2.5 rounded-full bg-slate-500/60" />;
}

function SortableNavItem({
  item,
  isActive,
  confirmNavigation,
  canReorder,
}: {
  item: NavItem;
  isActive: boolean;
  confirmNavigation: (href: string) => boolean;
  canReorder: boolean;
}) {
  const Icon = ICON_MAP[item.icon ?? ""] ?? Info;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.slug || item.href, disabled: !canReorder });

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          style={{
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.7 : 1,
          }}
          className="px-2"
        >
          <div
            className={cn(
              "group relative rounded-[22px] transition-all",
              isDragging && "bg-white/[0.12] shadow-[0_20px_36px_-30px_rgba(15,23,42,0.85)]"
            )}
          >
            {canReorder && (
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="absolute left-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white active:cursor-grabbing xl:flex xl:opacity-0 xl:group-hover:opacity-100"
                title="Drag to reorder"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
            )}

            <Link
              href={item.href}
              onClick={(e) => {
                if (!confirmNavigation(item.href)) e.preventDefault();
              }}
              className={cn(
                "relative flex min-h-[52px] items-center justify-center gap-3 rounded-[20px] px-3 py-3 text-sm transition-all duration-200 active:scale-[0.98] xl:justify-start xl:px-4 xl:pl-11",
                isActive
                  ? "bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_18px_34px_-26px_rgba(15,23,42,0.9)]"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              )}
              aria-label={item.label}
            >
              <div
                className={cn(
                  "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]",
                  isActive && "bg-white/[0.16] border-white/20"
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                <span className="absolute -right-0.5 -top-0.5 xl:hidden">
                  <StatusIndicator status={item.status} />
                </span>
              </div>

              <div className="hidden min-w-0 flex-1 xl:block">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{item.label}</span>
                  {item.hasAttachments && (
                    <Paperclip
                      className="h-3 w-3 shrink-0 text-blue-300"
                      aria-label="Has uploaded files"
                    />
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                  <StatusIndicator status={item.status} />
                  <span>{getStatusLabel(item.status)}</span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="xl:hidden">
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

export function TopNav({ items, clientName, hasPendingChangesRef, onReorder, onFilledByChange }: TopNavProps) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll, items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Split items into two groups while preserving their relative order.
  const clientItems = useMemo(
    () => items.filter((item) => item.filledBy !== "talkpush"),
    [items]
  );
  const talkpushItems = useMemo(
    () => items.filter((item) => item.filledBy === "talkpush"),
    [items]
  );

  // Combined visual order: client group first, then talkpush group.
  const combinedItems = useMemo(
    () => [...clientItems, ...talkpushItems],
    [clientItems, talkpushItems]
  );
  const combinedIds = useMemo(
    () => combinedItems.map((item) => item.slug || item.href),
    [combinedItems]
  );

  function confirmNavigation(href: string): boolean {
    if (hasPendingChangesRef?.current && href !== pathname) {
      return window.confirm(
        "You have unpublished changes. Leave this page without publishing?"
      );
    }

    return true;
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const oldIndex = combinedIds.indexOf(activeId);
    const newIndex = combinedIds.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) return;

    // Determine the target group based on which group the "over" item belongs to.
    // If the user dropped on a talkpush item, the dragged item joins the talkpush group
    // (and vice versa). This makes cross-group drops intuitive.
    const overItem = combinedItems[newIndex];
    const targetGroup: "talkpush" | "client" =
      overItem.filledBy === "talkpush" ? "talkpush" : "client";

    const reordered = arrayMove(combinedItems, oldIndex, newIndex);

    // Build the new filledBy map (only include standard tabs with a slug).
    const newFilledBy: Record<string, "talkpush" | "client"> = {};
    for (const item of reordered) {
      if (!item.slug) continue;
      newFilledBy[item.slug] =
        (item.slug === activeId
          ? targetGroup
          : item.filledBy === "talkpush"
            ? "talkpush"
            : "client");
    }

    // Re-bucket items by their new group, preserving the order within each bucket
    // as it appears in `reordered` so the dropped item lands at the right position.
    const newClientSlugs: string[] = [];
    const newTalkpushSlugs: string[] = [];
    for (const item of reordered) {
      const slug = item.slug;
      if (!slug) continue;
      if (newFilledBy[slug] === "talkpush") {
        newTalkpushSlugs.push(slug);
      } else {
        newClientSlugs.push(slug);
      }
    }

    // Persist: client group first, then talkpush group (matches visual order).
    onReorder([...newClientSlugs, ...newTalkpushSlugs]);
    onFilledByChange?.(newFilledBy);
  };

  const canReorder = Boolean(onReorder);

  const renderGroup = (groupItems: NavItem[]) =>
    groupItems.map((item) => {
      const isActive = pathname === item.href;
      return (
        <SortableNavItem
          key={item.slug || item.href}
          item={item}
          isActive={isActive}
          confirmNavigation={confirmNavigation}
          canReorder={canReorder}
        />
      );
    });

  const GroupHeader = ({ label }: { label: string }) => (
    <div className="mb-2 mt-4 hidden items-center gap-3 px-4 xl:flex first:mt-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );

  const navContent = (
    <aside
      ref={navRef}
      className="flex h-screen w-16 shrink-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#0f172a_0%,#111827_44%,#1e293b_100%)] text-white shadow-[20px_0_50px_-40px_rgba(15,23,42,0.8)] xl:w-64"
    >
      <div className="border-b border-white/[0.08] px-2 py-3 xl:px-4 xl:py-5">
        <div className="flex items-center justify-center gap-3 xl:justify-start">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.12] text-sm font-semibold tracking-[0.18em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
            TP
          </div>
          <div className="hidden min-w-0 xl:block">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Workspace
            </p>
            <p className="truncate text-sm font-medium text-slate-100">
              CRM Modules
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <nav ref={scrollRef} className="scrollbar-thin h-full overflow-y-auto py-4">
          {canReorder ? (
            <SortableContext items={combinedIds} strategy={verticalListSortingStrategy}>
              {clientItems.length > 0 && (
                <>
                  <GroupHeader label={`Filled Up by ${clientName}`} />
                  {renderGroup(clientItems)}
                </>
              )}
              {talkpushItems.length > 0 && (
                <>
                  <GroupHeader label="Filled Up by Talkpush" />
                  {renderGroup(talkpushItems)}
                </>
              )}
            </SortableContext>
          ) : (
            <>
              {clientItems.length > 0 && (
                <>
                  <GroupHeader label={`Filled Up by ${clientName}`} />
                  {renderGroup(clientItems)}
                </>
              )}
              {talkpushItems.length > 0 && (
                <>
                  <GroupHeader label="Filled Up by Talkpush" />
                  {renderGroup(talkpushItems)}
                </>
              )}
            </>
          )}
        </nav>

        {/* Bottom fade + chevron to signal more tabs below */}
        <div
          className={cn(
            "pointer-events-none absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end pb-1 transition-opacity duration-300",
            canScrollDown ? "opacity-100" : "opacity-0"
          )}
        >
          <div className="h-12 w-full bg-gradient-to-t from-[#1e293b] to-transparent" />
          <ChevronDown className="absolute bottom-1 h-4 w-4 animate-bounce text-slate-400" />
        </div>
      </div>

      <div className="border-t border-white/[0.08] p-2 xl:p-4">
        <Button
          type="button"
          disabled
          className="h-11 w-full rounded-2xl bg-[#1A73E8] text-white shadow-[0_18px_32px_-22px_rgba(26,115,232,0.9)] hover:bg-[#1765cb] active:scale-95 disabled:cursor-not-allowed disabled:opacity-90"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden xl:inline">New Module</span>
        </Button>
        <p className="mt-2 hidden text-[11px] leading-5 text-slate-400 xl:block">
          Module creation is staged outside this shared configuration editor.
        </p>
      </div>
    </aside>
  );

  if (canReorder) {
    return (
      <TooltipProvider delayDuration={250}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {navContent}
        </DndContext>
      </TooltipProvider>
    );
  }

  return <TooltipProvider delayDuration={250}>{navContent}</TooltipProvider>;
}
