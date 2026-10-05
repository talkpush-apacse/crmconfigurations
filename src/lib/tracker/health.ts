import {
  HEALTH_THRESHOLDS,
  HEALTH_LEVELS,
  OPEN_ITEM_STATUSES,
  type HealthLevel,
} from "./constants";
import { addDays, overdueDays } from "./dates";

export interface HealthItem {
  status: string;
  dueDate: string | null;
  isMilestone: boolean;
  archived: boolean;
  title?: string;
  /** Added by a client and not yet reviewed by staff: left out of the health maths. */
  needsReview?: boolean;
}

export interface HealthProject {
  status: string;
  targetDate: string | null;
  healthOverride: string | null;
  healthOverrideNote: string | null;
}

export interface HealthResult {
  /** What the project shows: the override when one is set, otherwise the calculated level. */
  level: HealthLevel;
  calculatedLevel: HealthLevel;
  overridden: boolean;
  overrideNote: string | null;
  /** Plain-language reasons for the calculated level, worst first. Empty when on track. */
  reasons: string[];
}

function isOpen(item: HealthItem): boolean {
  return !item.archived && (OPEN_ITEM_STATUSES as readonly string[]).includes(item.status);
}

export function isHealthLevel(value: unknown): value is HealthLevel {
  return typeof value === "string" && (HEALTH_LEVELS as readonly string[]).includes(value);
}

/** Calculate project health. Pure: `today` is passed in. */
export function computeHealth(
  project: HealthProject,
  items: readonly HealthItem[],
  today: string
): HealthResult {
  const t = HEALTH_THRESHOLDS;
  const offTrack: string[] = [];
  const atRisk: string[] = [];
  const open = items.filter((i) => isOpen(i) && !i.needsReview);

  // Off track
  for (const m of open.filter((i) => i.isMilestone)) {
    const late = overdueDays(m.dueDate, today);
    if (late > t.offTrackMilestoneOverdueDays) {
      offTrack.push(`Milestone "${m.title ?? "Untitled"}" is ${late} days overdue.`);
    }
  }
  if (project.status !== "completed") {
    const late = overdueDays(project.targetDate, today);
    if (late > t.offTrackTargetOverdueDays) {
      offTrack.push(`The target date passed ${late} days ago.`);
    }
  }

  // At risk
  const blocked = open.filter((i) => i.status === "blocked").length;
  if (blocked >= t.atRiskBlockedItems) {
    atRisk.push(`${blocked} items are blocked.`);
  }
  const soon = addDays(today, t.atRiskNotStartedDueWithinDays);
  const notStartedSoon = open.filter(
    (i) => i.status === "not_started" && i.dueDate !== null && i.dueDate <= soon && i.dueDate >= today
  ).length;
  if (notStartedSoon > 0) {
    atRisk.push(
      `${notStartedSoon} item${notStartedSoon === 1 ? " is" : "s are"} due within ${t.atRiskNotStartedDueWithinDays} days and not started.`
    );
  }
  const overdue = open.filter((i) => overdueDays(i.dueDate, today) > 0).length;
  if (overdue > 0) {
    atRisk.push(`${overdue} open item${overdue === 1 ? " is" : "s are"} overdue.`);
  }

  let calculated: HealthLevel = "on_track";
  if (project.status !== "completed") {
    if (offTrack.length > 0) calculated = "off_track";
    else if (atRisk.length > 0) calculated = "at_risk";
  }

  const overridden = isHealthLevel(project.healthOverride);
  return {
    level: overridden ? (project.healthOverride as HealthLevel) : calculated,
    calculatedLevel: calculated,
    overridden,
    overrideNote: overridden ? project.healthOverrideNote : null,
    reasons: project.status === "completed" ? [] : [...offTrack, ...atRisk],
  };
}
