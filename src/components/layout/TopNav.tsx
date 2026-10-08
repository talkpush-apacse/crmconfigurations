"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Camera,
  ArrowLeftRight,
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
  PlugZap,
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
import { cn, arrayMove } from "@/lib/utils";
import { chunkSections, getSectionGroupId } from "./section-groups";

/** Past this many sections in one owner group, the rail adds named chunks. */
const CHUNK_THRESHOLD = 6;

export type NavItem = {
  label: string;
  href: string;
  status: "complete" | "in-progress" | "not-started" | null;
  icon?: string;
  slug?: string;
  filledBy?: "talkpush" | "client";
  hasAttachments?: boolean;
  canChangeOwnership?: boolean;
};

interface TopNavProps {
  items: NavItem[];
  clientName: string;
  hasPendingChangesRef?: RefObject<boolean>;
  onReorder?: (slugs: string[]) => void;
  onOwnershipChange?: (slug: string, filledBy: "talkpush" | "client") => void;
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
  PlugZap,
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
    return <span data-status="complete" className="cf-status h-2.5 w-2.5 rounded-full bg-brand-sage-darker" />;
  }

  if (status === "in-progress") {
    return <span data-status="in-progress" className="cf-status h-2.5 w-2.5 rounded-full bg-brand-amber" />;
  }

  if (status === "not-started") {
    return <span data-status="not-started" className="cf-status h-2.5 w-2.5 rounded-full border border-muted-foreground/40 bg-transparent" />;
  }

  return <span data-status="none" className="cf-status h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />;
}

/** Thin rule between groups on the icon-only rail, where there is no room for a label. */
function RailDivider() {
  return <div className="mx-3 my-2 h-px bg-border xl:hidden" aria-hidden="true" />;
}

