import { computeHealth } from "./health";
import { isHealthLevel } from "./health";
import { buildSnapshot, type SnapshotItem } from "./snapshot";
import { toClientProject, toClientRemarks, type RawProject, type RawRemark } from "./visibility";

/**
 * The client-safe project view: the ONLY shape a client link may ever return.
 *
 * Built field by field from an allow-list, from client-visible data only, and
 * the numbers (progress, health, headline, attention lists) are computed from
 * the client-visible items alone, so an internal item cannot leak through a
 * count or a headline.
 *
 * Never exposed: internal items and remarks, blocker reasons, the project's
 * checklist link, activity history (it holds staff emails), health-override
 * notes, internal account notes, email addresses of anyone, and other
 * projects or accounts.
 */

export interface ClientViewInput {
  project: RawProject & {
    healthOverride: string | null;
    owner: { name: string } | null;
    sponsor: { name: string } | null;
  };
  items: (SnapshotItem & { description?: string | null })[];
  phases: readonly { id: string; name: string }[];
  metrics: readonly {
    id: string;
    name: string;
    unit: string;
    direction: string;
    baselineValue: number | null;
    targetValue: number | null;
    currentValue: number | null;
    currentAsOf: string | null;
    visibility: string;
    archived: boolean;
  }[];
  remarks: readonly (RawRemark & { itemId: string })[];
  today: string;
}

const MAX_REMARKS = 20;

export function buildClientView(input: ClientViewInput) {
  // 1. Only client-visible, live items; strip anything internal before any maths.
  const visibleItems: SnapshotItem[] = input.items
    .filter((i) => i.visibility === "client_visible" && !i.archived)
    .map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      dueDate: i.dueDate,
      completedAt: i.completedAt,
      isMilestone: i.isMilestone,
      archived: false,
      ownerName: i.ownerName,
      ownerSide: i.ownerSide,
      phaseId: i.phaseId,
      blockerReason: null, // internal: never shown to clients
      waitingOn: i.waitingOn,
      visibility: "client_visible",
      needsReview: i.needsReview === true,
    }));
  const visibleIds = new Set(visibleItems.map((i) => i.id));
  const titleById = new Map(visibleItems.map((i) => [i.id, i.title]));

  // 2. Health from visible items only. A manual override is shown as a level, never its note.
  const p = input.project;
  const calculated = computeHealth(
    { status: p.status, targetDate: p.targetDate, healthOverride: null, healthOverrideNote: null },
    visibleItems,
    input.today
  );
  const overridden = isHealthLevel(p.healthOverride);
  const health = {
    ...calculated,
    level: overridden ? (p.healthOverride as typeof calculated.level) : calculated.level,
    overridden: false,
    overrideNote: null,
    reasons: overridden ? [] : calculated.reasons,
  };

  // 3. Metrics the client may see.
  const metrics = input.metrics.filter((m) => m.visibility === "client_visible" && !m.archived);

  const project = toClientProject(p);
  const snapshot = buildSnapshot({
    project: {
      id: project.id,
      title: project.title,
      accountName: project.accountName,
      status: project.status,
      startDate: project.startDate,
      targetDate: project.targetDate,
      originalTargetDate: project.originalTargetDate,
      goLiveDate: project.goLiveDate,
      rescheduleCount: project.rescheduleCount,
      owner: p.owner ? { name: p.owner.name } : null,
      sponsor: p.sponsor ? { name: p.sponsor.name } : null,
    },
    health,
    items: visibleItems,
    phases: input.phases,
    metrics,
    checklist: null,
    recentActivity: [],
    today: input.today,
  });

  const remarks = toClientRemarks(input.remarks, visibleIds)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_REMARKS)
    .map((r) => ({ ...r, itemTitle: titleById.get(r.itemId) ?? "" }));

  return { ...snapshot, sharedRemarks: remarks };
}

export type ClientView = ReturnType<typeof buildClientView>;
