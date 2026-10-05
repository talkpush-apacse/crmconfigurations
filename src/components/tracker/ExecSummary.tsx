import type { ProjectSnapshot } from "@/lib/tracker/snapshot";
import { formatMetricValue, metricProgress, type MetricStatus } from "@/lib/tracker/metric-progress";
import { joinNames, phaseState } from "@/lib/tracker/phase-state";
import { formatDate, formatShortDate, plural } from "@/lib/tracker/format";
import { ItemStatusBadge } from "./badges";
import { BurnupChart, CellBar, Sparkline } from "./charts";
import { Eyebrow, InsightNote, KpiCard, PhaseFlow, SectionTitle } from "./summary-parts";

type Brief = ProjectSnapshot["needsAttention"]["overdue"][number];
type ClientNote = { id: string; itemTitle: string; body: string; author: string; createdAt: string };

export type ExecSummaryData = ProjectSnapshot & { sharedRemarks?: ClientNote[] };

const SIDE_LABEL: Record<string, string> = { talkpush: "Talkpush", client: "Client", vendor: "Vendor", unassigned: "Unassigned" };

const METRIC_TEXT: Record<MetricStatus, string> = {
  met: "Target met",
  improving: "Moving toward target",
  no_change: "No change yet",
  worse: "Moving away from target",
  no_data: "No reading yet",
  no_target: "No target set",
  no_baseline: "No baseline set",
};

interface Props {
  data: ExecSummaryData;
  /** "staff" uses the Sign accents; "client" uses the executive-report accents. Never both. */
  context: "staff" | "client";
  /** Metric history, staff face only. */
  readings?: Record<string, { asOf: string; value: number }[]>;
  /** Shown above the headline, for example "Internal view". */
  banner?: React.ReactNode;
  /** True when the page around it already has its own h1 (the headline then becomes an h2). */
  embedded?: boolean;
}

function attentionRows(d: ExecSummaryData): { item: Brief; why: string }[] {
  const seen = new Set<string>();
  const rows: { item: Brief; why: string }[] = [];
  const add = (item: Brief, why: string) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    rows.push({ item, why });
  };
  for (const i of d.needsAttention.overdue) add(i, i.dueNote ?? "Overdue");
  for (const i of d.needsAttention.blocked) add(i, i.blockerReason ? `Reason: ${i.blockerReason}` : "");
  for (const i of d.needsAttention.waitingOnClient) add(i, i.waitingOn ?? "");
  return rows;
}