/** Names who fills in the sections below it. Sentence case, wide screens only. */
function OwnerHeader({ label }: { label: string }) {
  return (
    <div className="mb-2 hidden items-center gap-3 px-4 xl:flex">
      <span className="cf-nav-owner min-w-0 truncate text-[13px] font-semibold text-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Names a chunk of related sections. Wide screens only. */
function ChunkHeader({ label }: { label: string }) {
  return (
    <div className="cf-nav-chunk mb-1 hidden px-4 text-[11px] font-medium text-muted-foreground xl:block">
      {label}
    </div>
  );
}

function SortableNavItem({
  item,
  isActive,
  confirmNavigation,
  canReorder,
  onOwnershipChange,
}: {
  item: NavItem;
  isActive: boolean;
  confirmNavigation: (href: string) => boolean;
  canReorder: boolean;
  onOwnershipChange?: (slug: string, filledBy: "talkpush" | "client") => void;
}) {
  const Icon = ICON_MAP[item.icon ?? ""] ?? Info;
  const canChangeOwnership = !!item.slug && !!item.canChangeOwnership && !!onOwnershipChange;
  const currentOwner = item.filledBy === "talkpush" ? "talkpush" : "client";
  const nextOwner = currentOwner === "talkpush" ? "client" : "talkpush";
  const nextOwnerLabel = nextOwner === "talkpush" ? "Talkpush" : "client";
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
              isDragging && "bg-secondary shadow-md"
            )}
          >
            {canReorder && (
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="absolute left-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground active:cursor-grabbing xl:flex xl:opacity-0 xl:group-hover:opacity-100"
                title="Drag to reorder within this group"
                aria-label={`Reorder ${item.label}`}
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
                canChangeOwnership && "xl:pr-12",
                isActive
                  ? "bg-brand-sage-lightest text-foreground ring-1 ring-inset ring-brand-sage-darker/25"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              aria-label={`${item.label}, ${getStatusLabel(item.status)}`}
              aria-current={isActive ? "page" : undefined}
              data-active={isActive ? "true" : undefined}
            >
              <div
                className={cn(
                  "cf-nav-icon relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary",
                  isActive && "bg-brand-sage-lightest border-brand-sage-darker/40"
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                <span className="absolute -right-0.5 -top-0.5 xl:hidden">
                  <StatusIndicator status={item.status} />
                </span>
              </div>

              <div className="hidden min-w-0 flex-1 xl:block">
                <div className="flex items-center gap-1.5">
                  <span className="cf-nav-label min-w-0 max-w-[10.5rem] whitespace-normal font-medium leading-5">
                    {item.label}
                  </span>
                  {item.hasAttachments && (
                    <Paperclip
                      className="h-3 w-3 shrink-0 text-brand-lavender-darker"
                      aria-label="Has uploaded files"
                    />
                  )}
                  {/* Done needs no sentence: the tick is enough. Words are kept for what still needs doing. */}
                  {item.status === "complete" && (
                    <span title="Complete" className="shrink-0">
                      <StatusIndicator status={item.status} />
                    </span>
                  )}
                </div>
                {item.status !== "complete" && (
                  <div className="cf-nav-status mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <StatusIndicator status={item.status} />
                    <span>{getStatusLabel(item.status)}</span>
                  </div>
                )}
              </div>
            </Link>
            {canChangeOwnership && (
              <button
                type="button"
                className="absolute right-3 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground opacity-0 transition hover:bg-secondary hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:flex xl:group-hover:opacity-100"
                aria-label={`Move ${item.label} to ${nextOwnerLabel}`}
                title={`Move to ${nextOwnerLabel}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!item.slug) return;
                  const confirmed = window.confirm(
                    nextOwner === "talkpush"
                      ? `Move ${item.label} to Talkpush? It will be hidden from the client-facing checklist.`
                      : `Move ${item.label} to the client? It will be visible on the client-facing checklist.`
                  );
                  if (confirmed) onOwnershipChange(item.slug, nextOwner);
                }}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="xl:hidden">
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

export function TopNav({
  items,
  clientName,
  hasPendingChangesRef,
  onReorder,
  onOwnershipChange,
}: TopNavProps) {
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

  // The group labels only mean something as a contrast between the two groups.
  // With one group (the client view, where Talkpush tabs are hidden) the
  // header labels nothing, so it is dropped.
  const showGroupHeaders = clientItems.length > 0 && talkpushItems.length > 0;

  // A long list gets named chunks (see section-groups.ts). Short lists stay flat.
  const ownerGroups = useMemo(() => {
    const build = (owner: "client" | "talkpush", groupItems: NavItem[]) => ({
      owner,
      label: owner === "talkpush" ? "Filled in by Talkpush" : `Filled in by ${clientName}`,
      items: groupItems,
      chunks: groupItems.length > CHUNK_THRESHOLD ? chunkSections(groupItems) : null,
    });
    return [
      ...(clientItems.length > 0 ? [build("client", clientItems)] : []),
      ...(talkpushItems.length > 0 ? [build("talkpush", talkpushItems)] : []),
    ];
  }, [clientItems, talkpushItems, clientName]);

  // The order sections are drawn in: client group first, then Talkpush group,
  // each one chunk by chunk when it has chunks.
  const displayItems = useMemo(
    () => ownerGroups.flatMap((g) => (g.chunks ? g.chunks.flatMap((c) => c.items) : g.items)),
    [ownerGroups]
  );
  const combinedIds = useMemo(
    () => displayItems.map((item) => item.slug || item.href),
    [displayItems]
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

    const activeItem = displayItems[oldIndex];
    const overItem = displayItems[newIndex];
    const activeGroup = activeItem.filledBy === "talkpush" ? "talkpush" : "client";
    const overGroup = overItem.filledBy === "talkpush" ? "talkpush" : "client";

    // Reordering must not change who fills a module in. Crossing this boundary
    // changes client visibility, so ownership needs a separate explicit action.
    if (activeGroup !== overGroup) {
      return;
    }

    // Chunks are labels, not containers: a section stays in its own chunk.
    const owner = ownerGroups.find((g) => g.owner === activeGroup);
    if (owner?.chunks && getSectionGroupId(activeItem.slug) !== getSectionGroupId(overItem.slug)) {
      return;
    }

    const nextGroup = arrayMove(
      activeGroup === "talkpush" ? talkpushItems : clientItems,
      activeGroup === "talkpush"
        ? talkpushItems.findIndex((item) => (item.slug || item.href) === activeId)
        : clientItems.findIndex((item) => (item.slug || item.href) === activeId),
      activeGroup === "talkpush"
        ? talkpushItems.findIndex((item) => (item.slug || item.href) === overId)
        : clientItems.findIndex((item) => (item.slug || item.href) === overId)
    );

    const nextClientItems = activeGroup === "client" ? nextGroup : clientItems;
    const nextTalkpushItems = activeGroup === "talkpush" ? nextGroup : talkpushItems;

    onReorder(
      [...nextClientItems, ...nextTalkpushItems]
        .map((item) => item.slug)
        .filter((slug): slug is string => !!slug)
    );
  };

  const canReorder = Boolean(onReorder);

  const renderItems = (groupItems: NavItem[]) =>
    groupItems.map((item) => {
      const isActive = pathname === item.href;
      return (
        <SortableNavItem
          key={item.slug || item.href}
          item={item}
          isActive={isActive}
          confirmNavigation={confirmNavigation}
          canReorder={canReorder}
          onOwnershipChange={onOwnershipChange}
        />
      );
    });

  const renderOwnerGroups = () =>
    ownerGroups.map((group, groupIndex) => (
      <div key={group.owner} className={groupIndex > 0 ? "xl:mt-5" : undefined}>
        {showGroupHeaders && (
          <>
            {groupIndex > 0 && <RailDivider />}
            <OwnerHeader label={group.label} />
          </>
        )}
        {group.chunks
          ? group.chunks.map((chunk, chunkIndex) => (
              <div key={chunk.id} className={chunkIndex > 0 ? "xl:mt-3" : undefined}>
                {chunkIndex > 0 && <RailDivider />}
                <ChunkHeader label={chunk.label} />
                {renderItems(chunk.items)}
              </div>
            ))
          : renderItems(group.items)}
      </div>
    ));

  const navContent = (
    <aside
      ref={navRef}
      aria-label="Sections"
      className="cf-nav hidden w-16 shrink-0 flex-col overflow-hidden border-r border-border bg-card text-foreground sm:flex xl:w-72"
    >
      <div className="hidden border-b border-border px-4 py-3 xl:block">
        <p className="cf-nav-owner text-[13px] font-semibold text-foreground">Sections</p>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <nav ref={scrollRef} className="scrollbar-thin absolute inset-0 overflow-y-auto py-4">
          {canReorder ? (
            <SortableContext items={combinedIds} strategy={verticalListSortingStrategy}>
              {renderOwnerGroups()}
            </SortableContext>
          ) : (
            renderOwnerGroups()
          )}
        </nav>

        {/* Bottom fade + static chevron to signal more sections below */}
        <div
          className={cn(
            "pointer-events-none absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end pb-1 transition-opacity duration-300",
            canScrollDown ? "opacity-100" : "opacity-0"
          )}
        >
          <div className="h-12 w-full bg-gradient-to-t from-card to-transparent" />
          <ChevronDown className="absolute bottom-1 h-4 w-4 text-muted-foreground" />
        </div>
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
