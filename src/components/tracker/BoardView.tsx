"use client";

import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Flag, Lock, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ItemDTO, PersonDTO } from "@/lib/tracker/client-types";
import { ITEM_STATUSES, ITEM_STATUS_LABELS, OPEN_ITEM_STATUSES, type ItemStatus } from "@/lib/tracker/constants";
import { computeGlobalOrder, dropAnchor } from "@/lib/tracker/board-order";
import { describeDue, overdueDays } from "@/lib/tracker/dates";
import { unmetDependencies } from "@/lib/tracker/dependencies";
import { formatShortDate } from "@/lib/tracker/format";
import { cn } from "@/lib/utils";
import { BlockReasonDialog } from "./BlockReasonDialog";
import { ItemStatusBadge } from "./badges";

const COLUMNS: ItemStatus[] = ["not_started", "in_progress", "waiting_on_client", "blocked", "done"];
const ALL = "__all";
const UNASSIGNED = "__unassigned";
const colId = (s: string) => `col:${s}`;

interface Props {
  items: ItemDTO[];
  people: PersonDTO[];
  today: string;
  onOpen: (item: ItemDTO) => void;
  /** Resolve with an error message to show, or null on success. */
  onStatusChange: (item: ItemDTO, status: ItemStatus, blockerReason?: string) => Promise<string | null>;
  onReorder: (itemIds: string[]) => Promise<string | null>;
}

interface CardProps {
  item: ItemDTO;
  today: string;
  unmet: number;
  onOpen: (item: ItemDTO) => void;
  onMove: (item: ItemDTO, status: ItemStatus) => void;
}

