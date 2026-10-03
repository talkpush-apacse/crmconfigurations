import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { applyOps, OpError, type OpPage, type WorkflowOp } from "@/lib/workflow/ops";
import { sanitizeText } from "@/lib/workflow/text";
import { actorOf, authorKey, displayNameOf, type ActingAs } from "./actor";
import { recordAudit } from "./audit";
import { badRequest, forbidden, notFound } from "./errors";
import { ADMIN, can } from "./permissions";
import { commitOps } from "./ops-service";

/**
 * Suggest-then-accept (like Suggesting mode in Google Docs). A suggest-only editor's changes are stored as a
 * Suggestion: nothing on the live canvas changes until staff accept it.
 */

export const suggestionCreateSchema = z.object({
  baseRevision: z.number().int().min(0),
  ops: z.array(z.record(z.string(), z.unknown())).min(1).max(200),
  summary: z.string().trim().max(200).optional(),
});

export interface SuggestionView {
  id: string;
  authorName: string;
  summary: string | null;
  status: string;
  ops: unknown;
  opCount: number;
  baseRevision: number;
  createdAt: Date;
  resolvedAt: Date | null;
  mine: boolean;
}

export async function createSuggestion(workflowId: string, who: ActingAs, input: z.infer<typeof suggestionCreateSchema>): Promise<SuggestionView> {
  if (!can(who.principal, "canvas.suggest")) throw forbidden("You can only suggest changes when your link is in suggesting mode.");
  if (!who.identity.displayName) throw badRequest("Please tell us your name first.");

  const workflow = await prisma.workflowProject.findUnique({ where: { id: workflowId }, select: { pages: true } });
  if (!workflow) throw notFound("Workflow");
  const ops = input.ops as unknown as WorkflowOp[];
  // Dry run: the suggestion has to be a change this person is allowed to make, against the workflow as it is now.
  try {
    applyOps((workflow.pages as unknown as OpPage[]) ?? [], ops, who.principal);
  } catch (e) {
    if (e instanceof OpError) throw badRequest(e.message);
    throw e;
  }

  const row = await prisma.workflowSuggestion.create({
    data: {
      workflowId,
      authorMemberId: authorKey(who),
      authorGuestName: displayNameOf(who),
      baseRevision: input.baseRevision,
      ops: ops as unknown as Prisma.InputJsonValue,
      summary: input.summary ? sanitizeText(input.summary) : null,
    },
  });
  await recordAudit({ workflowId, ...actorOf(who), action: "suggestion.created", detail: { suggestionId: row.id, ops: ops.length } });
  return toView(row, who);
}

export async function listSuggestions(workflowId: string, who: ActingAs, statuses: string[] = ["pending"]): Promise<SuggestionView[]> {
  const rows = await prisma.workflowSuggestion.findMany({ where: { workflowId, status: { in: statuses } }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => toView(r, who));
}

export type ResolveOutcome = { status: "accepted" | "rejected" | "withdrawn" | "stale"; message?: string };

export async function acceptSuggestion(workflowId: string, suggestionId: string, who: ActingAs): Promise<ResolveOutcome> {
  if (!can(who.principal, "suggestion.accept")) throw forbidden("Only staff can accept suggestions.");
  const s = await prisma.workflowSuggestion.findFirst({ where: { id: suggestionId, workflowId } });
  if (!s) throw notFound("Suggestion");
  if (s.status !== "pending") throw badRequest(`This suggestion is already ${s.status}.`);

  let result;
  try {
    // Applied as staff, through the same revision-checked path as any other save.
    result = await commitOps({ workflowId, baseRevision: null, ops: s.ops as unknown as WorkflowOp[], principal: ADMIN });
  } catch (e) {
    if (e instanceof OpError) {
      await prisma.workflowSuggestion.update({ where: { id: s.id }, data: { status: "stale", resolvedAt: new Date() } });
      await recordAudit({ workflowId, ...actorOf(who), action: "suggestion.stale", detail: { suggestionId: s.id, reason: e.message } });
      return { status: "stale", message: `It no longer fits the current workflow: ${e.message}` };
    }
    throw e;
  }
  if (!result.ok) throw badRequest("The workflow is busy. Please try again.");

  await prisma.workflowSuggestion.update({ where: { id: s.id }, data: { status: "accepted", resolvedByAdminId: who.admin?.id ?? null, resolvedAt: new Date() } });
  await recordAudit({ workflowId, ...actorOf(who), action: "suggestion.accepted", detail: { suggestionId: s.id, suggestedBy: s.authorGuestName } });
  return { status: "accepted" };
}

export async function rejectSuggestion(workflowId: string, suggestionId: string, who: ActingAs): Promise<ResolveOutcome> {
  if (!can(who.principal, "suggestion.accept")) throw forbidden("Only staff can reject suggestions.");
  const s = await prisma.workflowSuggestion.findFirst({ where: { id: suggestionId, workflowId } });
  if (!s) throw notFound("Suggestion");
  if (s.status !== "pending") throw badRequest(`This suggestion is already ${s.status}.`);
  await prisma.workflowSuggestion.update({ where: { id: s.id }, data: { status: "rejected", resolvedByAdminId: who.admin?.id ?? null, resolvedAt: new Date() } });
  await recordAudit({ workflowId, ...actorOf(who), action: "suggestion.rejected", detail: { suggestionId: s.id } });
  return { status: "rejected" };
}

export async function withdrawSuggestion(workflowId: string, suggestionId: string, who: ActingAs): Promise<ResolveOutcome> {
  if (!can(who.principal, "suggestion.withdrawOwn")) throw forbidden();
  const s = await prisma.workflowSuggestion.findFirst({ where: { id: suggestionId, workflowId } });
  if (!s) throw notFound("Suggestion");
  if (!who.admin && (!s.authorMemberId || s.authorMemberId !== authorKey(who))) throw forbidden("You can only withdraw your own suggestions.");
  if (s.status !== "pending") throw badRequest(`This suggestion is already ${s.status}.`);
  await prisma.workflowSuggestion.update({ where: { id: s.id }, data: { status: "withdrawn", resolvedAt: new Date() } });
  await recordAudit({ workflowId, ...actorOf(who), action: "suggestion.withdrawn", detail: { suggestionId: s.id } });
  return { status: "withdrawn" };
}

/** Accepts every pending suggestion from one author, oldest first. Stops listing stale ones but keeps going. */
export async function acceptAllFromAuthor(workflowId: string, authorName: string, who: ActingAs) {
  const pending = await prisma.workflowSuggestion.findMany({ where: { workflowId, status: "pending", authorGuestName: authorName }, orderBy: { createdAt: "asc" } });
  const outcomes: ResolveOutcome[] = [];
  for (const s of pending) outcomes.push(await acceptSuggestion(workflowId, s.id, who));
  return outcomes;
}

function toView(
  r: { id: string; authorGuestName: string; summary: string | null; status: string; ops: unknown; baseRevision: number; createdAt: Date; resolvedAt: Date | null; authorMemberId: string | null },
  who: ActingAs
): SuggestionView {
  return {
    id: r.id, authorName: r.authorGuestName, summary: r.summary, status: r.status, ops: r.ops,
    opCount: Array.isArray(r.ops) ? r.ops.length : 0, baseRevision: r.baseRevision, createdAt: r.createdAt, resolvedAt: r.resolvedAt,
    mine: Boolean(r.authorMemberId) && r.authorMemberId === authorKey(who),
  };
}
