import { prisma } from "@/lib/db";
import { getNotificationTabMeta } from "@/lib/notifications";
import { describeTrackerChange, describeWorkflowChange, truncate, WORKFLOW_ACTIONS_INCLUDED } from "./describe";
import type { DigestArea, DigestEntry, DigestNote } from "./types";

/**
 * Reads what changed in a window, from the records the Hub already keeps. Read-only: nothing here writes.
 *
 * Each area is read on its own. If one cannot be read, that area is reported as failed and the others still go out,
 * so one broken table never costs the whole digest. Each query is capped; when the cap is hit the digest says so.
 */

export const ROW_CAP = 500;
const FREE_TEXT = 100;

export interface Window {
  start: Date; // inclusive
  end: Date; // exclusive
}

export interface CollectResult {
  entries: DigestEntry[];
  notes: DigestNote[];
  failedAreas: DigestArea[];
}

const inWindow = (w: Window) => ({ gte: w.start, lt: w.end });

async function collectTracker(w: Window): Promise<{ entries: DigestEntry[]; capped: boolean }> {
  const rows = await prisma.trackerActivity.findMany({
    where: { createdAt: inWindow(w), action: { not: "export.downloaded" } },
    orderBy: { createdAt: "desc" },
    take: ROW_CAP + 1,
    select: {
      entityType: true,
      entityId: true,
      action: true,
      before: true,
      after: true,
      actorLabel: true,
      createdAt: true,
      project: { select: { id: true, title: true, account: { select: { name: true } } } },
    },
  });
  const capped = rows.length > ROW_CAP;
  const used = rows.slice(0, ROW_CAP);

  // A remark's text and its item's title are not on the activity row, so look them up in one go.
  const remarkIds = used.filter((r) => r.entityType === "remark").map((r) => r.entityId);
  const remarks = remarkIds.length
    ? await prisma.trackerRemark.findMany({ where: { id: { in: remarkIds } }, select: { id: true, body: true, item: { select: { title: true } } } })
    : [];
  const remarkById = new Map(remarks.map((r) => [r.id, r]));

  const entries = used.map((r): DigestEntry => {
    const remark = r.entityType === "remark" ? remarkById.get(r.entityId) : undefined;
    const described = describeTrackerChange({ action: r.action, before: r.before, after: r.after, entityTitle: remark?.item.title ?? null, remarkBody: remark?.body ?? null });
    return {
      area: "tracker",
      groupId: r.project.id,
      groupTitle: r.project.title,
      groupSubtitle: r.project.account?.name,
      groupPath: `/admin/tracker/projects/${r.project.id}`,
      at: r.createdAt,
      actor: r.actorLabel,
      text: described.text,
      collapseKey: described.collapseKey,
    };
  });
  return { entries, capped };
}

async function collectWorkflows(w: Window): Promise<{ entries: DigestEntry[]; capped: boolean }> {
  const workflowSelect = { id: true, workflowName: true, clientName: true } as const;
  const [events, comments, created] = await Promise.all([
    prisma.workflowAuditEvent.findMany({
      where: { createdAt: inWindow(w), OR: [{ action: { in: [...WORKFLOW_ACTIONS_INCLUDED] } }, { action: { startsWith: "mcp." } }] },
      orderBy: { createdAt: "desc" },
      take: ROW_CAP + 1,
      select: { actorType: true, actorName: true, action: true, detail: true, createdAt: true, workflow: { select: workflowSelect } },
    }),
    prisma.workflowComment.findMany({
      where: { createdAt: inWindow(w) },
      orderBy: { createdAt: "desc" },
      take: ROW_CAP + 1,
      select: { authorName: true, body: true, parentId: true, createdAt: true, workflow: { select: workflowSelect } },
    }),
    prisma.workflowProject.findMany({ where: { createdAt: inWindow(w) }, orderBy: { createdAt: "desc" }, take: ROW_CAP + 1, select: { ...workflowSelect, createdAt: true } }),
  ]);
  const capped = events.length > ROW_CAP || comments.length > ROW_CAP || created.length > ROW_CAP;

  const group = (wf: { id: string; workflowName: string; clientName: string }) => ({
    area: "workflow" as const,
    groupId: wf.id,
    groupTitle: wf.workflowName,
    groupSubtitle: wf.clientName,
    groupPath: `/admin/workflows/${wf.id}`,
  });

  const entries: DigestEntry[] = [];
  for (const e of events.slice(0, ROW_CAP)) {
    const d = describeWorkflowChange(e.action, e.detail);
    entries.push({ ...group(e.workflow), at: e.createdAt, actor: e.actorName ?? (e.actorType === "mcp" ? "Claude (MCP)" : null), text: d.text, collapseKey: d.collapseKey });
  }
  for (const c of comments.slice(0, ROW_CAP)) {
    entries.push({ ...group(c.workflow), at: c.createdAt, actor: c.authorName, text: `${c.parentId ? "replied to a comment" : "commented"}: "${truncate(c.body, FREE_TEXT)}"` });
  }
  for (const wf of created.slice(0, ROW_CAP)) {
    entries.push({ ...group(wf), at: wf.createdAt, actor: null, text: "created the workflow" });
  }
  return { entries, capped };
}

