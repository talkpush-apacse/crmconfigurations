import { ITEM_STATUS_LABELS, type ItemStatus } from "./constants";
import { formatDate } from "./format";

/** Turns an activity row into one plain sentence. Pure, so it is easy to test. */

export interface ActivityLike {
  action: string;
  entityTitle: string | null;
  before: unknown;
  after: unknown;
}

const FIELD_LABELS: Record<string, string> = {
  title: "title",
  description: "description",
  objective: "objective",
  type: "type",
  priority: "priority",
  status: "status",
  visibility: "visibility",
  isMilestone: "milestone flag",
  phaseId: "phase",
  ownerPersonId: "owner",
  startDate: "start date",
  dueDate: "due date",
  targetDate: "target date",
  goLiveDate: "go-live date",
  blockerReason: "blocker reason",
  waitingOn: "waiting on",
  externalDependency: "outside dependency",
  checklistTabSlug: "checklist link",
  archived: "archive state",
  blockedByItemIds: "dependencies",
  healthOverride: "health",
  healthOverrideNote: "health note",
  name: "name",
  exitCriteria: "exit criteria",
  endDate: "end date",
};

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function statusLabel(v: unknown): string {
  return typeof v === "string" ? (ITEM_STATUS_LABELS[v as ItemStatus] ?? v) : "none";
}

function fieldList(after: Record<string, unknown>): string {
  const labels = Object.keys(after).map((k) => FIELD_LABELS[k] ?? k);
  return labels.length === 0 ? "details" : labels.join(", ");
}

function dateValue(v: unknown): string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatDate(v) : v == null ? "none" : String(v);
}

export function describeActivity(a: ActivityLike): string {
  const before = obj(a.before);
  const after = obj(a.after);
  const title = a.entityTitle ?? (typeof before.title === "string" ? before.title : null);
  const quoted = title ? `"${title}"` : "an item";

  switch (a.action) {
    case "project.created":
      return "created the project";
    case "project.updated":
      if ("targetDate" in after) return `moved the target date from ${dateValue(before.targetDate)} to ${dateValue(after.targetDate)}`;
      return `changed the project ${fieldList(after)}`;
    case "phase.updated":
      return `changed a phase's ${fieldList(after)}`;
    case "item.created":
      return `added ${typeof after.title === "string" ? `"${after.title}"` : quoted}`;
    case "item.status_changed": {
      const reason = typeof after.blockerReason === "string" ? ` (${after.blockerReason})` : "";
      return `moved ${quoted} from ${statusLabel(before.status)} to ${statusLabel(after.status)}${reason}`;
    }
    case "item.updated":
      if ("archived" in after) return after.archived ? `archived ${quoted}` : `restored ${quoted}`;
      return `changed ${quoted}: ${fieldList(after)}`;
    case "remark.added":
      return `added a ${after.visibility === "shared" ? "shared" : "team-only"} remark on ${quoted}`;
    case "metric.created":
      return `added the metric "${String(after.name ?? "")}"`;
    case "metric.updated":
      return `changed the metric ${typeof before.name === "string" ? `"${before.name}" ` : ""}(${fieldList(after)})`;
    case "metric.reading_recorded":
      return `recorded ${String(after.value ?? "")} for "${String(before.name ?? "a metric")}"`;
    default:
      return a.action.replace(/[._]/g, " ");
  }
}
