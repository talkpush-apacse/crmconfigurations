import type { ItemDTO, PhaseDTO } from "@/lib/tracker/client-types";
import { ITEM_STATUS_LABELS, type ItemStatus } from "@/lib/tracker/constants";
import { formatDate, plural } from "@/lib/tracker/format";
import { fitPxPerDay, paginateRows, truncateText, weekLabelStep } from "@/lib/tracker/print-layout";
import { buildTimeline, type ItemRow, type PhaseRow } from "@/lib/tracker/timeline-layout";

/**
 * The Gantt chart for paper. The whole date range is squeezed to the page width (it is vector, so it stays sharp),
 * and the rows are cut into pages with the date header repeated on each. Dependency arrows are drawn when both
 * items are on the same page; the item list below the chart names every dependency, so none is lost.
 */

const WIDTH = 1040; // A4 landscape, 10 mm side margins, in CSS pixels
const LABEL_W = 250;
const CHART_W = WIDTH - LABEL_W;
const MONTH_H = 18;
const WEEK_H = 16;
const HEADER_H = MONTH_H + WEEK_H;
const PHASE_H = 24;
const ITEM_H = 30;
const BAR_H = 12;
/** Vertical room per page in pixels, after the page margins, the date header and the legend. */
const FIRST_PAGE_BUDGET = 450;
const PAGE_BUDGET = 585;
const LABEL_CHARS = Math.floor((LABEL_W - 16) / 5.4);

const FILL: Record<string, string> = {
  done: "var(--status-completed)",
  in_progress: "var(--status-in-progress)",
  waiting_on_client: "var(--status-pending)",
  blocked: "var(--status-declined)",
};

interface Props {
  items: ItemDTO[];
  phases: PhaseDTO[];
  project: { startDate: string | null; targetDate: string | null; goLiveDate: string | null };
  today: string;
}

type Row = PhaseRow | ItemRow;

