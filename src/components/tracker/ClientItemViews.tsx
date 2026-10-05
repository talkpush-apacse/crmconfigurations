"use client";

import { useMemo, useState } from "react";
import { Flag } from "lucide-react";
import type { ClientView } from "@/lib/tracker/client-view";
import { describeDue, overdueDays } from "@/lib/tracker/dates";
import { unmetDependencies } from "@/lib/tracker/dependencies";
import { formatShortDate } from "@/lib/tracker/format";
import { ITEM_STATUS_LABELS, OPEN_ITEM_STATUSES, type ItemStatus } from "@/lib/tracker/constants";
import { cn } from "@/lib/utils";
import { ItemStatusBadge } from "./badges";

/**
 * Read-only List and Board for the client link. They read only the --es-* colours and
 * only the fields the client-safe `plan` carries. Nothing here can edit, drag or open an item.
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

function Title({ item }: { item: PlanItem }) {
  return (
    <span className="inline-flex items-start gap-1.5 font-medium">
      {item.isMilestone && <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--es-muted)]" aria-label="Milestone" />}
      <span>{item.title}</span>
    </span>
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

export function ClientItemsList({ items, phases, today }: { items: readonly PlanItem[]; phases: readonly PlanPhase[]; today: string }) {
  const [scope, setScope] = useState<"open" | "all">("open");
  const unmet = useUnmet(items);
  const phaseOrder = useMemo(() => new Map(phases.map((p, i) => [p.id, i])), [phases]);
  const openCount = items.filter((i) => isOpen(i.status)).length;
  const visible = useMemo(
    () =>
      items
        .filter((i) => scope === "all" || isOpen(i.status))
        .sort((a, b) => (a.phaseId ? (phaseOrder.get(a.phaseId) ?? 99) : 100) - (b.phaseId ? (phaseOrder.get(b.phaseId) ?? 99) : 100) || a.sortOrder - b.sortOrder),
    [items, scope, phaseOrder]
  );

  return (
    <div>
      <div role="group" aria-label="Which items to show" className="mb-4 inline-flex rounded-lg bg-[var(--es-line)] p-[3px]">
        {(
          [
            ["open", `Open items (${openCount})`],
            ["all", `All items (${items.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={scope === value}
            onClick={() => setScope(value)}
            className={cn(
              "min-h-9 rounded-md px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--es-ink)]/40",
              scope === value ? "bg-[var(--es-card)] font-medium shadow-sm" : "text-[var(--es-muted)] hover:text-[var(--es-ink)]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[var(--es-line)] bg-[var(--es-card)] px-4 py-10 text-center text-sm text-[var(--es-muted)]">
          {items.length === 0 ? "No items have been shared on this project yet." : "No open items right now."}
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[var(--es-ink)] text-white">
                  {["Item", "Status", "Owner", "Phase", "Due"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((item, idx) => (
                  <tr key={item.id} className="align-top" style={idx % 2 ? { background: "var(--es-stripe)" } : undefined}>
                    <th scope="row" className="max-w-md px-4 py-3 text-left font-normal">
                      <Title item={item} />
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
                <Title item={item} />
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

export function ClientBoard({ items, today }: { items: readonly PlanItem[]; today: string }) {
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
                      {item.title}
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
