import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { TAB_CONFIG } from "@/lib/tab-config";
import type { EditActorType, EditChangeType, EditEventRow, EditPerson, EditTabOption } from "./types";

/**
 * Reads for the staff History page. The list never loads the before/after text (a page of long call scripts
 * would be huge); that comes from `getEditEvent` when a row is opened. Paging is by cursor (createdAt, id), not by
 * page number, because new lines land at the top while someone is reading.
 */

export const HISTORY_PAGE_SIZE = 50;

interface Cursor {
  t: string; // createdAt, ISO
  id: string;
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Cursor;
    if (typeof c.t === "string" && typeof c.id === "string" && !Number.isNaN(Date.parse(c.t))) return c;
  } catch {
    // fall through
  }
  return null;
}

const LIST_SELECT = {
  id: true, actorType: true, actorName: true, linkId: true, tabKey: true, tabLabel: true, rowId: true, rowLabel: true,
  fieldKey: true, fieldLabel: true, changeType: true, summary: true, truncated: true, checklistVersion: true,
  createdAt: true, updatedAt: true,
} as const;

type ListRecord = {
  id: string; actorType: string; actorName: string; linkId: string | null; tabKey: string; tabLabel: string;
  rowId: string | null; rowLabel: string | null; fieldKey: string | null; fieldLabel: string | null;
  changeType: string; summary: string; truncated: boolean; checklistVersion: number; createdAt: Date; updatedAt: Date;
};

function toRow(r: ListRecord): EditEventRow {
  return {
    id: r.id, actorType: r.actorType as EditActorType, actorName: r.actorName, linkId: r.linkId, tabKey: r.tabKey,
    tabLabel: r.tabLabel, rowId: r.rowId, rowLabel: r.rowLabel, fieldKey: r.fieldKey, fieldLabel: r.fieldLabel,
    changeType: r.changeType as EditChangeType, summary: r.summary, truncated: r.truncated,
    checklistVersion: r.checklistVersion, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

/**
 * "link:<id>" for one named link, "admin:<email>" for one staff login, "type:slug" / "type:legacy_link" / "type:mcp"
 * for the unnamed kinds.
 */
function personWhere(person: string | null | undefined): Prisma.ChecklistEditEventWhereInput {
  if (!person) return {};
  if (person.startsWith("link:")) return { linkId: person.slice(5) };
  if (person.startsWith("admin:")) return { actorType: "admin", actorName: person.slice(6) };
  if (person.startsWith("type:")) return { actorType: person.slice(5) };
  return {};
}

export interface ListEventsArgs {
  checklistId: string;
  person?: string | null;
  tab?: string | null;
  cursor?: string | null;
  limit?: number;
}

export async function listEditEvents(args: ListEventsArgs): Promise<{ events: EditEventRow[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(args.limit ?? HISTORY_PAGE_SIZE, 1), 100);
  const cursor = decodeCursor(args.cursor);
  const where: Prisma.ChecklistEditEventWhereInput = {
    checklistId: args.checklistId,
    ...personWhere(args.person),
    ...(args.tab ? { tabKey: args.tab } : {}),
    ...(cursor
      ? { OR: [{ createdAt: { lt: new Date(cursor.t) } }, { createdAt: new Date(cursor.t), id: { lt: cursor.id } }] }
      : {}),
  };
  const rows = await prisma.checklistEditEvent.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: LIST_SELECT,
  });
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    events: page.map(toRow),
    nextCursor: rows.length > limit && last ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id }) : null,
  };
}

export interface EditEventDetail extends EditEventRow {
  before: unknown;
  after: unknown;
}

export async function getEditEvent(checklistId: string, eventId: string): Promise<EditEventDetail | null> {
  const r = await prisma.checklistEditEvent.findFirst({ where: { id: eventId, checklistId }, select: { ...LIST_SELECT, before: true, after: true } });
  if (!r) return null;
  return { ...toRow(r), before: r.before, after: r.after };
}

export interface HistoryOverview {
  people: EditPerson[];
  tabs: EditTabOption[];
  /** When the first change was recorded on this checklist. Null before anything was recorded. */
  firstRecordedAt: string | null;
  /** Sections whose latest change has no matching record, so the page can say so instead of looking complete. */
  possiblyMissing: string[];
}

/** Standard fields are a tab by their own name; custom tab rows and form values are tabs named `custom-...`. */
function labelForField(field: string): string {
  if (field === "customTabs" || field === "customData") return "Custom tabs and forms";
  return TAB_CONFIG.find((t) => t.dataKey === field)?.label ?? field;
}

export async function getHistoryOverview(checklistId: string): Promise<HistoryOverview> {
  const [people, tabs, bounds, checklist] = await Promise.all([
    prisma.checklistEditEvent.groupBy({ by: ["actorType", "actorName", "linkId"], where: { checklistId }, _count: { _all: true } }),
    prisma.checklistEditEvent.groupBy({ by: ["tabKey", "tabLabel"], where: { checklistId }, _count: { _all: true } }),
    prisma.checklistEditEvent.aggregate({ where: { checklistId }, _min: { createdAt: true, checklistVersion: true } }),
    prisma.checklist.findUnique({ where: { id: checklistId }, select: { fieldVersions: true } }),
  ]);

  const byPerson = new Map<string, EditPerson>();
  for (const p of people) {
    // A named link is one person, a staff login is one person; the unnamed kinds are grouped by kind.
    const key = p.linkId ? `link:${p.linkId}` : p.actorType === "admin" ? `admin:${p.actorName}` : `type:${p.actorType}`;
    const existing = byPerson.get(key);
    const count = p._count._all;
    if (existing) existing.count += count;
    else byPerson.set(key, { key, label: p.actorName, actorType: p.actorType as EditActorType, count });
  }

  // For each section: the newest version we have a record for, versus the version the section last changed at.
  // If the section changed later than anything recorded (and after recording began), say so.
  const missing: string[] = [];
  const startedAt = bounds._min.checklistVersion;
  if (startedAt !== null && startedAt !== undefined) {
    const maxByTab = await prisma.checklistEditEvent.groupBy({ by: ["tabKey"], where: { checklistId }, _max: { checklistVersion: true } });
    const maxVersion = (match: (tabKey: string) => boolean) =>
      Math.max(0, ...maxByTab.filter((m) => match(m.tabKey)).map((m) => m._max.checklistVersion ?? 0));
    const fieldVersions = (checklist?.fieldVersions ?? {}) as Record<string, number>;
    const seen = new Set<string>();
    for (const [field, version] of Object.entries(fieldVersions)) {
      if (typeof version !== "number" || version <= startedAt) continue;
      if (["adminSettings", "integrations", "atsIntegrations", "enabledTabs", "tabOrder", "tabFilledBy", "communicationChannels", "featureToggles", "customSchema", "tabUploadMeta"].includes(field)) continue;
      const isCustom = field === "customTabs" || field === "customData";
      const recorded = isCustom ? maxVersion((k) => k.startsWith("custom-")) : maxVersion((k) => k === field);
      if (recorded < version) {
        const label = labelForField(field);
        if (!seen.has(label)) {
          seen.add(label);
          missing.push(label);
        }
      }
    }
  }

  return {
    people: Array.from(byPerson.values()).sort((a, b) => b.count - a.count),
    tabs: tabs
      .map((t) => ({ tabKey: t.tabKey, tabLabel: t.tabLabel, count: t._count._all }))
      .sort((a, b) => a.tabLabel.localeCompare(b.tabLabel)),
    firstRecordedAt: bounds._min.createdAt ? bounds._min.createdAt.toISOString() : null,
    possiblyMissing: missing,
  };
}
