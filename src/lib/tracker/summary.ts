import { OPEN_ITEM_STATUSES } from "./constants";
import { daysBetween, overdueDays } from "./dates";
import { computeHealth, type HealthItem, type HealthProject, type HealthResult } from "./health";

export interface SummaryItem extends HealthItem {
  title: string;
  ownerSide?: string | null;
}

export interface ProjectSummary {
  total: number;
  done: number;
  open: number;
  overdue: number;
  blocked: number;
  waitingOnClient: number;
  /** Whole percent of countable items (everything except dropped and archived). */
  percentDone: number;
  /** Negative when the target date has passed; null when no target date. */
  daysToTarget: number | null;
  nextMilestone: { title: string; dueDate: string | null } | null;
  health: HealthResult;
}

/** Numbers shown on the portfolio rows and, later, the exec summary KPI strip. */
export function summarizeProject(
  project: HealthProject,
  items: readonly SummaryItem[],
  today: string
): ProjectSummary {
  const live = items.filter((i) => !i.archived);
  const countable = live.filter((i) => i.status !== "dropped");
  const open = live.filter((i) => (OPEN_ITEM_STATUSES as readonly string[]).includes(i.status));
  const done = countable.filter((i) => i.status === "done").length;

  const upcomingMilestones = open
    .filter((i) => i.isMilestone)
    .sort((a, b) => (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99"));
  const next = upcomingMilestones[0];

  return {
    total: countable.length,
    done,
    open: open.length,
    overdue: open.filter((i) => overdueDays(i.dueDate, today) > 0).length,
    blocked: open.filter((i) => i.status === "blocked").length,
    waitingOnClient: open.filter((i) => i.status === "waiting_on_client").length,
    percentDone: countable.length === 0 ? 0 : Math.round((done / countable.length) * 100),
    daysToTarget: project.targetDate ? daysBetween(today, project.targetDate) : null,
    nextMilestone: next ? { title: next.title, dueDate: next.dueDate } : null,
    health: computeHealth(project, live, today),
  };
}
