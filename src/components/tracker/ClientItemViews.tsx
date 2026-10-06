"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Flag } from "lucide-react";
import type { ClientView } from "@/lib/tracker/client-view";
import { describeDue, overdueDays } from "@/lib/tracker/dates";
import { unmetDependencies } from "@/lib/tracker/dependencies";
import { formatShortDate } from "@/lib/tracker/format";
import { ITEM_STATUS_LABELS, OPEN_ITEM_STATUSES, type ItemStatus } from "@/lib/tracker/constants";
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
import { cn } from "@/lib/utils";
import { ItemStatusBadge } from "./badges";

/**
 * List and Board for the client links. They read only the --es-* colours and only the fields the client-safe `plan`
 * carries. On a contributor link `onOpen` is given and each item title opens the item panel; on a view-only link it is
 * not, so the titles are plain text. Nothing here can edit or drag an item by itself.
 */

export type PlanItem = ClientView["plan"]["items"][number];
type PlanPhase = ClientView["plan"]["phases"][number];

const SIDE_LABEL: Record<string, string> = { talkpush: "Talkpush", client: "Client", vendor: "Vendor" };
const isOpen = (status: string) => (OPEN_ITEM_STATUSES as readonly string[]).includes(status);

function useUnmet(items: readonly PlanItem[]) {
  return useMemo(() => {
    const statusById = new Map(items.map((i) => [i.id, i.status]));
    const edges = items.flatMap((i) => i.blockedByItemIds.map((b) => ({ itemId: i.id, blockedByItemId: b })));
    return (item: PlanItem) => unmetDependencies(item.id, edges, statusById).length;
  }, [items]);
}

function ItemNotes({ item, unmet }: { item: PlanItem; unmet: number }) {
  const waiting = item.status === "waiting_on_client" && item.waitingOn;
  const pending = unmet > 0 && item.status !== "done";
  if (!waiting && !pending) return null;
  return (
    <>
      {waiting && <span className="mt-0.5 block text-xs text-[var(--es-muted)]">Waiting on {item.waitingOn}</span>}
      {pending && <span className="mt-0.5 block text-xs text-[var(--es-muted)]">Waiting for {unmet} other item{unmet === 1 ? "" : "s"}</span>}
    </>
  );
}

function Title({ item, onOpen }: { item: PlanItem; onOpen?: (id: string) => void }) {
  const content = (
    <>
      {item.isMilestone && <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--es-muted)]" aria-label="Milestone" />}
      <span>{item.title}</span>
    </>
  );
  if (!onOpen) return <span className="inline-flex items-start gap-1.5 font-medium">{content}</span>;
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      aria-label={`Open ${item.title}`}
      className="inline-flex min-h-8 items-start gap-1.5 rounded text-left font-medium underline decoration-[var(--es-line)] underline-offset-4 outline-none hover:decoration-[var(--es-ink)] focus-visible:ring-[3px] focus-visible:ring-[var(--es-ink)]/40"
    >
      {content}
    </button>
  );
}

function Due({ item, today }: { item: PlanItem; today: string }) {
  if (!item.dueDate) return <span className="text-[var(--es-muted)]">No due date</span>;
  const late = isOpen(item.status) && overdueDays(item.dueDate, today) > 0;
  return (
    <>
      <span className="tabular-nums">{formatShortDate(item.dueDate, today)}</span>
      {late && <span className="block text-xs font-medium text-[var(--es-red)]">{describeDue(item.dueDate, today)}</span>}
    </>
  );
}

function Owner({ item }: { item: PlanItem }) {
  if (!item.ownerName) return <span className="text-[var(--es-muted)]">No owner yet</span>;
  return (
    <>
      {item.ownerName}
      {item.ownerSide && <span className="block text-xs text-[var(--es-muted)]">{SIDE_LABEL[item.ownerSide] ?? item.ownerSide}</span>}
    </>
  );
}

const ALL = "__all";
const OPEN = "__open";
const NO_OWNER = "__no_owner";
const NO_PHASE = "__no_phase";

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-10 w-full rounded-lg border border-[var(--es-line)] bg-[var(--es-card)] px-3 text-sm text-[var(--es-ink)] outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--es-ink)]/40 md:w-auto"
    >
      {children}
    </select>
  );
}

