"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Flag, Lock, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tag } from "./PlanParts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ItemDTO, PersonDTO, PhaseDTO } from "@/lib/tracker/client-types";
import { ITEM_STATUSES, ITEM_STATUS_LABELS, OPEN_ITEM_STATUSES, type ItemStatus } from "@/lib/tracker/constants";
import { unmetDependencies } from "@/lib/tracker/dependencies";
import { describeDue, overdueDays } from "@/lib/tracker/dates";
import { formatShortDate } from "@/lib/tracker/format";
import {
  DUE_FILTERS,
  DUE_FILTER_LABELS,
  SORT_KEY_LABELS,
  SORT_OPTIONS,
  ariaSort,
  matchesDue,
  nextSort,
  sortFromValue,
  sortRows,
  sortToValue,
  type DueFilter,
  type SortKey,
  type SortState,
} from "@/lib/tracker/list-controls";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { BlockReasonDialog } from "./BlockReasonDialog";
import { NONE } from "./Field";
import { ItemStatusBadge } from "./badges";
import { JiraLinkChips, jiraLinksOf } from "./JiraLinks";

const SEARCH_THRESHOLD = 8;
const ALL = "__all";
const REVIEW = "__review";
const OPEN = "__open";
const UNASSIGNED = "__unassigned";

interface Props {
  items: ItemDTO[];
  phases: PhaseDTO[];
  people: PersonDTO[];
  today: string;
  onOpen: (item: ItemDTO) => void;
  /** Resolve with an error message to show, or null on success. */
  onStatusChange: (item: ItemDTO, status: ItemStatus, blockerReason?: string) => Promise<string | null>;
}

