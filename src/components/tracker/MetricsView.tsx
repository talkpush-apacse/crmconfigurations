"use client";

import { useState } from "react";
import { Eye, LineChart, Lock, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/tracker/format";
import { formatMetricValue, metricProgress, type MetricStatus } from "@/lib/tracker/metric-progress";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import { CellBar, Sparkline } from "./charts";
import { MetricDialog, ReadingDialog, type MetricDTO } from "./MetricDialogs";
import { EmptyState, ErrorBlock, LoadingBlock } from "./PageHeader";

const STATUS_TEXT: Record<MetricStatus, string> = {
  met: "Target met",
  improving: "Moving toward target",
  no_change: "No change yet",
  worse: "Moving away from target",
  no_data: "No reading yet",
  no_target: "No target set",
  no_baseline: "No baseline set",
};

export function MetricsView({ projectId, today }: { projectId: string; today: string }) {
  const { data, error, reload } = useApiResource<{ metrics: MetricDTO[]; readings: Record<string, { asOf: string; value: number }[]> }>(
    `/api/tracker/projects/${projectId}/metrics`
  );
  const [editing, setEditing] = useState<MetricDTO | null>(null);
  const [adding, setAdding] = useState(false);
  const [recording, setRecording] = useState<MetricDTO | null>(null);

  if (error && !data) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return <LoadingBlock label="Loading metrics" />;

  const addButton = (
    <Button onClick={() => setAdding(true)}>
      <Plus className="h-4 w-4" />
      Add metric
    </Button>
  );

  return (
    <div className="es-staff">
      <h2 className="sr-only">Success metrics</h2>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Numbers that show whether the project is working. Each has a baseline, a target and a history.</p>
        {data.metrics.length > 0 && addButton}
      </div>

      {data.metrics.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="No success metrics yet"
          description="Add a baseline and a target, for example time to hire from 21 days down to 14. Record readings as you measure."
          action={addButton}
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {data.metrics.map((m) => {
            const prog = metricProgress({ baselineValue: m.baselineValue, currentValue: m.currentValue, targetValue: m.targetValue });
            const history = data.readings[m.id] ?? [];
            return (
              <li key={m.id} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold tracking-tight">{m.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      {m.visibility === "internal" ? <Lock className="h-3 w-3" aria-hidden="true" /> : <Eye className="h-3 w-3" aria-hidden="true" />}
                      {m.visibility === "internal" ? "Team only" : "Visible to the client"}
                      {m.source ? `. Source: ${m.source}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${m.name}`} onClick={() => setEditing(m)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Baseline</dt>
                    <dd className="mt-1 text-sm tabular-nums">{formatMetricValue(m.baselineValue, m.unit)}</dd>
                    {m.baselineDate && <dd className="text-xs text-muted-foreground">{formatDate(m.baselineDate)}</dd>}
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Now</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{formatMetricValue(m.currentValue, m.unit)}</dd>
                    {m.currentAsOf && <dd className="text-xs text-muted-foreground">{formatDate(m.currentAsOf)}</dd>}
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Target</dt>
                    <dd className="mt-1 text-sm tabular-nums">{formatMetricValue(m.targetValue, m.unit)}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-end justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {STATUS_TEXT[prog.status]}
                      {prog.percent !== null && prog.status !== "met" ? `, ${prog.percent}% of the way` : ""}
                    </p>
                    <div className="max-w-xs">
                      <CellBar percent={prog.percent} label={`${m.name}: ${STATUS_TEXT[prog.status]}`} />
                    </div>
                  </div>
                  <Sparkline values={history.map((h) => h.value)} lowerIsBetter={m.direction === "lower_is_better"} label={`${m.name} history, ${history.length} readings`} />
                </div>

                {history.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-muted-foreground">{history.length} reading{history.length === 1 ? "" : "s"}</summary>
                    <ul className="mt-2 space-y-1 tabular-nums">
                      {[...history].reverse().slice(0, 8).map((h, i) => (
                        <li key={`${h.asOf}-${i}`} className="flex justify-between gap-3 text-xs">
                          <span className="text-muted-foreground">{formatDate(h.asOf)}</span>
                          <span>{formatMetricValue(h.value, m.unit)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={() => setRecording(m)}>
                    <Plus className="h-4 w-4" />
                    Record a reading
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <MetricDialog open={adding || !!editing} onOpenChange={(o) => !o && (setAdding(false), setEditing(null))} projectId={projectId} metric={editing} onSaved={reload} />
      <ReadingDialog open={!!recording} onOpenChange={(o) => !o && setRecording(null)} metric={recording} today={today} onSaved={reload} />
    </div>
  );
}
