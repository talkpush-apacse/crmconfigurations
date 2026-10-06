"use client";

import { useCurrentUser } from "@/lib/use-current-user";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarRange, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ITEM_STATUS_LABELS, type ItemStatus } from "@/lib/tracker/constants";
import { formatDate, plural } from "@/lib/tracker/format";
import { conflictMessage, findDependencyConflicts } from "@/lib/tracker/schedule";
import { buildTimeline, PX_PER_DAY, type ItemRow, type PhaseRow, type Zoom } from "@/lib/tracker/timeline-layout";
import { cn } from "@/lib/utils";
import { PhaseDatesDialog } from "./PhaseDatesDialog";
import { EmptyState } from "./PageHeader";

const LABEL_W = 288;
const MONTH_H = 26;
const WEEK_H = 28;
const HEADER_H = MONTH_H + WEEK_H;
const PHASE_H = 34;
const ITEM_H = 42;
const BAR_H = 24;

/** What the timeline reads from an item. Staff items and the client-safe plan items both fit. */
export interface TimelineSourceItem {
  id: string;
  title: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  isMilestone: boolean;
  blockedByItemIds: readonly string[];
  phaseId: string | null;
  ownerName: string | null;
  sortOrder: number;
}

export interface TimelineSourcePhase {
  id: string;
  name: string;
  sortOrder: number;
  startDate: string | null;
  endDate: string | null;
}

interface Props<T extends TimelineSourceItem> {
  items: readonly T[];
  phases: readonly TimelineSourcePhase[];
  project: { startDate: string | null; targetDate: string | null; goLiveDate: string | null };
  today: string;
  onOpen: (item: T) => void;
  onPhasesChanged: () => void;
}

type BodyProps<T extends TimelineSourceItem> = Omit<Props<T>, "onOpen" | "onPhasesChanged"> & {
  onOpen?: (item: T) => void;
  onPhasesChanged?: () => void;
  /** Whether this person may change phase dates. Always false on the client face. */
  canEdit: boolean;
  /** The client face: no editing, no staff hints, no schedule-problem list, nothing clickable. */
  readOnly: boolean;
};

/** The staff timeline. Editing controls follow the signed-in person's role. */
export function TimelineView<T extends TimelineSourceItem>(props: Props<T>) {
  const { canEdit } = useCurrentUser();
  return <TimelineBody {...props} canEdit={canEdit} readOnly={false} />;
}

/** The client timeline: the same drawing with nothing to edit, and no call to the staff sign-in check. */
export function ReadOnlyTimeline<T extends TimelineSourceItem>(props: Omit<Props<T>, "onOpen" | "onPhasesChanged">) {
  return <TimelineBody {...props} canEdit={false} readOnly />;
}

/** Bar colour by status, using the existing status tokens. Blocked also gets stripes so colour is never the only cue. */
function barStyle(status: string): { className: string; style?: React.CSSProperties } {
  switch (status) {
    case "done":
      return { className: "bg-status-completed border-foreground/30" };
    case "in_progress":
      return { className: "bg-status-in-progress border-foreground/30" };
    case "waiting_on_client":
      return { className: "bg-status-pending border-foreground/30" };
    case "blocked":
      return {
        className: "bg-status-declined border-foreground/40",
        style: { backgroundImage: "repeating-linear-gradient(135deg, transparent 0 5px, rgba(255,255,255,0.45) 5px 8px)" },
      };
    default:
      return { className: "bg-muted border-foreground/30" };
  }
}

