import { HEALTH_LABELS, HEALTH_THRESHOLDS, OPEN_ITEM_STATUSES, type HealthLevel } from "./constants";
import { addDays, daysBetween, describeDue, overdueDays } from "./dates";
import { formatDate, plural } from "./format";
import { buildBurnup, burnupInsight } from "./burnup";
import type { HealthResult } from "./health";

/**
 * "Where are we now, and what is still open?" as plain data.
 * Pure: the caller loads the rows and passes `today`. The MCP summary tool uses
 * this today and the Phase 3 exec summary will reuse it, so both always agree.
 */

export interface SnapshotItem {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  isMilestone: boolean;
  archived: boolean;
  ownerName: string | null;
  ownerSide: string | null;
  phaseId: string | null;
  blockerReason: string | null;
  waitingOn: string | null;
  visibility: string;
  /** Added by a client and not yet reviewed by staff. */
  needsReview?: boolean;
}

export interface SnapshotInput {
  project: {
    id: string;
    title: string;
    accountName: string;
    status: string;
    startDate: string | null;
    targetDate: string | null;
    originalTargetDate: string | null;
    goLiveDate: string | null;
    rescheduleCount: number;
    owner: { name: string } | null;
    sponsor: { name: string } | null;
  };
  health: HealthResult;
  items: readonly SnapshotItem[];
  phases: readonly { id: string; name: string }[];
  metrics?: readonly {
    id: string;
    name: string;
    unit: string;
    direction: string;
    baselineValue: number | null;
    targetValue: number | null;
    currentValue: number | null;
    currentAsOf: string | null;
  }[];
  checklist?: { clientName: string; completeCount: number; totalCount: number } | null;
  recentActivity?: readonly { action: string; entityTitle: string | null; actorLabel: string; via: string; createdAt: string }[];
  today: string;
}

const isOpen = (i: SnapshotItem) => !i.archived && (OPEN_ITEM_STATUSES as readonly string[]).includes(i.status);

function brief(i: SnapshotItem, today: string) {
  return {
    id: i.id,
    title: i.title,
    owner: i.ownerName,
    ownerSide: i.ownerSide,
    isMilestone: i.isMilestone,
    status: i.status,
    dueDate: i.dueDate,
    dueNote: describeDue(i.dueDate, today),
    blockerReason: i.status === "blocked" ? i.blockerReason : null,
    waitingOn: i.status === "waiting_on_client" ? i.waitingOn : null,
  };
}

/**
 * One finding-first sentence for the top of a summary. Hard part first, no hype,
 * and never hides a problem the health level does not cover: a single blocked or
 * overdue item, or a project behind plan, leads the sentence even when the health
 * pill still says "on track". (The pill is computed in health.ts; this only words it.)
 */
export function buildHeadline(input: {
  level: HealthLevel;
  firstReason: string | null;
  targetDate: string | null;
  projectStatus: string;
  waitingOnClientCount: number;
  clientOwnedOpenCount: number;
  blockedCount?: number;
  overdueCount?: number;
  /** Items the burn-up says the project is behind plan by; 0 or absent when on or ahead of plan. */
  behindPlanBy?: number;
}): string {
  if (input.projectStatus === "completed") return "This project is complete.";
  const target = input.targetDate ? `Target ${formatDate(input.targetDate)}` : "No target date set";
  const label = HEALTH_LABELS[input.level];
  const blocked = input.blockedCount ?? 0;
  const overdue = input.overdueCount ?? 0;
  const behind = Math.max(0, input.behindPlanBy ?? 0);

  let base: string;
  if (input.level === "on_track") {
    const problems = [
      blocked > 0 ? `${plural(blocked, "item")} ${blocked === 1 ? "is" : "are"} blocked` : "",
      overdue > 0 ? `${plural(overdue, "item")} ${overdue === 1 ? "is" : "are"} overdue` : "",
      behind > 0 ? `the project is ${plural(behind, "item")} behind plan` : "",
    ].filter(Boolean);
    if (problems.length === 0) {
      base = `${label}. ${target}, and nothing is overdue or blocked.`;
    } else {
      // Lead with the exception, but keep the honest part: the target date is not at risk by the numbers.
      const lead = input.targetDate ? `${label} for ${formatDate(input.targetDate)}, but ` : `${label}, but `;
      const list = problems.length > 1 ? `${problems.slice(0, -1).join(", ")} and ${problems[problems.length - 1]}` : problems[0];
      base = `${lead}${list}.${input.targetDate ? "" : ` ${target}.`}`;
    }
  } else {
    base = `${label}. ${input.firstReason ?? "Open items need attention."} ${target}.`;
  }
  const needClient = Math.max(input.waitingOnClientCount, input.clientOwnedOpenCount);
  return needClient > 0 ? `${base} ${plural(needClient, "open item")} ${needClient === 1 ? "needs" : "need"} the client.` : base;
}