function CardBody({ item, today, unmet, onMove }: { item: ItemDTO; today: string; unmet: number; onMove?: CardProps["onMove"] }) {
  const open = (OPEN_ITEM_STATUSES as readonly string[]).includes(item.status);
  const late = open && overdueDays(item.dueDate, today) > 0;
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-medium leading-snug">
          {item.isMilestone && <Flag className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-muted-foreground" aria-label="Milestone" />}
          {item.visibility === "internal" && <Lock className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-muted-foreground" aria-label="Team only" />}
          {item.title}
        </p>
        {onMove && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Move ${item.title} to another status`}
                className="-mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 md:size-8"
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {ITEM_STATUSES.map((s) => (
                <DropdownMenuItem key={s} disabled={s === item.status} onSelect={() => onMove(item, s)} className="cursor-pointer">
                  Move to {ITEM_STATUS_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {item.status === "blocked" && item.blockerReason && <p className="mt-1 text-xs text-muted-foreground">Blocked: {item.blockerReason}</p>}
      {item.status === "waiting_on_client" && item.waitingOn && <p className="mt-1 text-xs text-muted-foreground">Waiting on {item.waitingOn}</p>}
      {unmet > 0 && item.status !== "done" && item.status !== "dropped" && (
        <p className="mt-1 text-xs text-muted-foreground">Waiting for {unmet} other item{unmet === 1 ? "" : "s"}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{item.ownerName ?? "Unassigned"}</span>
        {item.dueDate && (
          <span className={cn("tabular-nums", late && "font-medium text-destructive")}>
            {late ? describeDue(item.dueDate, today) : formatShortDate(item.dueDate, today)}
          </span>
        )}
      </div>
    </>
  );
}

function SortableCard({ item, today, unmet, onOpen, onMove, suppressClick }: CardProps & { suppressClick: React.RefObject<boolean> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      // dnd-kit marks the node role="button"; the card also holds a Move button, and buttons must not nest.
      role="listitem"
      aria-label={`${item.title}. ${ITEM_STATUS_LABELS[item.status as ItemStatus] ?? item.status}. Press space to pick up, enter to open.`}
      className={cn(
        "cursor-grab touch-manipulation list-none rounded-lg border border-border bg-card p-3 shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
      onClick={() => {
        if (!suppressClick.current) onOpen(item);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) {
          e.preventDefault();
          onOpen(item);
          return;
        }
        listeners?.onKeyDown?.(e);
      }}
    >
      <CardBody item={item} today={today} unmet={unmet} onMove={onMove} />
    </li>
  );
}

function Column({ status, items, children }: { status: ItemStatus; items: ItemDTO[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: colId(status) });
  return (
    <section aria-label={`${ITEM_STATUS_LABELS[status]}, ${items.length} items`} className="flex w-72 shrink-0 snap-start flex-col rounded-xl border border-border bg-secondary/60 2xl:w-auto 2xl:min-w-56 2xl:flex-1">
      <header className="flex items-center justify-between gap-2 px-3 py-3">
        <ItemStatusBadge status={status} />
        <span className="text-xs font-medium tabular-nums text-muted-foreground">{items.length}</span>
      </header>
      <ul ref={setNodeRef} className={cn("flex min-h-24 flex-1 flex-col gap-2 rounded-b-xl p-2 pt-0 transition-colors", isOver && "bg-primary/5")}>
        {children}
        {items.length === 0 && <li className="list-none rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">No items</li>}
      </ul>
    </section>
  );
}

export function BoardView({ items, people, today, onOpen, onStatusChange, onReorder }: Props) {
  const [ownerFilter, setOwnerFilter] = useState(ALL);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pendingBlock, setPendingBlock] = useState<{ item: ItemDTO; order: string[] | null } | null>(null);
  const suppressClick = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] } })
  );

  const sorted = useMemo(() => [...items].sort((a, b) => a.sortOrder - b.sortOrder), [items]);
  const statusById = useMemo(() => new Map(items.map((i) => [i.id, i.status])), [items]);
  const edges = useMemo(() => items.flatMap((i) => i.blockedByItemIds.map((b) => ({ itemId: i.id, blockedByItemId: b }))), [items]);
  const visible = useMemo(
    () => sorted.filter((i) => (ownerFilter === ALL ? true : ownerFilter === UNASSIGNED ? !i.ownerPersonId : i.ownerPersonId === ownerFilter)),
    [sorted, ownerFilter]
  );
  const byColumn = useMemo(() => {
    const map = new Map<string, ItemDTO[]>(COLUMNS.map((s) => [s, []]));
    for (const i of visible) map.get(i.status)?.push(i);
    return map;
  }, [visible]);
  const droppedCount = visible.filter((i) => i.status === "dropped").length;
  const activeItem = activeId ? items.find((i) => i.id === activeId) ?? null : null;
  const unmet = (item: ItemDTO) => unmetDependencies(item.id, edges, statusById).length;

  const move = async (item: ItemDTO, status: ItemStatus, order: string[] | null = null) => {
    setMessage("");
    if (status === "blocked") {
      setPendingBlock({ item, order });
      return;
    }
    const err = await onStatusChange(item, status);
    if (err) {
      setMessage(err);
      return;
    }
    if (order) {
      const reorderErr = await onReorder(order);
      if (reorderErr) setMessage(reorderErr);
    }
  };

  const confirmBlock = async (reason: string): Promise<string | null> => {
    if (!pendingBlock) return null;
    const err = await onStatusChange(pendingBlock.item, "blocked", reason);
    if (err) return err;
    if (pendingBlock.order) await onReorder(pendingBlock.order);
    setPendingBlock(null);
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    suppressClick.current = true;
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const { active, over } = event;
    if (!over) return;
    const dragged = items.find((i) => i.id === active.id);
    if (!dragged) return;

    const overId = String(over.id);
    const overItem = overId.startsWith("col:") ? null : items.find((i) => i.id === overId) ?? null;
    const targetStatus = (overId.startsWith("col:") ? overId.slice(4) : overItem?.status) as ItemStatus | undefined;
    if (!targetStatus || !COLUMNS.includes(targetStatus)) return;

    const columnIds = (byColumn.get(targetStatus) ?? []).map((i) => i.id);
    const anchor = dropAnchor(columnIds, dragged.id, overItem ? overItem.id : null);
    const globalIds = sorted.map((i) => i.id);
    const order = computeGlobalOrder(globalIds, dragged.id, anchor);
    const orderChanged = order.some((id, idx) => id !== globalIds[idx]);

    if (targetStatus !== dragged.status) {
      await move(dragged, targetStatus, orderChanged ? order : null);
    } else if (orderChanged) {
      setMessage("");
      const err = await onReorder(order);
      if (err) setMessage(err);
    }
  };

  const announcements = {
    onDragStart: ({ active }: { active: { id: string | number } }) => `Picked up ${items.find((i) => i.id === active.id)?.title ?? "item"}.`,
    onDragOver: ({ over }: { over: { id: string | number } | null }) => {
      if (!over) return "Not over a column.";
      const id = String(over.id);
      const status = id.startsWith("col:") ? id.slice(4) : items.find((i) => i.id === id)?.status;
      return status ? `Over ${ITEM_STATUS_LABELS[status as ItemStatus] ?? status}.` : "";
    },
    onDragEnd: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) => {
      const title = items.find((i) => i.id === active.id)?.title ?? "Item";
      if (!over) return `${title} was dropped outside a column.`;
      const id = String(over.id);
      const status = id.startsWith("col:") ? id.slice(4) : items.find((i) => i.id === id)?.status;
      return `${title} dropped in ${ITEM_STATUS_LABELS[status as ItemStatus] ?? "a column"}.`;
    },
    onDragCancel: ({ active }: { active: { id: string | number } }) => `Moving ${items.find((i) => i.id === active.id)?.title ?? "item"} was cancelled.`,
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger aria-label="Filter by owner" className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All owners</SelectItem>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            {people.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {droppedCount > 0 && <p className="text-xs text-muted-foreground">{droppedCount} dropped item{droppedCount === 1 ? " is" : "s are"} hidden. Find {droppedCount === 1 ? "it" : "them"} in the List view.</p>}
      </div>

      {message && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {message}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{ announcements }}
        onDragStart={handleDragStart}
        onDragEnd={(e) => void handleDragEnd(e)}
        onDragCancel={() => {
          setActiveId(null);
          suppressClick.current = false;
        }}
      >
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0">
          {COLUMNS.map((status) => {
            const list = byColumn.get(status) ?? [];
            return (
              <Column key={status} status={status} items={list}>
                <SortableContext items={list.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  {list.map((item) => (
                    <SortableCard key={item.id} item={item} today={today} unmet={unmet(item)} onOpen={onOpen} onMove={(i, s) => void move(i, s)} suppressClick={suppressClick} />
                  ))}
                </SortableContext>
              </Column>
            );
          })}
        </div>
        <DragOverlay>
          {activeItem ? (
            <div className="rotate-1 rounded-lg border border-border bg-card p-3 shadow-lg">
              <CardBody item={activeItem} today={today} unmet={unmet(activeItem)} onMove={undefined} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <BlockReasonDialog item={pendingBlock?.item ?? null} onCancel={() => setPendingBlock(null)} onConfirm={confirmBlock} />
    </div>
  );
}
