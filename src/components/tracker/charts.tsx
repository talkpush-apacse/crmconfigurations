import { formatShortDate } from "@/lib/tracker/format";

/**
 * Hand-built SVG charts (no chart library). Rules from the Chartosaur playbook:
 * bars and lines start at zero, two colours at most, direct labels instead of a
 * legend, and every chart has a text summary for screen readers. The caller adds
 * the insight note underneath.
 */

export interface BurnupSeries {
  points: { date: string; planned: number; actual: number | null }[];
  total: number;
}

export function BurnupChart({ data, today, ariaSummary }: { data: BurnupSeries; today: string; ariaSummary: string }) {
  const W = 640;
  const H = 240;
  const padL = 36;
  const padR = 92; // room for the direct labels
  const padT = 16;
  const padB = 30;
  const pts = data.points;
  const t0 = Date.parse(`${pts[0].date}T00:00:00Z`);
  const t1 = Date.parse(`${pts[pts.length - 1].date}T00:00:00Z`);
  const x = (d: string) => padL + ((Date.parse(`${d}T00:00:00Z`) - t0) / Math.max(1, t1 - t0)) * (W - padL - padR);
  const maxY = Math.max(1, data.total, ...pts.map((p) => p.planned));
  const y = (v: number) => padT + (1 - v / maxY) * (H - padT - padB);

  const planned = pts.map((p) => `${x(p.date).toFixed(1)},${y(p.planned).toFixed(1)}`).join(" ");
  const actualPts = pts.filter((p) => p.actual !== null);
  const actual = actualPts.map((p) => `${x(p.date).toFixed(1)},${y(p.actual as number).toFixed(1)}`).join(" ");
  const lastActual = actualPts[actualPts.length - 1];
  const lastPlanned = pts[pts.length - 1];
  const showToday = today > pts[0].date && today < lastPlanned.date;

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaSummary} className="h-auto w-full">
        {/* zero line and top line only: no gridline clutter */}
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="var(--es-line)" strokeWidth="1" />
        <text x={padL - 6} y={y(0) + 4} textAnchor="end" fontSize="11" fill="var(--es-muted)">0</text>
        <line x1={padL} x2={W - padR} y1={y(maxY)} y2={y(maxY)} stroke="var(--es-line)" strokeWidth="1" strokeDasharray="2 4" />
        <text x={padL - 6} y={y(maxY) + 4} textAnchor="end" fontSize="11" fill="var(--es-muted)">{maxY}</text>

        {showToday && (
          <g>
            <line x1={x(today)} x2={x(today)} y1={padT} y2={y(0)} stroke="var(--es-ink)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={x(today)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--es-ink)">Today</text>
          </g>
        )}

        <polyline points={planned} fill="none" stroke="var(--es-muted)" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
        {actual && <polyline points={actual} fill="none" stroke="var(--es-ink)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
        {lastActual && <circle cx={x(lastActual.date)} cy={y(lastActual.actual as number)} r="5" fill="var(--es-green)" stroke="var(--es-ink)" strokeWidth="2" />}

        {/* direct labels */}
        <text x={x(lastPlanned.date) + 8} y={y(lastPlanned.planned) + 4} fontSize="12" fill="var(--es-muted)">Planned {lastPlanned.planned}</text>
        {lastActual && (
          <text x={Math.min(x(lastActual.date) + 8, W - padR + 4)} y={y(lastActual.actual as number) + (showToday ? 16 : 4)} fontSize="12" fontWeight="600" fill="var(--es-ink)">
            Done {lastActual.actual}
          </text>
        )}

        <text x={padL} y={H - 10} fontSize="11" fill="var(--es-muted)">{formatShortDate(pts[0].date, today)}</text>
        <text x={W - padR} y={H - 10} textAnchor="end" fontSize="11" fill="var(--es-muted)">{formatShortDate(lastPlanned.date, today)}</text>
      </svg>
    </figure>
  );
}

/** Tiny line for a metric's history. Not a chart on its own: it always sits beside the numbers. */
export function Sparkline({ values, lowerIsBetter, label }: { values: number[]; lowerIsBetter: boolean; label: string }) {
  if (values.length < 2) return <span className="text-xs text-[var(--es-muted)]">{values.length === 0 ? "No readings" : "One reading"}</span>;
  const W = 96;
  const H = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (W - 6) + 3).toFixed(1)},${(H - 4 - ((v - min) / span) * (H - 8)).toFixed(1)}`).join(" ");
  const last = values[values.length - 1];
  const first = values[0];
  const improved = lowerIsBetter ? last < first : last > first;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-7 w-24">
      <polyline points={pts} fill="none" stroke={improved ? "var(--es-ink)" : "var(--es-muted)"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** A thin bar inside a table cell, always beside the number (never instead of it). */
export function CellBar({ percent, label }: { percent: number | null; label: string }) {
  if (percent === null) return null;
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={label} className="mt-1 h-1.5 w-full max-w-[9rem] overflow-hidden rounded-full bg-[var(--es-stripe)]">
      <div className="h-full rounded-full bg-[var(--es-green-strong)]" style={{ width: `${percent}%` }} />
    </div>
  );
}
