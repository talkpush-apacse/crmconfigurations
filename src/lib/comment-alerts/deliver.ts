import { after } from "next/server";
import { prisma } from "@/lib/db";
import { canReceiveDigest } from "@/lib/activity-digest/recipient";
import { signInOrigin } from "@/lib/google-sign-in";
import { deliverCommentAlert, type CommentAlertEvent, type DeliverDeps, type Place } from "./orchestrate";

/**
 * Emails the super admin when a comment comes in from outside the Talkpush team.
 *
 * Runs AFTER the comment is saved and the response is on its way, so it can never slow down or fail a comment: any
 * problem is logged (never the comment text) and dropped. The address is the same setting the daily digest uses
 * (ACTIVITY_DIGEST_TO), and it is checked against the login list every time, so it must still be a super admin.
 */

export type { CommentAlertEvent };

async function loadRecipient(): Promise<string | null> {
  const to = process.env.ACTIVITY_DIGEST_TO?.trim() ?? "";
  if (!to) return null;
  const user = await prisma.adminUser.findFirst({ where: { email: { equals: to, mode: "insensitive" } }, select: { email: true, role: true, isSuperAdmin: true } });
  return canReceiveDigest(user) ? user!.email : null;
}

async function loadPlace(event: CommentAlertEvent): Promise<Place | null> {
  if (event.kind === "workflow") {
    const wf = await prisma.workflowProject.findUnique({ where: { id: event.workflowId }, select: { workflowName: true, clientName: true } });
    if (!wf) return null;
    return { placeName: wf.workflowName, companyName: wf.clientName, itemTitle: null, path: `/admin/workflows/${event.workflowId}` };
  }
  const item = await prisma.trackerItem.findUnique({
    where: { id: event.itemId },
    select: { title: true, project: { select: { id: true, title: true, account: { select: { name: true } } } } },
  });
  if (!item) return null;
  return { placeName: item.project.title, companyName: item.project.account.name, itemTitle: item.title, path: `/admin/tracker/projects/${item.project.id}` };
}

const defaultDeps: DeliverDeps = {
  recipient: loadRecipient,
  loadPlace,
  baseUrl: () => (process.env.APP_BASE_URL?.trim() || signInOrigin(process.env.GOOGLE_REDIRECT_URI?.trim(), "")).replace(/\/+$/, ""),
  // Loaded only when an alert is really sent: the email module is server-only, and this file is reachable from services that scripts and tests import.
  send: async (message) => (await import("@/lib/email")).sendCommentAlert(message),
  now: () => new Date(),
};

/** Fire and forget, after the response. Errors never escape and never include the comment text. */
export function alertAfterResponse(event: CommentAlertEvent): void {
  const safe = async () => {
    try {
      await deliverCommentAlert(event, defaultDeps);
    } catch (err) {
      console.error(`[comment-alert] failed (${event.kind}):`, err instanceof Error ? err.message : "unknown error");
    }
  };
  try {
    after(safe);
  } catch {
    // Not inside a request (a script or a test): run it now, still never throwing.
    void safe();
  }
}