export function ExecSummary({ data, context, readings, banner, embedded = false }: Props) {
  const d = data;
  const Headline = embedded ? "h2" : "h1";
  const rows = attentionRows(d);
  const activePhases = d.phases.filter((p) => phaseState(p) === "in_progress");
  const nextUp = d.phases.find((p) => phaseState(p) === "upcoming");
  const phaseNote =
    activePhases.length === 1
      ? `Now in ${activePhases[0].name}: ${activePhases[0].done} of ${activePhases[0].total} items done.`
      : activePhases.length > 1
        ? `Now in ${joinNames(activePhases.map((p) => `${p.name} (${p.done} of ${p.total} done)`))}.`
        : nextUp
          ? `Next up: ${nextUp.name}, ${nextUp.total} ${nextUp.total === 1 ? "item" : "items"} not started.`
          : d.phases.length > 0 && d.progress.total > 0
            ? "Every phase is complete."
            : "No phase has items yet.";
  const metricsMet = d.metrics.filter((m) => metricProgress({ baselineValue: m.baseline, currentValue: m.current, targetValue: m.target }).status === "met").length;
  const daysToTarget = d.progress.daysToTarget;

  return (
    <div className={`es-${context} rounded-xl border border-[var(--es-line)] bg-[var(--es-bg)] text-[var(--es-ink)]`}>
      <div className="es-gradient h-1.5 rounded-t-xl" aria-hidden="true" />
      <div className="relative p-5 md:p-8">
        {banner && <div className="mb-4">{banner}</div>}

        <div className="relative">
          <span aria-hidden="true" className="absolute right-2 top-1 hidden h-3 w-3 rotate-12 bg-[var(--es-green)] opacity-60 md:block" />
          <span aria-hidden="true" className="absolute right-10 top-8 hidden h-2.5 w-2.5 -rotate-12 bg-[var(--es-pink)] opacity-60 md:block" />
          <span aria-hidden="true" className="absolute right-0 top-14 hidden h-2 w-2 rotate-45 bg-[var(--es-orange)] opacity-60 md:block" />
        <header className="max-w-3xl">
          <Eyebrow>
            Project status, {d.project.account}
          </Eyebrow>
          <Headline className="mt-2 text-[19px] font-bold leading-[1.2] tracking-[-0.03em] md:text-[29px] md:leading-[1.15]">{d.headline}</Headline>
          <p className="mt-2 text-sm text-[var(--es-muted)]">
            {d.project.title}. {d.project.startDate ? `Started ${formatDate(d.project.startDate)}. ` : ""}
            {d.project.targetDate ? `Target ${formatDate(d.project.targetDate)}` : "No target date"}
            {d.project.rescheduleCount > 0 && d.project.originalTargetDate
              ? ` (first planned for ${formatDate(d.project.originalTargetDate)}, moved ${plural(d.project.rescheduleCount, "time")})`
              : ""}
            .
          </p>
        </header>
        </div>

        <section aria-label="Key numbers" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <KpiCard
            label="Days to target"
            value={daysToTarget === null ? "None" : String(Math.abs(daysToTarget))}
            note={daysToTarget === null ? "No target date set" : daysToTarget < 0 ? "past the target date" : "until the target date"}
            tone={daysToTarget !== null && daysToTarget < 0 ? "alert" : undefined}
          />
          <KpiCard label="Done" value={`${d.progress.percentDone}%`} note={`${d.progress.done} of ${d.progress.total} items`} />
          <KpiCard label="Open" value={String(d.progress.open)} note="items still to do" />
          <KpiCard label="Overdue" value={String(d.progress.overdue)} note={d.progress.overdue === 0 ? "nothing late" : "past their due date"} tone={d.progress.overdue > 0 ? "alert" : undefined} />
          <KpiCard label="Blocked" value={String(d.progress.blocked)} note={`${d.progress.waitingOnClient} waiting on the client`} tone={d.progress.blocked > 0 ? "alert" : undefined} />
        </section>

        <section aria-labelledby="es-phases" className="mt-8">
          <SectionTitle id="es-phases">Where the project is</SectionTitle>
          <PhaseFlow phases={d.phases} />
          <InsightNote accent="blue">
            {phaseNote}
            {d.nextMilestone && ` Next milestone: ${d.nextMilestone.title}${d.nextMilestone.dueDate ? `, ${formatShortDate(d.nextMilestone.dueDate, d.asOf)}` : ""}.`}
          </InsightNote>
        </section>

        <section aria-labelledby="es-needed" className="mt-8">
          <SectionTitle id="es-needed">What is still needed</SectionTitle>
          {rows.length > 0 ? (
            <ul className="divide-y divide-[var(--es-line)] overflow-hidden rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)]">
              {rows.map(({ item, why }, idx) => (
                <li key={item.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={idx % 2 ? { background: "var(--es-stripe)" } : undefined}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-[var(--es-muted)]">
                      {item.owner ?? "No owner yet"}
                      {item.ownerSide ? `, ${SIDE_LABEL[item.ownerSide] ?? item.ownerSide}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <ItemStatusBadge status={item.status} />
                    {why && <span className="text-xs text-[var(--es-muted)]">{why}</span>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[10px] border border-dashed border-[var(--es-line)] bg-[var(--es-card)] px-4 py-6 text-center text-sm text-[var(--es-muted)]">
              Nothing is overdue, blocked or waiting on the client right now.
            </p>
          )}

          <h3 className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--es-muted)]">Open items by owner</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {(["talkpush", "client", "vendor", "unassigned"] as const).map((side) => {
              const group = d.openItemsByOwnerSide[side];
              if (!group) return null;
              return (
                <div key={side} className="rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-semibold">{SIDE_LABEL[side]}</p>
                    <p className="text-2xl font-semibold tabular-nums tracking-[-0.03em]">{group.count}</p>
                  </div>
                  {group.items.length === 0 ? (
                    <p className="mt-2 text-xs text-[var(--es-muted)]">Nothing open</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {group.items.slice(0, 5).map((i) => (
                        <li key={i.id} className="truncate text-xs text-[var(--es-muted)]">
                          {i.title}
                        </li>
                      ))}
                      {group.items.length > 5 && <li className="text-xs font-medium">and {group.items.length - 5} more</li>}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="es-plan" className="mt-8">
          <SectionTitle id="es-plan">Progress against plan</SectionTitle>
          {d.burnup ? (
            <>
              <div className="rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-3 md:p-4">
                <BurnupChart
                  data={d.burnup}
                  today={d.asOf}
                  ariaSummary={`Items done against items planned over time. ${d.burnup.insight}`}
                />
              </div>
              <InsightNote accent={d.burnup.behindBy > 0 ? "orange" : "green"}>{d.burnup.insight}</InsightNote>
            </>
          ) : (
            <InsightNote accent="orange">Add due dates to items to see progress against plan. No dated items yet.</InsightNote>
          )}
        </section>

        <section aria-labelledby="es-metrics" className="mt-8">
          <SectionTitle id="es-metrics">Success metrics</SectionTitle>
          {d.metrics.length === 0 ? (
            <InsightNote accent="orange">No success metrics have been set for this project yet.</InsightNote>
          ) : (
            <>
              <div className="overflow-x-auto rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)]">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead>
                    <tr className="bg-[var(--es-ink)] text-white">
                      <th scope="col" className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]">Metric</th>
                      <th scope="col" className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]">Baseline</th>
                      <th scope="col" className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]">Now</th>
                      <th scope="col" className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]">Target</th>
                      <th scope="col" className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]">Progress</th>
                      {readings && <th scope="col" className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]">History</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {d.metrics.map((m, idx) => {
                      const prog = metricProgress({ baselineValue: m.baseline, currentValue: m.current, targetValue: m.target });
                      const history = readings?.[m.id]?.map((r) => r.value) ?? [];
                      return (
                        <tr key={m.id} style={idx % 2 ? { background: "var(--es-stripe)" } : undefined}>
                          <th scope="row" className="px-4 py-3 font-medium">
                            {m.name}
                            {m.asOf && <span className="block text-xs font-normal text-[var(--es-muted)]">as of {formatDate(m.asOf)}</span>}
                          </th>
                          <td className="px-4 py-3 tabular-nums">{formatMetricValue(m.baseline, m.unit)}</td>
                          <td className="px-4 py-3 font-semibold tabular-nums">{formatMetricValue(m.current, m.unit)}</td>
                          <td className="px-4 py-3 tabular-nums">{formatMetricValue(m.target, m.unit)}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs">{METRIC_TEXT[prog.status]}{prog.percent !== null && prog.status !== "met" ? `, ${prog.percent}%` : ""}</span>
                            <CellBar percent={prog.percent} label={`${m.name}: ${METRIC_TEXT[prog.status]}`} />
                          </td>
                          {readings && (
                            <td className="px-4 py-3">
                              <Sparkline values={history} lowerIsBetter={m.direction === "lower_is_better"} label={`${m.name} history`} />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <InsightNote accent={metricsMet > 0 ? "green" : "blue"}>
                {metricsMet === d.metrics.length
                  ? `All ${plural(d.metrics.length, "metric")} have reached their targets.`
                  : `${metricsMet} of ${plural(d.metrics.length, "metric")} ${metricsMet === 1 ? "has" : "have"} reached ${metricsMet === 1 ? "its" : "their"} target.`}
              </InsightNote>
            </>
          )}
        </section>

        {d.sharedRemarks && d.sharedRemarks.length > 0 && (
          <section aria-labelledby="es-notes" className="mt-8">
            <SectionTitle id="es-notes">Notes from the team</SectionTitle>
            <ul className="space-y-2">
              {d.sharedRemarks.map((r) => (
                <li key={r.id} className="rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-4">
                  <p className="text-sm">{r.body}</p>
                  <p className="mt-1 text-xs text-[var(--es-muted)]">
                    {r.author} on {r.itemTitle}, {formatDate(r.createdAt.slice(0, 10))}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {d.dataNotes.length > 0 && (
          <aside aria-label="Data notes" className="mt-8 rounded-[10px] border border-dashed border-[var(--es-line)] bg-[var(--es-card)] p-4">
            <Eyebrow>Data notes</Eyebrow>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
              {d.dataNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </aside>
        )}

        <footer className="mt-10 flex flex-col gap-1 border-t border-[var(--es-line)] pt-4 text-[11px] uppercase tracking-[0.06em] text-[var(--es-muted)] sm:flex-row sm:justify-between">
          <span>Talkpush, Business Operations</span>
          <span>
            As of {formatDate(d.asOf)}
            {context === "client" ? ", Confidential" : ""}
          </span>
        </footer>
      </div>
    </div>
  );
}