export function TimelinePrint({ items, phases, project, today }: Props) {
  const timeline = buildTimeline({
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
  });

  if (!timeline) {
    return <p className="print-empty">Nothing to draw yet. Give items a start or due date, or set the project&apos;s dates, and the timeline appears.</p>;
  }

  const ppd = fitPxPerDay(timeline.days, CHART_W);
  const weekStep = weekLabelStep(ppd);
  const pages = paginateRows<Row>(timeline.rows, { phase: PHASE_H, item: ITEM_H }, FIRST_PAGE_BUDGET, PAGE_BUDGET);
  const titleById = new Map(items.map((i) => [i.id, i.title]));
  const dependencies = items.filter((i) => i.status !== "dropped" && i.blockedByItemIds.length > 0 && timeline.rows.some((r) => r.id === i.id));

  const lines = [
    { label: "Today", day: timeline.markers.today, date: today, dash: "2 3", color: "var(--foreground)" },
    { label: "Target", day: timeline.markers.target, date: project.targetDate, dash: "6 4", color: "var(--destructive)" },
    { label: "Go-live", day: timeline.markers.goLive, date: project.goLiveDate, dash: "6 4", color: "var(--brand-lavender-darker)" },
  ].filter((m): m is typeof m & { day: number } => m.day !== null);

  return (
    <>
      {pages.map((rows, pageIndex) => (
        <section key={pageIndex} className={pageIndex < pages.length - 1 ? "print-page-break" : undefined} aria-label={`Timeline, page ${pageIndex + 1} of ${pages.length}`}>
          <ChartPage rows={rows} timeline={timeline} ppd={ppd} weekStep={weekStep} lines={lines} pageIndex={pageIndex} />
          <Legend lines={lines} />
        </section>
      ))}

      {dependencies.length > 0 && (
        <section className="print-after">
          <h2 className="print-h2">Dependencies</h2>
          <ul className="print-list">
            {dependencies.map((i) => (
              <li key={i.id}>
                <strong>{i.title}</strong> waits for {i.blockedByItemIds.map((b) => titleById.get(b)).filter(Boolean).join("; ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      {timeline.unscheduled.length > 0 && (
        <section className="print-after">
          <h2 className="print-h2">Not on the timeline ({timeline.unscheduled.length})</h2>
          <p className="print-note">These items have no start or due date.</p>
          <ul className="print-list">
            {timeline.unscheduled.map((i) => (
              <li key={i.id}>{i.title}</li>
            ))}
          </ul>
        </section>
      )}
      {timeline.undatedDependencies > 0 && <p className="print-note">{plural(timeline.undatedDependencies, "dependency")} cannot be drawn because one of the two items has no dates.</p>}
    </>
  );
}

function Legend({ lines }: { lines: { label: string; date: string | null; dash: string; color: string }[] }) {
  return (
    <ul className="print-legend" aria-label="Legend">
      {(["not_started", "in_progress", "waiting_on_client", "blocked", "done"] as const).map((s) => (
        <li key={s}>
          <svg width="16" height="10" aria-hidden="true">
            <rect x="0.5" y="0.5" width="15" height="9" rx="2" style={{ fill: FILL[s] ?? "var(--muted)", stroke: "var(--foreground)", strokeOpacity: 0.35 }} />
          </svg>
          {ITEM_STATUS_LABELS[s as ItemStatus]}
        </li>
      ))}
      <li>
        <svg width="12" height="12" aria-hidden="true">
          <polygon points="6,0.5 11.5,6 6,11.5 0.5,6" style={{ fill: "var(--muted)", stroke: "var(--foreground)", strokeOpacity: 0.5 }} />
        </svg>
        Milestone
      </li>
      {lines.map((l) => (
        <li key={l.label}>
          <svg width="18" height="10" aria-hidden="true">
            <line x1="0" x2="18" y1="5" y2="5" strokeWidth="2" strokeDasharray={l.dash} style={{ stroke: l.color }} />
          </svg>
          {l.label}
          {l.date ? ` ${formatDate(l.date)}` : ""}
        </li>
      ))}
    </ul>
  );
}

function ChartPage({
  rows,
  timeline,
  ppd,
  weekStep,
  lines,
  pageIndex,
}: {
  rows: Row[];
  timeline: NonNullable<ReturnType<typeof buildTimeline>>;
  ppd: number;
  weekStep: number;
  lines: { label: string; day: number; dash: string; color: string }[];
  pageIndex: number;
}) {
  const tops = new Map<string, number>();
  const heights = new Map<string, number>();
  let y = 0;
  for (const r of rows) {
    const h = r.kind === "phase" ? PHASE_H : ITEM_H;
    tops.set(r.id, y);
    heights.set(r.id, h);
    y += h;
  }
  const bodyH = y;
  const x = (day: number) => LABEL_W + day * ppd;
  const itemRows = new Map(rows.filter((r): r is ItemRow => r.kind === "item").map((r) => [r.id, r]));
  const midY = (id: string) => HEADER_H + (tops.get(id) ?? 0) + (heights.get(id) ?? 0) / 2;
  const endX = (r: ItemRow) => (r.item.isMilestone ? x(r.endDay + 0.5) + 8 : x(r.endDay + 1));
  const startX = (r: ItemRow) => (r.item.isMilestone ? x(r.startDay + 0.5) - 8 : x(r.startDay));
  const patternId = `stripes-${pageIndex}`;

  return (
    <svg className="print-timeline" width={WIDTH} height={HEADER_H + bodyH + 1} viewBox={`0 0 ${WIDTH} ${HEADER_H + bodyH + 1}`} role="img" aria-label="Project timeline">
      <defs>
        <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="6" fill="rgba(255,255,255,0.55)" />
        </pattern>
      </defs>

      {/* date header */}
      <rect x="0" y="0" width={WIDTH} height={HEADER_H} style={{ fill: "var(--secondary)" }} />
      <text x="8" y={HEADER_H - 6} fontSize="9" fontWeight="700" letterSpacing="0.8" style={{ fill: "var(--foreground)" }}>
        ITEM
      </text>
      {timeline.months.map((m) => (
        <g key={m.startDay}>
          <line x1={x(m.startDay)} x2={x(m.startDay)} y1="0" y2={HEADER_H + bodyH} style={{ stroke: "var(--border)" }} strokeWidth="1" />
          {m.days * ppd >= 34 && (
            <text x={x(m.startDay) + 4} y={MONTH_H - 5} fontSize="10" fontWeight="700" style={{ fill: "var(--foreground)" }}>
              {m.label}
            </text>
          )}
        </g>
      ))}
      {timeline.weeks.map((w, i) => (
        <g key={w.startDay}>
          <line x1={x(w.startDay)} x2={x(w.startDay)} y1={MONTH_H} y2={HEADER_H + bodyH} style={{ stroke: "var(--border)" }} strokeWidth="0.5" strokeOpacity={i % weekStep === 0 ? 0.9 : 0.4} />
          {i % weekStep === 0 && (
            <text x={x(w.startDay) + 2} y={HEADER_H - 4} fontSize="8" style={{ fill: "var(--muted-foreground)" }}>
              {w.label}
            </text>
          )}
        </g>
      ))}

      {/* rows */}
      {rows.map((r) => {
        const top = HEADER_H + (tops.get(r.id) ?? 0);
        if (r.kind === "phase") {
          return (
            <g key={r.id}>
              <rect x="0" y={top} width={WIDTH} height={PHASE_H} style={{ fill: "var(--secondary)" }} fillOpacity="0.7" />
              <text x="8" y={top + 16} fontSize="11" fontWeight="700" style={{ fill: "var(--foreground)" }}>
                {truncateText(r.name, LABEL_CHARS - 8)}
                {r.scheduledCount > 0 && (
                  <tspan fontSize="9" fontWeight="400" dx="6" style={{ fill: "var(--muted-foreground)" }}>
                    {plural(r.scheduledCount, "item")}
                  </tspan>
                )}
              </text>
              {r.startDay !== null && r.endDay !== null && (
                <rect x={x(r.startDay)} y={top + 8} width={Math.max((r.endDay - r.startDay + 1) * ppd - 1, 4)} height="8" rx="2" style={{ fill: "var(--brand-lavender-lighter)", stroke: "var(--foreground)", strokeOpacity: 0.25 }} />
              )}
            </g>
          );
        }
        const status = r.item.status;
        const fill = FILL[status] ?? "var(--muted)";
        const barY = top + (ITEM_H - BAR_H) / 2;
        const stroke = r.conflict ? "var(--destructive)" : "var(--foreground)";
        return (
          <g key={r.id}>
            <line x1="0" x2={WIDTH} y1={top + ITEM_H} y2={top + ITEM_H} style={{ stroke: "var(--border)" }} strokeWidth="0.5" />
            <text x="8" y={top + 13} fontSize="10.5" fontWeight="600" style={{ fill: "var(--foreground)" }}>
              {r.item.isMilestone ? "◆ " : ""}
              {truncateText(r.item.title, LABEL_CHARS - (r.item.isMilestone ? 2 : 0))}
            </text>
            <text x="8" y={top + 24} fontSize="8.5" style={{ fill: "var(--muted-foreground)" }}>
              {truncateText(`${ITEM_STATUS_LABELS[status as ItemStatus] ?? status}${r.item.ownerName ? `. ${r.item.ownerName}` : ""}`, LABEL_CHARS + 6)}
            </text>
            {r.item.isMilestone ? (
              <polygon
                points={`${x(r.endDay + 0.5)},${top + ITEM_H / 2 - 7} ${x(r.endDay + 0.5) + 7},${top + ITEM_H / 2} ${x(r.endDay + 0.5)},${top + ITEM_H / 2 + 7} ${x(r.endDay + 0.5) - 7},${top + ITEM_H / 2}`}
                style={{ fill, stroke }}
                strokeOpacity={r.conflict ? 1 : 0.5}
                strokeWidth={r.conflict ? 1.5 : 1}
              />
            ) : (
              <>
                <rect x={x(r.startDay)} y={barY} width={Math.max((r.endDay - r.startDay + 1) * ppd - 1, 3)} height={BAR_H} rx="3" style={{ fill, stroke }} strokeOpacity={r.conflict ? 1 : 0.4} strokeWidth={r.conflict ? 1.5 : 1} />
                {status === "blocked" && <rect x={x(r.startDay)} y={barY} width={Math.max((r.endDay - r.startDay + 1) * ppd - 1, 3)} height={BAR_H} rx="3" fill={`url(#${patternId})`} />}
              </>
            )}
          </g>
        );
      })}

      {/* marker lines and arrows */}
      {lines.map((l) => (
        <line key={l.label} x1={x(l.day + 0.5)} x2={x(l.day + 0.5)} y1={HEADER_H} y2={HEADER_H + bodyH} strokeWidth="1.5" strokeDasharray={l.dash} style={{ stroke: l.color }} />
      ))}
      {timeline.arrows.map((a) => {
        const from = itemRows.get(a.fromId);
        const to = itemRows.get(a.toId);
        if (!from || !to) return null; // the two items are on different pages
        const x1 = endX(from);
        const x2 = startX(to);
        const y1 = midY(a.fromId);
        const y2 = midY(a.toId);
        const lane = y2 + (y1 < y2 ? -ITEM_H / 2 + 3 : ITEM_H / 2 - 3);
        const d = x2 >= x1 + 12 ? `M${x1},${y1} H${x1 + 6} V${y2} H${x2 - 3}` : `M${x1},${y1} H${x1 + 6} V${lane} H${x2 - 8} V${y2} H${x2 - 3}`;
        const color = a.conflict ? "var(--destructive)" : "var(--muted-foreground)";
        return (
          <g key={`${a.fromId}>${a.toId}`}>
            <path d={d} fill="none" strokeWidth="1.2" strokeDasharray={a.conflict ? "4 3" : undefined} style={{ stroke: color }} />
            <polygon points={`${x2},${y2} ${x2 - 5},${y2 - 3} ${x2 - 5},${y2 + 3}`} style={{ fill: color }} />
          </g>
        );
      })}
      <rect x="0.5" y="0.5" width={WIDTH - 1} height={HEADER_H + bodyH} fill="none" style={{ stroke: "var(--border)" }} />
    </svg>
  );
}
