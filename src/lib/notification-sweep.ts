import "server-only";

import { after } from "next/server";
import { prisma } from "@/lib/db";
import { sendOwnerNotification } from "@/lib/email";
import { buildClientTabUrl, getNotificationTabMeta } from "@/lib/notifications";
import type { NotificationState } from "@/lib/types";

const IDLE_THRESHOLD_MS = 5 * 60 * 1000;
const RATE_LIMIT_MS = 60 * 60 * 1000;

function cloneState(state: NotificationState): NotificationState {
  if (typeof structuredClone === "function") {
    return structuredClone(state);
  }
  return JSON.parse(JSON.stringify(state)) as NotificationState;
}

function parseState(value: unknown): NotificationState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as NotificationState;
}

export async function sweepAndDispatch(): Promise<{
  scanned: number;
  sent: number;
  failed: number;
  skippedRateLimited: number;
  skippedVersionConflict: number;
}> {
  const result = {
    scanned: 0,
    sent: 0,
    failed: 0,
    skippedRateLimited: 0,
    skippedVersionConflict: 0,
  };

  try {
    // TODO: if checklist volume grows beyond ~200, narrow the query or move the
    // sweep behind an external cron instead of scanning every checklist write.
    const checklists = await prisma.checklist.findMany({
      where: {
        ownerEmail: { not: null },
      },
      select: {
        id: true,
        slug: true,
        clientName: true,
        ownerEmail: true,
        notificationState: true,
        version: true,
      },
    });

    result.scanned = checklists.length;

    for (const checklist of checklists) {
      if (!checklist.ownerEmail) continue;

      const state = parseState(checklist.notificationState);
      if (!state) continue;

      const nextState = cloneState(state);
      let stateChanged = false;

      for (const [tabId, entry] of Object.entries(state)) {
        if (!entry?.pendingChanges || !entry.lastEditAt) continue;

        const lastEditAt = new Date(entry.lastEditAt);
        if (Number.isNaN(lastEditAt.getTime())) continue;

        const now = Date.now();
        const idleMs = now - lastEditAt.getTime();
        const lastNotifiedAt = entry.lastNotifiedAt ? new Date(entry.lastNotifiedAt) : null;
        const lastNotifiedMs = lastNotifiedAt?.getTime() ?? null;
        const notSentSinceLastEdit = !lastNotifiedAt || lastNotifiedAt < lastEditAt;
        const recentlyNotified = lastNotifiedMs !== null && now - lastNotifiedMs < RATE_LIMIT_MS;

        if (idleMs < IDLE_THRESHOLD_MS || !notSentSinceLastEdit) {
          continue;
        }

        if (recentlyNotified) {
          result.skippedRateLimited += 1;
          continue;
        }

        const tabMeta = getNotificationTabMeta(tabId);
        const tabUrl = buildClientTabUrl(process.env.APP_BASE_URL ?? "", checklist.slug, tabId);
        if (!tabMeta || !tabUrl) {
          result.failed += 1;
          console.error("[notifications] missing tab metadata or APP_BASE_URL", {
            checklistId: checklist.id,
            tabId,
          });
          continue;
        }

        const emailResult = await sendOwnerNotification({
          to: checklist.ownerEmail,
          clientName: checklist.clientName,
          tabDisplayName: tabMeta.displayName,
          tabUrl,
          updateType: "Edited",
          summary: entry.pendingChanges.summary,
        });

        if (!emailResult.ok) {
          result.failed += 1;
          console.error("[notifications] digest send failed", {
            checklistId: checklist.id,
            tabId,
            error: emailResult.error,
          });
          continue;
        }

        nextState[tabId] = {
          ...entry,
          lastNotifiedAt: new Date().toISOString(),
          pendingChanges: null,
        };
        stateChanged = true;
        result.sent += 1;
      }

      if (!stateChanged) continue;

      const updateResult = await prisma.checklist.updateMany({
        where: {
          id: checklist.id,
          version: checklist.version,
        },
        data: {
          notificationState: JSON.parse(JSON.stringify(nextState)),
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        result.skippedVersionConflict += 1;
      }
    }
  } catch (error) {
    console.error("[notifications] sweep failed", error);
  }

  return result;
}

export function scheduleNotificationSweep() {
  const runSweep = async () => {
    try {
      await sweepAndDispatch();
    } catch (error) {
      console.error("[notifications] sweep failed", error);
    }
  };

  if (typeof after === "function") {
    after(runSweep);
    return;
  }

  void runSweep();
}
