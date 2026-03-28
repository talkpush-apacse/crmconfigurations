"use client";

import { useRef, useMemo } from "react";
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
  Shield,
  Info,
  GripVertical,
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
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn, arrayMove } from "@/lib/utils";

export type NavItem = {
  label: string;
  href: string;
  status: "complete" | "in-progress" | "not-started" | null;
  icon?: string;
  slug?: string;
};

interface TopNavProps {
  items: NavItem[];
  /** Ref to the pending-changes flag from useChecklist. When true, warn before navigating. */
  hasPendingChangesRef?: React.RefObject<boolean>;
  /** Called with new slug order when tabs are reordered via drag */
  onReorder?: (slugs: string[]) => void;
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
  Shield,
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={cn(
            "group relative w-full h-14 flex items-center justify-center shrink-0 transition-colors",
            isActive
              ? "bg-blue-50 text-blue-600 border-l-2 border-blue-600"
              : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent",
            isDragging && "bg-blue-100 shadow-sm"
          )}
        >
          {canReorder && (
            <button
              {...attributes}
              {...listeners}
              className="absolute left-0 top-0 bottom-0 w-3 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity touch-none"
              title="Drag to reorder"
            >
              <GripVertical className="h-3 w-3 text-gray-400" />
            </button>
          )}
          <Link
            href={item.href}
            onClick={(e) => {
              if (!confirmNavigation(item.href)) e.preventDefault();
            }}
            className="flex flex-col items-center justify-center gap-1 px-1 w-full h-full"
            aria-label={item.label}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="text-[9px] leading-none text-center w-full truncate">{item.label}</span>
            <StatusDot status={item.status} />
          </Link>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

export function TopNav({ items, hasPendingChangesRef, onReorder }: TopNavProps) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const sortableIds = useMemo(
    () => items.map((item) => item.slug || item.href),
    [items]
  );

  function confirmNavigation(href: string): boolean {
    if (hasPendingChangesRef?.current && href !== pathname) {
      return window.confirm(
        "You have unsaved changes. Your data is being saved — navigate anyway?"
      );
    }
    return true;
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;

    const oldIndex = sortableIds.indexOf(active.id as string);
    const newIndex = sortableIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    onReorder(reordered.map((item) => item.slug || "").filter(Boolean));
  };

  const canReorder = !!onReorder;

  const navContent = (
    <aside
      ref={navRef}
      className="w-14 shrink-0 bg-background border-r border-border flex flex-col overflow-y-auto"
    >
      {items.map((item) => {
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
      })}
    </aside>
  );

  if (canReorder) {
    return (
      <TooltipProvider delayDuration={300}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {navContent}
          </SortableContext>
        </DndContext>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      {navContent}
    </TooltipProvider>
  );
}
