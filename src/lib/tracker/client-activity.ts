import { ITEM_STATUS_LABELS, type ItemStatus } from "./constants";
import { formatDate } from "./format";

/**
 * The activity trail a CLIENT may see (on a view-only or contributor link).
 *
 * The raw activity log holds things clients must never see: staff email addresses, blocker reasons, Jira links,
 * internal remarks, who downloaded a file, who made a link. So this is an ALLOW-list, like visibility.ts:
 *  - only these actions, only these fields, only on items the client can see right now;
 *  - staff are always "Talkpush team", never an email; a client contact is shown by name;
 *  - nothing is quoted from a field outside the list.
 * Pure (no database), so every rule is tested.
 */

export interface ActivityRow {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
  actorLabel: string;
  via: string;
  createdAt: Date | string;
}

export interface ClientActivityEntry {
  id: string;
  /** ISO time. */
  at: string;
  /** "Talkpush team" or the client contact's name. */
  who: string;
  side: "talkpush" | "client";
  itemId: string | null;
  itemTitle: string | null;
  /** One plain sentence without the name at the start, e.g. `moved "Provide DNS records" from In progress to Done`. */
  text: string;
  /** For a comment: what was written. */
  quote: string | null;
}

export interface ClientActivityContext {
  /** Items the client can see right now (live and client-visible), by id, with their current title. */
  visibleItems: ReadonlyMap<string, string>;
  /** Shared remarks by id, so a comment can be quoted. Internal remarks are not in here. */
  sharedRemarks: ReadonlyMap<string, { body: string }>;
}

/** Actions this feed may ever show. Everything else (links, files, downloads, metrics, phases...) is left out. */
export const CLIENT_ACTIVITY_ACTIONS = ["item.created", "item.status_changed", "item.updated", "remark.added", "project.updated"] as const;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const asTime = (v: Date | string) => (v instanceof Date ? v : new Date(v));

const PRIORITY_LABELS: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

const statusLabel = (v: unknown) => (typeof v === "string" ? (ITEM_STATUS_LABELS[v as ItemStatus] ?? v) : "none");
const dateText = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatDate(v) : "no date");

function actor(row: ActivityRow): { who: string; side: "talkpush" | "client" } {
  if (row.via === "client") {
    const name = row.actorLabel.replace(/^client:/i, "").trim();
    return { who: name || "A client contact", side: "client" };
  }
  return { who: "Talkpush team", side: "talkpush" };
}

/**
 * For each item, the moment it most recently became visible to clients. Anything logged before then happened while
 * the item was team-only, so a client never sees it.
 */
export function visibleSinceByItem(rows: readonly ActivityRow[]): Map<string, number> {
  const since = new Map<string, number>();
  for (const r of rows) {
    if (r.entityType !== "item") continue;
    if (r.action !== "item.updated" && r.action !== "item.status_changed") continue;
    if (obj(r.after).visibility !== "client_visible") continue;
    const t = asTime(r.createdAt).getTime();
    if (t > (since.get(r.entityId) ?? 0)) since.set(r.entityId, t);
  }
  return since;
}

/** The parts of an item change a client may see, as short phrases. Empty when the change was only team-only fields. */
function itemChangeParts(before: Record<string, unknown>, after: Record<string, unknown>, title: string): string[] {
  const parts: string[] = [];
  if ("status" in after) parts.push(`moved "${title}" from ${statusLabel(before.status)} to ${statusLabel(after.status)}`);
  if ("title" in after && typeof after.title === "string") {
    parts.push(`renamed "${typeof before.title === "string" ? before.title : title}" to "${after.title}"`);
  }
  if ("description" in after) parts.push(`edited the description of "${title}"`);
  if ("priority" in after) parts.push(`set the priority of "${title}" to ${PRIORITY_LABELS[String(after.priority)] ?? String(after.priority)}`);
  if ("dueDate" in after) parts.push(`${before.dueDate ? `moved the due date of "${title}" from ${dateText(before.dueDate)} to ${dateText(after.dueDate)}` : `set the due date of "${title}" to ${dateText(after.dueDate)}`}`);
  if ("startDate" in after) parts.push(`changed the start date of "${title}" to ${dateText(after.startDate)}`);
  if ("ownerPersonId" in after) parts.push(`changed the owner of "${title}"`);
  if ("blockedByItemIds" in after) parts.push(`changed what "${title}" is waiting for`);
  return parts;
}

/**
 * Turns raw activity rows (newest first) into what a client may see. `limit` caps the result.
 * Rows about items the client cannot see, or from before an item became visible, never appear.
 */
export function toClientActivity(rows: readonly ActivityRow[], ctx: ClientActivityContext, limit = 100): ClientActivityEntry[] {
  const since = visibleSinceByItem(rows);
  const out: ClientActivityEntry[] = [];

  for (const row of rows) {
    if (out.length >= limit) break;
    if (!(CLIENT_ACTIVITY_ACTIONS as readonly string[]).includes(row.action)) continue;
    const at = asTime(row.createdAt);
    const before = obj(row.before);
    const after = obj(row.after);
    const { who, side } = actor(row);
    const base = { id: row.id, at: at.toISOString(), who, side, itemId: null as string | null, itemTitle: null as string | null, quote: null as string | null };

    if (row.action === "project.updated") {
      if (!("targetDate" in after)) continue;
      out.push({ ...base, text: `moved the project target date from ${dateText(before.targetDate)} to ${dateText(after.targetDate)}` });
      continue;
    }

    // Everything else is about an item. Find which one, and make sure the client can see it (and could at that time).
    const itemId = row.entityType === "item" ? row.entityId : typeof after.itemId === "string" ? after.itemId : null;
    if (!itemId) continue;
    const currentTitle = ctx.visibleItems.get(itemId);
    if (currentTitle === undefined) continue;
    const visibleAt = since.get(itemId);
    if (visibleAt !== undefined && at.getTime() <= visibleAt) continue;
    const entry = { ...base, itemId, itemTitle: currentTitle };

    if (row.action === "item.created") {
      out.push({ ...entry, text: `added "${typeof after.title === "string" ? after.title : currentTitle}"` });
    } else if (row.action === "remark.added") {
      if (after.visibility !== "shared") continue; // team-only notes never show
      const remark = ctx.sharedRemarks.get(row.entityId);
      out.push({ ...entry, text: `commented on "${currentTitle}"`, quote: remark ? remark.body : null });
    } else {
      const parts = itemChangeParts(before, after, currentTitle);
      if (parts.length === 0) continue;
      out.push({ ...entry, text: parts.join(", and ") });
    }
  }
  return out;
}