export function buildSnapshot(input: SnapshotInput) {
  const { today } = input;
  const live = input.items.filter((i) => !i.archived);
  const open = live.filter(isOpen);
  const countable = live.filter((i) => i.status !== "dropped");
  const done = countable.filter((i) => i.status === "done").length;
  const soonCutoff = addDays(today, HEALTH_THRESHOLDS.atRiskNotStartedDueWithinDays);

  const overdue = open.filter((i) => overdueDays(i.dueDate, today) > 0).sort((a, b) => overdueDays(b.dueDate, today) - overdueDays(a.dueDate, today));
  const blocked = open.filter((i) => i.status === "blocked");
  const waiting = open.filter((i) => i.status === "waiting_on_client");
  const dueSoon = open.filter((i) => i.dueDate !== null && i.dueDate >= today && i.dueDate <= soonCutoff);

  const side = (s: string | null) => (s === "talkpush" || s === "client" || s === "vendor" ? s : "unassigned");
  const bySide: Record<string, ReturnType<typeof brief>[]> = { talkpush: [], client: [], vendor: [], unassigned: [] };
  for (const i of open) bySide[side(i.ownerSide)].push(brief(i, today));

  const upcomingMilestones = open
    .filter((i) => i.isMilestone)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const next = upcomingMilestones[0];

  const clientOwnedOpen = bySide.client.length;
  const p = input.project;
  const burnup = buildBurnup(live, { startDate: p.startDate, targetDate: p.targetDate }, today);
  const noDueDate = open.filter((i) => !i.dueDate).length;

  return {
    headline: buildHeadline({
      level: input.health.level,
      firstReason: input.health.reasons[0] ?? null,
      targetDate: p.targetDate,
      projectStatus: p.status,
      waitingOnClientCount: waiting.length,
      clientOwnedOpenCount: clientOwnedOpen,
      blockedCount: blocked.length,
      overdueCount: overdue.length,
      behindPlanBy: burnup?.behindBy ?? 0,
    }),
    project: {
      id: p.id,
      title: p.title,
      account: p.accountName,
      status: p.status,
      startDate: p.startDate,
      targetDate: p.targetDate,
      originalTargetDate: p.originalTargetDate,
      goLiveDate: p.goLiveDate,
      rescheduleCount: p.rescheduleCount,
      owner: p.owner?.name ?? null,
      sponsor: p.sponsor?.name ?? null,
    },
    health: {
      level: input.health.level,
      label: HEALTH_LABELS[input.health.level],
      calculatedLevel: input.health.calculatedLevel,
      overridden: input.health.overridden,
      overrideNote: input.health.overrideNote,
      reasons: input.health.reasons,
    },
    progress: {
      done,
      total: countable.length,
      percentDone: countable.length === 0 ? 0 : Math.round((done / countable.length) * 100),
      open: open.length,
      overdue: overdue.length,
      blocked: blocked.length,
      waitingOnClient: waiting.length,
      daysToTarget: p.targetDate ? daysBetween(today, p.targetDate) : null,
    },
    nextMilestone: next ? brief(next, today) : null,
    needsAttention: {
      overdue: overdue.map((i) => brief(i, today)),
      blocked: blocked.map((i) => brief(i, today)),
      waitingOnClient: waiting.map((i) => brief(i, today)),
      dueSoon: dueSoon.filter((i) => overdueDays(i.dueDate, today) === 0).map((i) => brief(i, today)),
    },
    openItemsByOwnerSide: Object.fromEntries(Object.entries(bySide).map(([k, v]) => [k, { count: v.length, items: v }])),
    phases: input.phases.map((ph) => {
      const inPhase = countable.filter((i) => i.phaseId === ph.id);
      return {
        name: ph.name,
        total: inPhase.length,
        done: inPhase.filter((i) => i.status === "done").length,
        open: inPhase.filter(isOpen).length,
      };
    }),
    burnup: burnup ? { ...burnup, insight: burnupInsight(burnup) } : null,
    dataNotes: [
      ...(p.targetDate ? [] : ["No target date is set, so days to target cannot be shown."]),
      ...(noDueDate > 0 ? [`${noDueDate} open ${noDueDate === 1 ? "item has" : "items have"} no due date.`] : []),
    ],
    metrics: (input.metrics ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      unit: m.unit,
      direction: m.direction,
      baseline: m.baselineValue,
      current: m.currentValue,
      target: m.targetValue,
      asOf: m.currentAsOf,
    })),
    linkedChecklist: input.checklist
      ? { clientName: input.checklist.clientName, complete: input.checklist.completeCount, total: input.checklist.totalCount }
      : null,
    recentActivity: (input.recentActivity ?? []).slice(0, 10),
    asOf: today,
  };
}

export type ProjectSnapshot = ReturnType<typeof buildSnapshot>;