function TimelineBody<T extends TimelineSourceItem>({ items, phases, project, today, onOpen, onPhasesChanged, canEdit, readOnly }: BodyProps<T>) {
  const [zoom, setZoom] = useState<Zoom>("weeks");
  const [phaseDialog, setPhaseDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ppd = PX_PER_DAY[zoom];

  const built = useMemo(
    () =>
      buildTimeline({
        items: items.map((i) => ({
          id: i.id,
          title: i.title,
          status: i.status,
          startDate: i.startDate,
          dueDate: i.dueDate,
          isMilestone: i.isMilestone,
          blockedByItemIds: i.blockedByItemIds,
          phaseId: i.phaseId,
          ownerName: i.ownerName,
          sortOrder: i.sortOrder,
        })),
        phases: phases.map((p) => ({ id: p.id, name: p.name, sortOrder: p.sortOrder, startDate: p.startDate, endDate: p.endDate })),
        project,
        today,
      }),
    [items, phases, project, today]
  );
  // Schedule clashes are a staff warning. A client sees the plan without the red rings and dashed arrows.
  const timeline = useMemo(
    () =>
      built && readOnly
        ? { ...built, rows: built.rows.map((r) => (r.kind === "item" ? { ...r, conflict: false } : r)), arrows: built.arrows.map((a) => ({ ...a, conflict: false })) }
        : built,
    [built, readOnly]
  );

  const dtoById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const openById = (id: string) => {
    const dto = dtoById.get(id);
    if (dto && onOpen) onOpen(dto);
  };

  const conflicts = useMemo(
    () =>
      readOnly ? [] : findDependencyConflicts(
        items.map((i) => ({ id: i.id, title: i.title, status: i.status, startDate: i.startDate, dueDate: i.dueDate, isMilestone: i.isMilestone, blockedByItemIds: i.blockedByItemIds }))
      ),
    [items, readOnly]
  );

  // Start with "today" in view. This only moves the scroll position; it sets no React state.
  const todayDay = timeline?.markers.today ?? null;
  useEffect(() => {
    if (scrollRef.current && todayDay !== null) scrollRef.current.scrollLeft = Math.max(0, todayDay * ppd - 220);
  }, [todayDay, ppd, zoom]);

  if (!timeline) {
    return (
      <>
        <EmptyState
          icon={CalendarRange}
          title="Nothing to draw yet"
          description={
            readOnly
              ? "Dates have not been added to this project yet. The timeline will appear here once they are."
              : "Give items a start or due date, or set the project's dates, and the timeline appears here. You can also ask Claude to build it from a Gantt chart (slide or PDF)."
          }
          action={
            canEdit ? (
              <Button variant="outline" onClick={() => setPhaseDialog(true)}>
                Set phase dates
              </Button>
            ) : undefined
          }
        />
        {!readOnly && <PhaseDatesDialog open={phaseDialog} onOpenChange={setPhaseDialog} phases={phases} onSaved={() => onPhasesChanged?.()} />}
      </>
    );
  }

  const chartW = timeline.days * ppd;
  const rowTop = new Map<string, number>();
  const rowH = new Map<string, number>();
  let y = 0;
  for (const r of timeline.rows) {
    const h = r.kind === "phase" ? PHASE_H : ITEM_H;
    rowTop.set(r.id, y);
    rowH.set(r.id, h);
    y += h;
  }
  const bodyH = y;
  const itemRows = new Map(timeline.rows.filter((r): r is ItemRow => r.kind === "item").map((r) => [r.id, r]));
  const dayX = (d: number) => d * ppd;
  const endX = (r: ItemRow) => (r.item.isMilestone ? (r.endDay + 0.5) * ppd + 8 : (r.endDay + 1) * ppd);
  const startX = (r: ItemRow) => (r.item.isMilestone ? (r.startDay + 0.5) * ppd - 8 : r.startDay * ppd);
  const centerY = (id: string) => (rowTop.get(id) ?? 0) + (rowH.get(id) ?? 0) / 2;
  const weekGrid = `repeating-linear-gradient(to right, transparent 0, transparent ${7 * ppd - 1}px, var(--border) ${7 * ppd - 1}px, var(--border) ${7 * ppd}px)`;
  const markerLines = [
    { day: timeline.markers.today, label: "Today", dash: "3 3", color: "var(--foreground)" },
    { day: timeline.markers.target, label: "Target", dash: "6 4", color: "var(--destructive)" },
    { day: timeline.markers.goLive, label: "Go-live", dash: "6 4", color: "var(--brand-lavender-darker)" },
  ].filter((m) => m.day !== null) as { day: number; label: string; dash: string; color: string }[];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Zoom" className="inline-flex rounded-lg bg-muted p-[3px]">
          {(["weeks", "months"] as Zoom[]).map((z) => (
            <button
              key={z}
              type="button"
              aria-pressed={zoom === z}
              onClick={() => setZoom(z)}
              className={cn("rounded-md px-3 py-1 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70", zoom === z ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {z === "weeks" ? "Weeks" : "Months"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-muted-foreground lg:block">Bars are planned days. Diamonds are milestones. Arrows run from a blocker to the item that waits for it.</p>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setPhaseDialog(true)}>
              Phase dates
            </Button>
          )}
        </div>
      </div>

      {conflicts.length > 0 && (
        <div role="alert" className="mb-3 flex gap-2 rounded-lg border border-status-pending/60 bg-status-pending/15 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            {plural(conflicts.length, "dependency")} {conflicts.length === 1 ? "has" : "have"} a schedule problem. Rows marked with a warning start before the item they wait for is due. Details are below the chart.
          </p>
        </div>
      )}

      <div ref={scrollRef} className="relative max-h-[70vh] overflow-auto rounded-xl border border-border bg-card" role="region" aria-label="Project timeline" tabIndex={0}>
        <div className="relative" style={{ width: LABEL_W + chartW }}>
          {/* header */}
          <div className="sticky top-0 z-30 flex bg-secondary">
            <div className="sticky left-0 z-40 flex items-end border-b border-r border-border bg-secondary px-3 pb-2 text-xs font-semibold uppercase tracking-wider" style={{ width: LABEL_W, height: HEADER_H }}>
              Item
            </div>
            <div className="relative border-b border-border" style={{ width: chartW, height: HEADER_H }}>
              {timeline.months.map((m) => (
                <div key={m.startDay} className="absolute top-0 flex items-center border-l border-border px-2 text-xs font-semibold" style={{ left: dayX(m.startDay), width: m.days * ppd, height: MONTH_H }}>
                  <span className="truncate">{m.label}</span>
                </div>
              ))}
              {timeline.weeks.map((w) => (
                <div key={w.startDay} className="absolute flex items-center border-l border-border px-1.5 text-[11px] tabular-nums text-muted-foreground" style={{ left: dayX(w.startDay), top: MONTH_H, width: 7 * ppd, height: WEEK_H }}>
                  {zoom === "weeks" ? w.label : ""}
                </div>
              ))}
              {markerLines.map((m) => {
                // Today sits centred on its line. Of the two project markers, the earlier one hangs to the left of
                // its line and the later one to the right, so close dates never print on top of each other.
                const others = markerLines.filter((o) => o.label !== "Today" && o.label !== m.label);
                const shift = m.label === "Today" ? "-50%" : others.length > 0 && m.day < others[0].day ? "-100%" : "0%";
                return (
                  <span key={m.label} className="absolute z-10 rounded bg-foreground px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-background" style={{ left: dayX(m.day) + ppd / 2, top: MONTH_H + 6, transform: `translateX(${shift})`, ...(m.label !== "Today" ? { background: m.color } : {}) }}>
                    {m.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* rows */}
          {timeline.rows.map((r) =>
            r.kind === "phase" ? <PhaseRowView key={r.id} row={r} ppd={ppd} chartW={chartW} grid={weekGrid} /> : (
              <div key={r.id} className="flex" style={{ height: ITEM_H }}>
                {readOnly ? (
                  <div className="sticky left-0 z-20 flex flex-col justify-center border-b border-r border-border bg-card px-3 text-left" style={{ width: LABEL_W, height: ITEM_H }}>
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {r.item.isMilestone && <Flag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Milestone" />}
                    {r.conflict && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Starts before a blocker is due" />}
                    <span className="truncate">{r.item.title}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {ITEM_STATUS_LABELS[r.item.status as ItemStatus] ?? r.item.status}
                    {r.item.ownerName ? `. ${r.item.ownerName}` : ""}
                  </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openById(r.id)}
                    className="sticky left-0 z-20 flex flex-col justify-center border-b border-r border-border bg-card px-3 text-left outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/70"
                    style={{ width: LABEL_W, height: ITEM_H }}
                  >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {r.item.isMilestone && <Flag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Milestone" />}
                    {r.conflict && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Starts before a blocker is due" />}
                    <span className="truncate">{r.item.title}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {ITEM_STATUS_LABELS[r.item.status as ItemStatus] ?? r.item.status}
                    {r.item.ownerName ? `. ${r.item.ownerName}` : ""}
                  </span>
                  </button>
                )}
                <div className="relative border-b border-border" style={{ width: chartW, height: ITEM_H, backgroundImage: weekGrid }}>
                  <ItemMark row={r} ppd={ppd} onOpen={readOnly ? undefined : () => openById(r.id)} />
                </div>
              </div>
            )
          )}

          {/* arrows and marker lines, drawn over the rows */}
          <svg aria-hidden="true" className="pointer-events-none absolute z-10" style={{ left: LABEL_W, top: HEADER_H, width: chartW, height: bodyH }}>
            {markerLines.map((m) => (
              <line key={m.label} x1={dayX(m.day) + ppd / 2} x2={dayX(m.day) + ppd / 2} y1={0} y2={bodyH} stroke={m.color} strokeWidth="1.5" strokeDasharray={m.dash} />
            ))}
            {timeline.arrows.map((a) => {
              const from = itemRows.get(a.fromId);
              const to = itemRows.get(a.toId);
              if (!from || !to) return null;
              const x1 = endX(from);
              const x2 = startX(to);
              const y1 = centerY(a.fromId);
              const y2 = centerY(a.toId);
              const lane = y2 + (y1 < y2 ? -ITEM_H / 2 + 4 : ITEM_H / 2 - 4); // run in the gap above or below the waiting row
              const d = x2 >= x1 + 14 ? `M${x1},${y1} H${x1 + 8} V${y2} H${x2 - 4}` : `M${x1},${y1} H${x1 + 8} V${lane} H${x2 - 10} V${y2} H${x2 - 4}`;
              const color = a.conflict ? "var(--destructive)" : "var(--muted-foreground)";
              return (
                <g key={`${a.fromId}>${a.toId}`}>
                  <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray={a.conflict ? "4 3" : undefined} />
                  <polygon points={`${x2},${y2} ${x2 - 6},${y2 - 4} ${x2 - 6},${y2 + 4}`} fill={color} />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {conflicts.length > 0 && (
        <section aria-labelledby="tl-conflicts" className="mt-4">
          <h2 id="tl-conflicts" className="mb-2 text-sm font-semibold">
            Schedule problems
          </h2>
          <ul className="space-y-1 text-sm">
            {conflicts.map((c) => (
              <li key={`${c.blockerId}>${c.itemId}`} className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                <span>{conflictMessage(c)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {timeline.unscheduled.length > 0 && (
        <section aria-labelledby="tl-unscheduled" className="mt-4">
          <h2 id="tl-unscheduled" className="mb-2 text-sm font-semibold">
            Not on the timeline ({timeline.unscheduled.length})
          </h2>
          <p className="mb-2 text-xs text-muted-foreground">{readOnly ? "These items have no start or due date yet." : "These items have no start or due date. Open one to give it dates."}</p>
          <ul className="flex flex-wrap gap-2">
            {timeline.unscheduled.map((i) => (
              <li key={i.id}>
                {readOnly ? (
                  <span className="inline-block rounded-full border border-border bg-card px-3 py-1 text-xs">{i.title}</span>
                ) : (
                  <button type="button" onClick={() => openById(i.id)} className="min-h-8 rounded-full border border-border bg-card px-3 py-1 text-xs outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/70">
                    {i.title}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {timeline.undatedDependencies > 0 && <p className="mt-3 text-xs text-muted-foreground">{plural(timeline.undatedDependencies, "dependency")} cannot be drawn because one of the two items has no dates.</p>}

      {!readOnly && (
        <>
          <p className="mt-4 text-xs text-muted-foreground">
            {canEdit
              ? "Have a Gantt chart? Give it to Claude (slide or PDF) and ask it to build or update this timeline, or ask Claude to draw one from this timeline. Keep a copy under Settings, Files."
              : "You can ask Claude to draw a Gantt chart from this timeline."}
          </p>
          <PhaseDatesDialog open={phaseDialog} onOpenChange={setPhaseDialog} phases={phases} onSaved={() => onPhasesChanged?.()} />
        </>
      )}
    </div>
  );
}

function PhaseRowView({ row, ppd, chartW, grid }: { row: PhaseRow; ppd: number; chartW: number; grid: string }) {
  return (
    <div className="flex bg-secondary/60" style={{ height: PHASE_H }}>
      <div className="sticky left-0 z-20 flex items-center border-b border-r border-border bg-secondary px-3 text-sm font-semibold" style={{ width: LABEL_W, height: PHASE_H }}>
        <span className="truncate">{row.name}</span>
        <span className="ml-2 text-xs font-normal text-muted-foreground">{row.scheduledCount === 0 ? "" : plural(row.scheduledCount, "item")}</span>
      </div>
      <div className="relative border-b border-border" style={{ width: chartW, height: PHASE_H, backgroundImage: grid }}>
        {row.startDay !== null && row.endDay !== null && (
          <div
            className="absolute rounded-[3px] border border-foreground/25 bg-brand-lavender-lighter/70"
            style={{ left: row.startDay * ppd, width: Math.max((row.endDay - row.startDay + 1) * ppd - 2, 6), top: 12, height: 10 }}
            title={`${row.name} phase`}
          />
        )}
      </div>
    </div>
  );
}

function ItemMark({ row, ppd, onOpen }: { row: ItemRow; ppd: number; onOpen?: () => void }) {
  const { item } = row;
  const styles = barStyle(item.status);
  const dates = item.startDate && item.dueDate && item.startDate !== item.dueDate ? `${formatDate(item.startDate)} to ${formatDate(item.dueDate)}` : formatDate(item.dueDate ?? item.startDate);
  const label = `${item.title}. ${ITEM_STATUS_LABELS[item.status as ItemStatus] ?? item.status}. ${dates}${row.conflict ? ". Starts before a blocker is due" : ""}`;
  if (item.isMilestone) {
    const cx = (row.endDay + 0.5) * ppd;
    // A 24px square hit area (the WCAG 2.2 minimum) around a smaller diamond.
    const diamond = <span aria-hidden="true" className={cn("block h-4 w-4 rotate-45 border", styles.className, row.conflict && "ring-2 ring-destructive")} style={styles.style} />;
    if (!onOpen) {
      return (
        <div role="img" aria-label={label} title={label} className="absolute z-[5] flex h-6 w-6 items-center justify-center" style={{ left: cx - 12, top: ITEM_H / 2 - 12 }}>
          {diamond}
        </div>
      );
    }
    return (
      <button type="button" onClick={onOpen} aria-label={label} title={label} className="absolute z-[5] flex h-6 w-6 items-center justify-center outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70" style={{ left: cx - 12, top: ITEM_H / 2 - 12 }}>
        {diamond}
      </button>
    );
  }
  const width = Math.max((row.endDay - row.startDay + 1) * ppd - 2, ppd >= 24 ? 24 : 10);
  if (!onOpen) {
    return (
      <div
        role="img"
        aria-label={label}
        title={label}
        className={cn("absolute z-[5] rounded-[4px] border", styles.className, row.conflict && "ring-2 ring-destructive")}
        style={{ left: row.startDay * ppd, width, top: (ITEM_H - BAR_H) / 2, height: BAR_H, ...styles.style }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={label}
      className={cn("absolute z-[5] rounded-[4px] border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70", styles.className, row.conflict && "ring-2 ring-destructive")}
      style={{ left: row.startDay * ppd, width, top: (ITEM_H - BAR_H) / 2, height: BAR_H, ...styles.style }}
    />
  );
}
