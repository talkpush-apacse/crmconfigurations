/**
 * Project Tracker vocabulary and tunable rules.
 *
 * Status-like columns are plain strings in the database (see the schema
 * comments); this file is the single place that defines which values are
 * valid. Adding a status later is a change here, not a database migration.
 */

export const ITEM_STATUSES = [
  "not_started",
  "in_progress",
  "waiting_on_client",
  "blocked",
  "done",
  "dropped",
] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  waiting_on_client: "Waiting on client",
  blocked: "Blocked",
  done: "Done",
  dropped: "Dropped",
};

/** Statuses where work is still expected. */
export const OPEN_ITEM_STATUSES: readonly ItemStatus[] = [
  "not_started",
  "in_progress",
  "waiting_on_client",
  "blocked",
];

export const ITEM_TYPES = [
  "config",
  "integration",
  "uat",
  "training",
  "decision",
  "risk",
  "issue",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  config: "Configuration",
  integration: "Integration",
  uat: "UAT",
  training: "Training",
  decision: "Decision",
  risk: "Risk",
  issue: "Issue",
};

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ITEM_VISIBILITIES = ["client_visible", "internal"] as const;
export type ItemVisibility = (typeof ITEM_VISIBILITIES)[number];

export const REMARK_VISIBILITIES = ["shared", "internal"] as const;
export type RemarkVisibility = (typeof REMARK_VISIBILITIES)[number];

export const PERSON_SIDES = ["talkpush", "client", "vendor"] as const;
export type PersonSide = (typeof PERSON_SIDES)[number];

export const PERSON_SIDE_LABELS: Record<PersonSide, string> = {
  talkpush: "Talkpush",
  client: "Client",
  vendor: "Vendor",
};

export const PROJECT_STATUSES = ["planned", "active", "on_hold", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Planned",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
};

export const HEALTH_LEVELS = ["on_track", "at_risk", "off_track"] as const;
export type HealthLevel = (typeof HEALTH_LEVELS)[number];

export const HEALTH_LABELS: Record<HealthLevel, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
};

/**
 * Who a standard-plan item is for. One field drives two things when a plan is built:
 * the item's visibility and the side that owns it.
 *   internal = Talkpush only  -> visibility internal, owned by Talkpush
 *   shared   = Talkpush does it, the client can see it -> client_visible, owned by Talkpush
 *   client   = the client does it, and can see it -> client_visible, owned by the client
 */
export const PLAN_AUDIENCES = ["internal", "shared", "client"] as const;
export type PlanAudience = (typeof PLAN_AUDIENCES)[number];

export const PLAN_AUDIENCE_LABELS: Record<PlanAudience, string> = {
  internal: "Talkpush only",
  shared: "Shared with client",
  client: "Client does this",
};

export const VIA_VALUES = ["web", "mcp", "client"] as const;
export type Via = (typeof VIA_VALUES)[number];

export const DEFAULT_PHASES = [
  "Scoping",
  "Configuration",
  "Integration",
  "UAT",
  "Training",
  "Go-live",
  "Hypercare",
] as const;

/**
 * Health thresholds, all in one place so they are easy to change.
 *
 * Confirmed with Jolo: off track = a milestone overdue by more than 5 days;
 * at risk = 2 or more blocked items, or an item due within 7 days that has not
 * started.
 *
 * Added by the implementation (flagged for review):
 *  - the project target date passing by more than 5 days also means off track;
 *  - any open item that is already overdue means at risk (bad news is not hidden).
 */
export const HEALTH_THRESHOLDS = {
  offTrackMilestoneOverdueDays: 5,
  offTrackTargetOverdueDays: 5,
  atRiskBlockedItems: 2,
  atRiskNotStartedDueWithinDays: 7,
} as const;
