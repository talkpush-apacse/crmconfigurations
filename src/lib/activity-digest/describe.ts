import { describeAuditAction } from "../workflow/audit-text";
import { describeActivity } from "../tracker/activity-text";
import type { DigestArea, DigestAreaSummary, DigestEntry, DigestGroup } from "./types";

/**
 * Turns change records into the bullet sentences of the digest. Pure, so every rule is tested.
 *
 * Nothing is copied through blindly. Tracker wording comes from the same helper the project's activity feed uses
 * (which only prints titles, status labels and field names, never raw before/after data). Anything that still looks
 * like a link or a long token is removed as a last line of defence.
 */

export const MAX_GROUPS_PER_AREA = 10;
export const MAX_ITEMS_PER_GROUP = 5;
const MAX_SENTENCE = 220;
const MAX_FREE_TEXT = 100;

export function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 3).trimEnd()}...`;
}

/** Removes web addresses and token-looking strings. A person's title never needs either in an email. */
export function scrubSecrets(text: string): string {
  return text
    .replace(/https?:\/\/[^\s"')\]]+/gi, "[link removed]")
    .replace(/\b(?=[A-Za-z0-9_-]{24,}\b)(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]+\b/g, "[removed]");
}

/** "You" for the recipient, "Aristotle Ocampo" for aristotle.ocampo@talkpush.com, other labels unchanged. */
export function friendlyActor(label: string | null | undefined, recipientEmail: string): string {
  const raw = (label ?? "").trim();
  if (!raw) return "";
  if (raw.includes("@")) {
    if (raw.toLowerCase() === recipientEmail.trim().toLowerCase()) return "You";
    const local = raw.split("@")[0];
    const name = local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
    return truncate(name || raw, 60);
  }
  return truncate(raw, 60);
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

// ---------- trackers ----------

export interface TrackerActivityInput {
  action: string;
  before: unknown;
  after: unknown;
  /** The item, phase or metric title when the record itself does not carry it. */
  entityTitle?: string | null;
  /** For remark.added: the remark text, looked up separately because the activity row does not hold it. */
  remarkBody?: string | null;
}

export function describeTrackerChange(input: TrackerActivityInput): { text: string; collapseKey?: string } {
  const after = obj(input.after);
  if (input.action === "project.plan_applied") {
    const bits = [
      typeof after.created === "number" && after.created > 0 ? `${after.created} added` : null,
      typeof after.restored === "number" && after.restored > 0 ? `${after.restored} restored` : null,
      typeof after.archived === "number" && after.archived > 0 ? `${after.archived} archived` : null,
    ].filter(Boolean);
    return { text: `applied the standard plan${bits.length ? ` (${bits.join(", ")})` : ""}` };
  }
  let text = describeActivity({ action: input.action, entityTitle: input.entityTitle ?? null, before: input.before, after: input.after });
  if (input.action === "remark.added" && input.remarkBody) text += `: "${truncate(input.remarkBody, MAX_FREE_TEXT)}"`;
  return { text };
}

// ---------- workflows ----------

/** Workflow audit lines that are changes worth listing. Reads, link opens and sign-in-style events are left out. */
const WORKFLOW_INCLUDED = new Set([
  "canvas.edited",
  "version.published",
  "version.unpublished",
  "suggestion.created",
  "suggestion.accepted",
  "suggestion.rejected",
  "member.invited",
  "member.updated",
  "member.revoked",
  "member.link_replaced",
  "link.created",
  "link.rotated",
  "link.updated",
  "link.disabled",
  "access.settings_changed",
  "access.requested",
  "account.linked",
  "account.unlinked",
  "review.approved",
  "review.changes_requested",
  "approved",
]);

export function isDigestWorkflowAction(action: string): boolean {
  return WORKFLOW_INCLUDED.has(action) || action.startsWith("mcp.");
}

/** The exact list, for the database query. mcp.* is matched by prefix. */
export const WORKFLOW_ACTIONS_INCLUDED: readonly string[] = [...WORKFLOW_INCLUDED];

export function describeWorkflowChange(action: string, detail: unknown): { text: string; collapseKey?: string } {
  if (action === "canvas.edited") return { text: "edited the diagram", collapseKey: "canvas.edited" };
  // Only changes are recorded for Claude's tools (reads are not), so every mcp.* line is a change.
  if (action.startsWith("mcp.")) return { text: "made a change", collapseKey: "mcp" };
  return { text: describeAuditAction(action, obj(detail)) };
}

// ---------- collapsing and grouping ----------

function manyText(collapseKey: string | undefined, text: string, n: number): string {
  if (collapseKey === "canvas.edited") return `edited the diagram ${n} times`;
  if (collapseKey === "mcp") return `made ${n} changes`;
  return `${text} (${n} times)`;
}

function sentence(actor: string, text: string): string {
  const joined = actor ? `${actor} ${text}` : text.charAt(0).toUpperCase() + text.slice(1);
  return scrubSecrets(truncate(joined, MAX_SENTENCE));
}

function buildGroup(entries: DigestEntry[], recipientEmail: string): DigestGroup {
  const ordered = [...entries].sort((a, b) => a.at.getTime() - b.at.getTime());
  const lines = new Map<string, { actor: string; text: string; collapseKey?: string; count: number; last: number }>();
  for (const e of ordered) {
    const actor = friendlyActor(e.actor, recipientEmail);
    const key = `${actor}|${e.collapseKey ?? e.text}`;
    const line = lines.get(key);
    if (line) {
      line.count += 1;
      line.last = e.at.getTime();
    } else lines.set(key, { actor, text: e.text, collapseKey: e.collapseKey, count: 1, last: e.at.getTime() });
  }
  // Newest first, so when a group is long the freshest changes are the ones shown and the oldest fold into "and N more".
  const all = [...lines.values()].sort((a, b) => b.last - a.last).map((l) => sentence(l.actor, l.count === 1 ? l.text : manyText(l.collapseKey, l.text, l.count)));
  const first = entries[0];
  return {
    title: truncate(first.groupTitle, 90),
    subtitle: first.groupSubtitle ? truncate(first.groupSubtitle, 90) : undefined,
    path: first.groupPath,
    items: all.slice(0, MAX_ITEMS_PER_GROUP),
    more: Math.max(0, all.length - MAX_ITEMS_PER_GROUP),
  };
}

export function summariseArea(area: DigestArea, entries: DigestEntry[], recipientEmail: string): DigestAreaSummary {
  const mine = entries.filter((e) => e.area === area);
  const byGroup = new Map<string, DigestEntry[]>();
  for (const e of mine) byGroup.set(e.groupId, [...(byGroup.get(e.groupId) ?? []), e]);
  // Busiest first, then A to Z, so the order is stable and the big news is at the top.
  const ordered = [...byGroup.values()].sort((a, b) => b.length - a.length || a[0].groupTitle.localeCompare(b[0].groupTitle));
  return {
    area,
    total: mine.length,
    groups: ordered.slice(0, MAX_GROUPS_PER_AREA).map((g) => buildGroup(g, recipientEmail)),
    hiddenGroups: Math.max(0, ordered.length - MAX_GROUPS_PER_AREA),
  };
}
