import { prisma } from "@/lib/db";
import { CLIENT_ACTIVITY_ACTIONS, toClientActivity, type ClientActivityEntry } from "./client-activity";

/**
 * Loads the raw activity and hands it to the pure allow-list in client-activity.ts. Both client links (view-only and
 * contributor) call this one function, so they always show the same trail.
 *
 * Selects only the columns the filter needs, and only the allowed actions, so nothing else even reaches memory.
 */

const RAW_ROWS = 600;
const DEFAULT_LIMIT = 100;

export async function getClientActivity(projectId: string, opts: { itemId?: string; limit?: number } = {}): Promise<ClientActivityEntry[]> {
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), 200);
  const [items, rows] = await Promise.all([
    prisma.trackerItem.findMany({ where: { projectId, archived: false, visibility: "client_visible" }, select: { id: true, title: true } }),
    prisma.trackerActivity.findMany({
      where: { projectId, action: { in: [...CLIENT_ACTIVITY_ACTIONS] } },
      orderBy: { createdAt: "desc" },
      take: RAW_ROWS,
      select: { id: true, entityType: true, entityId: true, action: true, before: true, after: true, actorLabel: true, via: true, createdAt: true },
    }),
  ]);

  const remarkIds = rows.filter((r) => r.action === "remark.added").map((r) => r.entityId);
  const remarks = remarkIds.length
    ? await prisma.trackerRemark.findMany({ where: { id: { in: remarkIds }, visibility: "shared" }, select: { id: true, body: true } })
    : [];

  const entries = toClientActivity(
    rows,
    { visibleItems: new Map(items.map((i) => [i.id, i.title])), sharedRemarks: new Map(remarks.map((r) => [r.id, { body: r.body }])) },
    opts.itemId ? RAW_ROWS : limit
  );
  return (opts.itemId ? entries.filter((e) => e.itemId === opts.itemId) : entries).slice(0, limit);
}
