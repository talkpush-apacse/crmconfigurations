import { prisma } from "@/lib/db";
import { z } from "zod";
import { sanitizeText } from "@/lib/workflow/text";
import { actorOf, authorKey, displayNameOf, type ActingAs } from "./actor";
import { recordAudit } from "./audit";
import { badRequest, forbidden, notFound } from "./errors";
import { can } from "./permissions";
import { isInternalNode } from "./client-view";
import { alertAfterResponse } from "@/lib/comment-alerts/deliver";
import { shouldAlertWorkflowComment } from "@/lib/comment-alerts/rules";

export const commentCreateSchema = z.object({
  pageId: z.string().min(1).max(80),
  nodeId: z.string().min(1).max(80).optional(),
  edgeId: z.string().min(1).max(80).optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  parentId: z.string().min(1).max(40).optional(),
  versionId: z.string().min(1).max(40).optional(),
  body: z.string().trim().min(1).max(2000),
});
export type CommentCreateInput = z.infer<typeof commentCreateSchema>;

export interface CommentView {
  id: string;
  pageId: string;
  nodeId: string | null;
  edgeId: string | null;
  x: number | null;
  y: number | null;
  parentId: string | null;
  body: string;
  authorName: string;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
  /** True when the current visitor wrote it (they may resolve it). */
  mine: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function pageOf(pages: any, pageId: string) {
  return Array.isArray(pages) ? pages.find((p: any) => p?.id === pageId) : undefined;
}

export async function createComment(workflowId: string, who: ActingAs, input: CommentCreateInput): Promise<CommentView> {
  if (!can(who.principal, "comment.create")) throw forbidden("You can look at this workflow but not comment on it.");
  if (!who.admin && !who.identity.displayName) throw badRequest("Please tell us your name first.");

  const workflow = await prisma.workflowProject.findUnique({ where: { id: workflowId }, select: { pages: true } });
  if (!workflow) throw notFound("Workflow");
  const page = pageOf(workflow.pages, input.pageId);
  if (!page) throw notFound("Page");

  if (input.nodeId) {
    const node = (page.nodes ?? []).find((n: any) => n.id === input.nodeId);
    // A hidden step does not exist for a client.
    if (!node || (!who.admin && isInternalNode(node))) throw notFound("Step");
  }
  if (input.edgeId && !(page.edges ?? []).some((e: any) => e.id === input.edgeId)) throw notFound("Connector");

  if (input.parentId) {
    const parent = await prisma.workflowComment.findFirst({ where: { id: input.parentId, workflowId } });
    if (!parent) throw notFound("Comment");
    if (parent.parentId) throw badRequest("You can reply to a comment, but not to a reply.");
  }

  const row = await prisma.workflowComment.create({
    data: {
      workflowId,
      pageId: input.pageId,
      nodeId: input.nodeId ?? null,
      edgeId: input.edgeId ?? null,
      x: input.x ?? null,
      y: input.y ?? null,
      versionId: input.versionId ?? null,
      parentId: input.parentId ?? null,
      body: sanitizeText(input.body),
      authorAdminId: who.admin?.id ?? null,
      authorMemberId: authorKey(who),
      authorName: displayNameOf(who),
    },
  });
  await recordAudit({ workflowId, ...actorOf(who), action: input.parentId ? "comment.replied" : "comment.created", detail: { commentId: row.id, nodeId: row.nodeId } });
  // Email the super admin about comments from outside the team. Runs after the response and can never fail the comment.
  if (shouldAlertWorkflowComment(who)) {
    alertAfterResponse({ kind: "workflow", workflowId, authorName: displayNameOf(who), body: row.body, isReply: Boolean(input.parentId) });
  }
  return toView(row, who);
}

export async function listComments(workflowId: string, who: ActingAs): Promise<CommentView[]> {
  const rows = await prisma.workflowComment.findMany({ where: { workflowId }, orderBy: { createdAt: "asc" } });
  if (who.admin) return rows.map((r) => toView(r, who));
  // Clients never see a comment pinned to a step that is hidden from them.
  const workflow = await prisma.workflowProject.findUnique({ where: { id: workflowId }, select: { pages: true } });
  const hidden = new Set<string>();
  if (Array.isArray(workflow?.pages)) {
    for (const p of workflow.pages as any[]) for (const n of p?.nodes ?? []) if (isInternalNode(n)) hidden.add(`${p.id}:${n.id}`);
  }
  return rows.filter((r) => !(r.nodeId && hidden.has(`${r.pageId}:${r.nodeId}`))).map((r) => toView(r, who));
}

export async function setCommentStatus(workflowId: string, commentId: string, who: ActingAs, status: "open" | "resolved") {
  const row = await prisma.workflowComment.findFirst({ where: { id: commentId, workflowId } });
  if (!row) throw notFound("Comment");
  const mine = Boolean(row.authorMemberId) && row.authorMemberId === authorKey(who);
  if (!who.admin && !(mine && can(who.principal, "comment.resolveOwn"))) throw forbidden("You can only resolve your own comments.");
  await prisma.workflowComment.update({ where: { id: commentId }, data: { status, resolvedAt: status === "resolved" ? new Date() : null } });
  await recordAudit({ workflowId, ...actorOf(who), action: status === "resolved" ? "comment.resolved" : "comment.reopened", detail: { commentId } });
}

function toView(
  r: { id: string; pageId: string; nodeId: string | null; edgeId: string | null; x: number | null; y: number | null; parentId: string | null; body: string; authorName: string; status: string; createdAt: Date; resolvedAt: Date | null; authorMemberId: string | null; authorAdminId: string | null },
  who: ActingAs
): CommentView {
  const mine = who.admin ? r.authorAdminId === who.admin.id : Boolean(r.authorMemberId) && r.authorMemberId === authorKey(who);
  return {
    id: r.id, pageId: r.pageId, nodeId: r.nodeId, edgeId: r.edgeId, x: r.x, y: r.y, parentId: r.parentId, body: r.body,
    authorName: r.authorName, status: r.status, createdAt: r.createdAt, resolvedAt: r.resolvedAt, mine,
  };
}