function StatusMenu({ item, onPick, readOnly }: { item: ItemDTO; onPick: (status: ItemStatus) => void; readOnly?: boolean }) {
  if (readOnly) return <ItemStatusBadge status={item.status} />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Change status of ${item.title}. Currently ${ITEM_STATUS_LABELS[item.status as ItemStatus] ?? item.status}`}
          className="inline-flex min-h-11 items-center gap-1 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:min-h-8"
          onClick={(e) => e.stopPropagation()}
        >
          <ItemStatusBadge status={item.status} />
          <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {ITEM_STATUSES.map((s) => (
          <DropdownMenuItem key={s} disabled={s === item.status} onSelect={() => onPick(s)} className="cursor-pointer">
            {ITEM_STATUS_LABELS[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortableHead({ label, sortKey, sort, onSort }: { label: string; sortKey: SortKey; sort: SortState; onSort: (key: SortKey) => void }) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead aria-sort={ariaSort(sort, sortKey)} className="text-xs font-semibold uppercase tracking-wider">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="-mx-1 inline-flex min-h-8 items-center gap-1 rounded px-1 uppercase tracking-wider outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {label}
        <Icon className={cn("h-3 w-3", active ? "text-foreground" : "text-muted-foreground")} aria-hidden="true" />
      </button>
    </TableHead>
  );
}

export function ItemsList({ items, phases, people, today, onOpen, onStatusChange }: Props) {
  const { canEdit } = useCurrentUser();
  const [statusFilter, setStatusFilter] = useState(ALL);
  const reviewCount = items.filter((i) => i.needsReview).length;
  const [ownerFilter, setOwnerFilter] = useState(ALL);
  const [phaseFilter, setPhaseFilter] = useState(ALL);
  const [dueFilter, setDueFilter] = useState<DueFilter>("any");
  const [sort, setSort] = useState<SortState>(null);
  const [query, setQuery] = useState("");
  const [pendingBlock, setPendingBlock] = useState<ItemDTO | null>(null);
  const [rowError, setRowError] = useState("");

  const phaseOrder = useMemo(() => new Map(phases.map((p, i) => [p.id, i])), [phases]);
  const statusById = useMemo(() => new Map(items.map((i) => [i.id, i.status])), [items]);
  const edges = useMemo(() => items.flatMap((i) => i.blockedByItemIds.map((b) => ({ itemId: i.id, blockedByItemId: b }))), [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items
      .filter((i) => {
        if (statusFilter === REVIEW) return i.needsReview;
        if (statusFilter === OPEN) return (OPEN_ITEM_STATUSES as readonly string[]).includes(i.status);
        if (statusFilter === ALL) return true;
        return i.status === statusFilter;
      })
      .filter((i) => (ownerFilter === ALL ? true : ownerFilter === UNASSIGNED ? !i.ownerPersonId : i.ownerPersonId === ownerFilter))
      .filter((i) => (phaseFilter === ALL ? true : phaseFilter === NONE ? !i.phaseId : i.phaseId === phaseFilter))
      .filter((i) => !q || i.title.toLowerCase().includes(q))
      .filter((i) => matchesDue(i, dueFilter, today));
    return sortRows(filtered, sort, phaseOrder);
  }, [items, statusFilter, ownerFilter, phaseFilter, dueFilter, query, today, sort, phaseOrder]);

  // Done and dropped items that the "Open items only" filter is hiding, counted against the owner, phase and search
  // filters so the number matches what "Show all" would reveal.
  const hiddenClosed = useMemo(() => {
    const counts = { done: 0, dropped: 0 };
    if (statusFilter !== OPEN) return counts;
    const q = query.trim().toLowerCase();
    for (const i of items) {
      if (i.status !== "done" && i.status !== "dropped") continue;
      if (ownerFilter !== ALL && (ownerFilter === UNASSIGNED ? i.ownerPersonId : i.ownerPersonId !== ownerFilter)) continue;
      if (phaseFilter !== ALL && (phaseFilter === NONE ? i.phaseId : i.phaseId !== phaseFilter)) continue;
      if (q && !i.title.toLowerCase().includes(q)) continue;
      if (!matchesDue(i, dueFilter, today)) continue;
      counts[i.status] += 1;
    }
    return counts;
  }, [items, statusFilter, ownerFilter, phaseFilter, dueFilter, query, today]);

  const filtersActive = statusFilter !== ALL || ownerFilter !== ALL || phaseFilter !== ALL || dueFilter !== "any" || query.trim() !== "";
  const clearFilters = () => {
    setStatusFilter(ALL);
    setOwnerFilter(ALL);
    setPhaseFilter(ALL);
    setDueFilter("any");
    setQuery("");
  };

  const pick = async (item: ItemDTO, status: ItemStatus) => {
    setRowError("");
    if (status === "blocked") {
      setPendingBlock(item);
      return;
    }
    const err = await onStatusChange(item, status);
    if (err) setRowError(err);
  };

  const confirmBlock = async (reason: string): Promise<string | null> => {
    if (!pendingBlock) return null;
    const err = await onStatusChange(pendingBlock, "blocked", reason);
    if (!err) setPendingBlock(null);
    return err;
  };

  const dueCell = (item: ItemDTO) => {
    if (!item.dueDate) return <span className="text-muted-foreground">No due date</span>;
    const late = (OPEN_ITEM_STATUSES as readonly string[]).includes(item.status) && overdueDays(item.dueDate, today) > 0;
    return (
      <>
        <span className="tabular-nums">{formatShortDate(item.dueDate, today)}</span>
        {late && <span className="block text-xs font-medium text-destructive">{describeDue(item.dueDate, today)}</span>}
      </>
    );
  };

  const ownerCell = (item: ItemDTO) =>
    item.ownerName ? (
      <>
        {item.ownerName}
        <span className="block text-xs capitalize text-muted-foreground">{item.ownerSide}</span>
      </>
    ) : (
      <span className="text-muted-foreground">Unassigned</span>
    );

  const unmet = (item: ItemDTO) => unmetDependencies(item.id, edges, statusById).length;

  const titleCell = (item: ItemDTO) => (
    <>
      <span className="inline-flex items-center gap-1.5 font-medium">
        {item.isMilestone && <Flag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Milestone" />}
        {item.visibility === "internal" && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Team only" />}
        <span>{item.title}</span>
        {item.needsReview ? <Tag>Needs review</Tag> : item.createdVia === "client" ? <Tag>Added by client</Tag> : null}
      </span>
      {item.status === "blocked" && item.blockerReason && <span className="mt-0.5 block text-xs text-muted-foreground">Blocked: {item.blockerReason}</span>}
      {item.status === "waiting_on_client" && item.waitingOn && <span className="mt-0.5 block text-xs text-muted-foreground">Waiting on {item.waitingOn}</span>}
      {unmet(item) > 0 && item.status !== "done" && item.status !== "dropped" && (
        <span className="mt-0.5 block text-xs text-muted-foreground">Waiting for {unmet(item)} other item{unmet(item) === 1 ? "" : "s"}</span>
      )}
    </>
  );

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 md:flex md:flex-row md:flex-wrap md:items-center md:gap-3">
        {items.length >= SEARCH_THRESHOLD && (
          <div className="relative col-span-2 md:col-span-1 md:max-w-xs md:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input aria-label="Search items" placeholder="Search items" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filter by status" className="w-full md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={OPEN}>Open items only</SelectItem>
            <SelectItem value={ALL}>All items</SelectItem>
            {(reviewCount > 0 || statusFilter === REVIEW) && <SelectItem value={REVIEW}>Needs review ({reviewCount})</SelectItem>}
            {ITEM_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ITEM_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger aria-label="Filter by owner" className="w-full md:w-48">
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
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger aria-label="Filter by phase" className="w-full md:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All phases</SelectItem>
            <SelectItem value={NONE}>No phase</SelectItem>
            {phases.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dueFilter} onValueChange={(v) => setDueFilter(v as DueFilter)}>
          <SelectTrigger aria-label="Filter by due date" className="w-full md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DUE_FILTERS.map((f) => (
              <SelectItem key={f} value={f}>
                {DUE_FILTER_LABELS[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortToValue(sort)} onValueChange={(v) => setSort(sortFromValue(v))}>
          <SelectTrigger aria-label="Sort by" className="col-span-2 w-full md:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.value === "default" ? o.label : `Sort: ${o.label}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rowError && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {rowError}
        </p>
      )}

      {hiddenClosed.done + hiddenClosed.dropped > 0 && (
        <p className="mb-3 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground" role="status">
          <span>
            {hiddenClosed.done > 0 && `${hiddenClosed.done} done item${hiddenClosed.done === 1 ? "" : "s"}`}
            {hiddenClosed.done > 0 && hiddenClosed.dropped > 0 && " and "}
            {hiddenClosed.dropped > 0 && `${hiddenClosed.dropped} dropped item${hiddenClosed.dropped === 1 ? "" : "s"}`} hidden by the Open items only filter.
          </span>
          <button type="button" className="font-medium text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setStatusFilter(ALL)}>
            Show all
          </button>
        </p>
      )}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {items.length === 0 ? (
            "No items yet. Add the first one."
          ) : (
            <>
              No items match these filters.{" "}
              {filtersActive && (
                <button type="button" className="font-medium text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </>
          )}
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary hover:bg-secondary">
                  {(["item", "status", "owner", "phase", "due"] as const).map((key) => (
                    <SortableHead key={key} label={SORT_KEY_LABELS[key]} sortKey={key} sort={sort} onSort={(k) => setSort(nextSort(sort, k))} />
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => onOpen(item)}>
                    <TableCell className="max-w-md whitespace-normal py-3">
                      <button type="button" className="min-h-6 py-0.5 text-left outline-none focus-visible:underline" onClick={() => onOpen(item)}>
                        {titleCell(item)}
                      </button>
                      <JiraLinkChips links={jiraLinksOf(item.links)} />
                    </TableCell>
                    <TableCell>
                      <StatusMenu item={item} onPick={(s) => void pick(item, s)} readOnly={!canEdit} />
                    </TableCell>
                    <TableCell>{ownerCell(item)}</TableCell>
                    <TableCell>{item.phaseName ?? <span className="text-muted-foreground">No phase</span>}</TableCell>
                    <TableCell>{dueCell(item)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-3 md:hidden">
            {visible.map((item) => (
              <li key={item.id} className={cn("rounded-lg border border-border bg-card p-4")}>
                <button type="button" className="block min-h-11 w-full text-left" onClick={() => onOpen(item)}>
                  {titleCell(item)}
                </button>
                <JiraLinkChips links={jiraLinksOf(item.links)} />
                <div className="mt-2">
                  <StatusMenu item={item} onPick={(s) => void pick(item, s)} readOnly={!canEdit} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">Owner</dt>
                    <dd>{ownerCell(item)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">Due</dt>
                    <dd>{dueCell(item)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}

      <BlockReasonDialog item={pendingBlock} onCancel={() => setPendingBlock(null)} onConfirm={confirmBlock} />
    </div>
  );
}