function SortHeader({ label, sortKey, sort, onSort }: { label: string; sortKey: SortKey; sort: SortState; onSort: (key: SortKey) => void }) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={ariaSort(sort, sortKey)} className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]">
      <button type="button" onClick={() => onSort(sortKey)} className="-mx-1 inline-flex min-h-8 items-center gap-1 rounded px-1 uppercase tracking-[0.1em] outline-none focus-visible:ring-[3px] focus-visible:ring-white/60">
        {label}
        <Icon className={cn("h-3 w-3", active ? "opacity-100" : "opacity-60")} aria-hidden="true" />
      </button>
    </th>
  );
}

export function ClientItemsList({ items, phases, today, onOpen }: { items: readonly PlanItem[]; phases: readonly PlanPhase[]; today: string; onOpen?: (id: string) => void }) {
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [ownerFilter, setOwnerFilter] = useState(ALL);
  const [phaseFilter, setPhaseFilter] = useState(ALL);
  const [dueFilter, setDueFilter] = useState<DueFilter>("any");
  const [sort, setSort] = useState<SortState>(null);
  const unmet = useUnmet(items);
  const phaseOrder = useMemo(() => new Map(phases.map((p, i) => [p.id, i])), [phases]);
  const openCount = items.filter((i) => isOpen(i.status)).length;
  const owners = useMemo(() => [...new Set(items.map((i) => i.ownerName).filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b)), [items]);
  const hasUnowned = items.some((i) => !i.ownerName);
  const statuses = useMemo(() => (Object.keys(ITEM_STATUS_LABELS) as ItemStatus[]).filter((s) => items.some((i) => i.status === s)), [items]);
  const visible = useMemo(
    () =>
      sortRows(
        items
          .filter((i) => (statusFilter === ALL ? true : statusFilter === OPEN ? isOpen(i.status) : i.status === statusFilter))
          .filter((i) => (ownerFilter === ALL ? true : ownerFilter === NO_OWNER ? !i.ownerName : i.ownerName === ownerFilter))
          .filter((i) => (phaseFilter === ALL ? true : phaseFilter === NO_PHASE ? !i.phaseId : i.phaseId === phaseFilter))
          .filter((i) => matchesDue(i, dueFilter, today)),
        sort,
        phaseOrder
      ),
    [items, statusFilter, ownerFilter, phaseFilter, dueFilter, today, sort, phaseOrder]
  );
  const filtersActive = statusFilter !== ALL || ownerFilter !== ALL || phaseFilter !== ALL || dueFilter !== "any";
  const clearFilters = () => {
    setStatusFilter(ALL);
    setOwnerFilter(ALL);
    setPhaseFilter(ALL);
    setDueFilter("any");
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 md:flex md:flex-row md:flex-wrap md:items-center md:gap-3">
        <FilterSelect label="Filter by status" value={statusFilter} onChange={setStatusFilter}>
          <option value={ALL}>All items ({items.length})</option>
          <option value={OPEN}>Open items only ({openCount})</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {ITEM_STATUS_LABELS[s]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Filter by owner" value={ownerFilter} onChange={setOwnerFilter}>
          <option value={ALL}>All owners</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          {hasUnowned && <option value={NO_OWNER}>No owner yet</option>}
        </FilterSelect>
        <FilterSelect label="Filter by phase" value={phaseFilter} onChange={setPhaseFilter}>
          <option value={ALL}>All phases</option>
          {phases.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value={NO_PHASE}>No phase</option>
        </FilterSelect>
        <FilterSelect label="Filter by due date" value={dueFilter} onChange={(v) => setDueFilter(v as DueFilter)}>
          {DUE_FILTERS.map((f) => (
            <option key={f} value={f}>
              {DUE_FILTER_LABELS[f]}
            </option>
          ))}
        </FilterSelect>
        <div className="col-span-2 md:hidden">
          <FilterSelect label="Sort by" value={sortToValue(sort)} onChange={(v) => setSort(sortFromValue(v))}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value === "default" ? o.label : `Sort: ${o.label}`}
              </option>
            ))}
          </FilterSelect>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[var(--es-line)] bg-[var(--es-card)] px-4 py-10 text-center text-sm text-[var(--es-muted)]">
          {items.length === 0 ? (
            "No items have been shared on this project yet."
          ) : (
            <>
              No items match these filters.{" "}
              {filtersActive && (
                <button type="button" className="font-medium text-[var(--es-ink)] underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--es-ink)]/40" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </>
          )}
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[var(--es-ink)] text-white">
                  {(["item", "status", "owner", "phase", "due"] as const).map((key) => (
                    <SortHeader key={key} label={SORT_KEY_LABELS[key]} sortKey={key} sort={sort} onSort={(k) => setSort(nextSort(sort, k))} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((item, idx) => (
                  <tr key={item.id} className="align-top" style={idx % 2 ? { background: "var(--es-stripe)" } : undefined}>
                    <th scope="row" className="max-w-md px-4 py-3 text-left font-normal">
                      <Title item={item} onOpen={onOpen} />
                      <ItemNotes item={item} unmet={unmet(item)} />
                    </th>
                    <td className="px-4 py-3">
                      <ItemStatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Owner item={item} />
                    </td>
                    <td className="px-4 py-3">{item.phaseName ?? <span className="text-[var(--es-muted)]">No phase</span>}</td>
                    <td className="px-4 py-3">
                      <Due item={item} today={today} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {visible.map((item) => (
              <li key={item.id} className="rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-4 text-sm">
                <Title item={item} onOpen={onOpen} />
                <ItemNotes item={item} unmet={unmet(item)} />
                <div className="mt-2">
                  <ItemStatusBadge status={item.status} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--es-muted)]">Owner</dt>
                    <dd>
                      <Owner item={item} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--es-muted)]">Due</dt>
                    <dd>
                      <Due item={item} today={today} />
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const COLUMNS: ItemStatus[] = ["not_started", "in_progress", "waiting_on_client", "blocked", "done"];

export function ClientBoard({ items, today, onOpen }: { items: readonly PlanItem[]; today: string; onOpen?: (id: string) => void }) {
  const unmet = useUnmet(items);
  const sorted = useMemo(() => [...items].sort((a, b) => a.sortOrder - b.sortOrder), [items]);
  return (
    <div className="-mx-4 flex snap-x scroll-pl-4 gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:scroll-pl-0 md:px-0" role="region" aria-label="Project board" tabIndex={0}>
      {COLUMNS.map((status) => {
        const list = sorted.filter((i) => i.status === status);
        return (
          <section key={status} aria-label={`${ITEM_STATUS_LABELS[status]}, ${list.length} items`} className="flex w-64 shrink-0 snap-start flex-col rounded-[10px] border border-[var(--es-line)] bg-[var(--es-stripe)]">
            <header className="flex items-center justify-between gap-2 px-3 py-3">
              <ItemStatusBadge status={status} />
              <span className="text-xs font-medium tabular-nums text-[var(--es-muted)]">{list.length}</span>
            </header>
            <ul className="flex min-h-24 flex-1 flex-col gap-2 p-2 pt-0">
              {list.map((item) => {
                const late = isOpen(item.status) && overdueDays(item.dueDate, today) > 0;
                return (
                  <li key={item.id} className="rounded-lg border border-[var(--es-line)] bg-[var(--es-card)] p-3 text-sm">
                    <p className="font-medium leading-snug">
                      {item.isMilestone && <Flag className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-[var(--es-muted)]" aria-label="Milestone" />}
                      {onOpen ? (
                        <button type="button" onClick={() => onOpen(item.id)} aria-label={`Open ${item.title}`} className="rounded text-left underline decoration-[var(--es-line)] underline-offset-4 outline-none hover:decoration-[var(--es-ink)] focus-visible:ring-[3px] focus-visible:ring-[var(--es-ink)]/40">
                          {item.title}
                        </button>
                      ) : (
                        item.title
                      )}
                    </p>
                    <ItemNotes item={item} unmet={unmet(item)} />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[var(--es-muted)]">
                      <span>{item.ownerName ?? "No owner yet"}</span>
                      {item.dueDate && <span className={cn("tabular-nums", late && "font-medium text-[var(--es-red)]")}>{late ? describeDue(item.dueDate, today) : formatShortDate(item.dueDate, today)}</span>}
                    </div>
                  </li>
                );
              })}
              {list.length === 0 && <li className="rounded-lg border border-dashed border-[var(--es-line)] px-3 py-6 text-center text-xs text-[var(--es-muted)]">No items</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