/** "Contacts", "Contacts and Messaging", "Contacts, Messaging and Sources". */
function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Checklists have no permanent change log yet. The one signal that exists is the per-tab "last edited" time that the two
 * client-link save routes keep. So this covers client edits only, one line per checklist, and only the latest edit of each
 * tab. Do NOT use the checklist's updatedAt or version: the owner-notification job raises both by itself.
 */
async function collectChecklists(w: Window): Promise<{ entries: DigestEntry[]; capped: boolean }> {
  const rows = await prisma.checklist.findMany({ select: { id: true, clientName: true, createdAt: true, notificationState: true } });
  const entries: DigestEntry[] = [];
  for (const row of rows) {
    const base = { area: "checklist" as const, groupId: row.id, groupTitle: row.clientName, groupPath: `/admin/checklists/${row.id}` };
    if (row.createdAt >= w.start && row.createdAt < w.end) entries.push({ ...base, at: row.createdAt, actor: null, text: "created the checklist" });

    const state = row.notificationState && typeof row.notificationState === "object" && !Array.isArray(row.notificationState) ? (row.notificationState as Record<string, { lastEditAt?: unknown }>) : {};
    const edited: { label: string; at: Date }[] = [];
    for (const [tabId, tab] of Object.entries(state)) {
      const at = typeof tab?.lastEditAt === "string" ? new Date(tab.lastEditAt) : null;
      if (!at || Number.isNaN(at.getTime()) || at < w.start || at >= w.end) continue;
      edited.push({ label: getNotificationTabMeta(tabId)?.label ?? tabId, at });
    }
    if (edited.length > 0) {
      edited.sort((a, b) => a.label.localeCompare(b.label));
      const latest = edited.reduce((max, e) => (e.at > max ? e.at : max), edited[0].at);
      entries.push({ ...base, at: latest, actor: "A client", text: `edited the ${listWords(edited.map((e) => e.label))} ${edited.length === 1 ? "tab" : "tabs"}` });
    }
  }
  return { entries, capped: false };
}

const AREA_LABEL: Record<DigestArea, string> = { tracker: "Project tracker", workflow: "Workflow", checklist: "Checklist" };

export async function collectDigest(w: Window): Promise<CollectResult> {
  const sources: [DigestArea, () => Promise<{ entries: DigestEntry[]; capped: boolean }>][] = [
    ["tracker", () => collectTracker(w)],
    ["workflow", () => collectWorkflows(w)],
    ["checklist", () => collectChecklists(w)],
  ];
  const settled = await Promise.allSettled(sources.map(([, read]) => read()));

  const result: CollectResult = { entries: [], notes: [], failedAreas: [] };
  settled.forEach((s, i) => {
    const area = sources[i][0];
    if (s.status === "rejected") {
      result.failedAreas.push(area);
      result.notes.push({ tone: "note", text: `${AREA_LABEL[area]} changes could not be loaded today, so they are missing from this email.` });
      console.error(`[activity-digest] could not read ${area}:`, s.reason instanceof Error ? s.reason.message : s.reason);
      return;
    }
    result.entries.push(...s.value.entries);
    if (s.value.capped) result.notes.push({ tone: "note", text: `There were more than ${ROW_CAP} ${AREA_LABEL[area].toLowerCase()} changes, so only the newest ${ROW_CAP} are counted here.` });
  });

  // Always true until staff and Claude edits to checklists are logged.
  result.notes.push({ tone: "info", text: "Checklist edits by staff and by Claude are not included yet, and checklist edits show the tab only." });
  return result;
}
