/**
 * How far a success metric has moved from its baseline toward its target.
 * Works for both directions: "lower is better" simply has a target below the
 * baseline, so the same formula applies.
 */

export type MetricStatus = "met" | "improving" | "no_change" | "worse" | "no_data" | "no_target" | "no_baseline";

export interface MetricProgress {
  status: MetricStatus;
  /** 0 to 100, how much of the baseline-to-target distance is covered. Null when it cannot be worked out. */
  percent: number | null;
  /** current minus baseline, when both exist. */
  change: number | null;
}

export function metricProgress(m: {
  baselineValue: number | null;
  currentValue: number | null;
  targetValue: number | null;
}): MetricProgress {
  const { baselineValue: b, currentValue: c, targetValue: t } = m;
  if (c === null) return { status: "no_data", percent: null, change: null };
  if (b === null) return { status: "no_baseline", percent: null, change: null };
  const change = c - b;
  if (t === null || t === b) return { status: "no_target", percent: null, change };

  const ratio = (c - b) / (t - b);
  const percent = Math.min(100, Math.max(0, Math.round(ratio * 100)));
  if (ratio >= 1) return { status: "met", percent: 100, change };
  if (ratio > 0) return { status: "improving", percent, change };
  if (c === b) return { status: "no_change", percent: 0, change };
  return { status: "worse", percent: 0, change };
}

/** "21 days", "18%", "1,250 candidates per week". Thousands separators, no trailing zeros. */
export function formatMetricValue(value: number | null, unit: string): string {
  if (value === null) return "No data";
  const text = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  const u = unit.trim();
  if (u === "%") return `${text}%`;
  return u ? `${text} ${u}` : text;
}
