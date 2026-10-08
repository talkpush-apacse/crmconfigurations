import { prisma } from "@/lib/db";
import { activityTabForSlug } from "./tab-keys";
import { displayNameFor, isMe, type ActivityAudience, type ActivityMe } from "./activity-rules";
import { OTHERS_WINDOW_MS, type TabActivity } from "./types";

/**
 * "Who else has been changing this tab?" for the banner. Built from what is already recorded (the edit history and the
 * section version numbers), so it needs no new table and no change to saving.
 *
 * What it can and cannot say: it knows about SAVED changes. Autosave runs half a second after someone stops typing, so
 * "changed 1 minute ago" is close to "working on it". It cannot know who merely has the tab open.
 */

const MAX_OTHERS = 3;

export interface TabActivityArgs {
  checklistId: string;
  /** The tab's address segment, for example `users` or `custom-ai-call-scripts`. */
  slug: string;
  /** The checklist version the viewer's page has (null when unknown). */
  since: number | null;
  me: ActivityMe;
  audience: ActivityAudience;
  now?: number;
}

export async function getTabActivity(args: TabActivityArgs): Promise<TabActivity> {
  const tab = activityTabForSlug(args.slug);
  if (!tab) return { changedSinceYouOpened: false, others: [] };
  const now = args.now ?? Date.now();

  const [row, events] = await Promise.all([
    prisma.checklist.findUnique({ where: { id: args.checklistId }, select: { fieldVersions: true } }),
    prisma.checklistEditEvent.findMany({
      where: {
        checklistId: args.checklistId,
        tabKey: tab.tabKey,
        changeType: { not: "checked" },
        updatedAt: { gt: new Date(now - OTHERS_WINDOW_MS) },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { actorType: true, actorName: true, linkId: true, updatedAt: true },
    }),
  ]);

  // The same rule the save uses to refuse a stale write: the section changed after the viewer's page version.
  const versions = (row?.fieldVersions ?? {}) as Record<string, number>;
  const changedSinceYouOpened = args.since !== null && tab.fields.some((f) => (versions[f] ?? 0) > (args.since as number));

  const byName = new Map<string, { name: string; at: Date }>();
  for (const e of events) {
    if (isMe(e, args.me)) continue;
    const name = displayNameFor(e.actorType, e.actorName, args.audience);
    const key = name.toLowerCase();
    if (!byName.has(key)) byName.set(key, { name, at: e.updatedAt }); // events are newest first
  }
  const others = Array.from(byName.values())
    .slice(0, MAX_OTHERS)
    .map((o) => ({ name: o.name, at: o.at.toISOString() }));

  return { changedSinceYouOpened, others };
}
