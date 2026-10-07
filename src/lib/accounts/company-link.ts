import { prisma } from "@/lib/db";

/**
 * Which company a checklist or a workflow belongs to. The "company" is the Project Tracker's account, shared by all
 * three modules. A checklist or workflow belongs to at most one company; a company can have many of each.
 *
 * Linking is only filing: it never changes what a client sees, and it keeps the item's "last updated" time as it was
 * (Prisma would otherwise stamp "now", and a client would read "updated just now" on a workflow nobody edited).
 */

export interface LinkedAccount {
  id: string;
  name: string;
}

export type LinkResult =
  | { ok: true; accountId: string | null; account: LinkedAccount | null }
  | { ok: false; status: 400 | 404; error: string };

/** The request body must say which company: an id, or null to take the item out of its company. */
export function parseAccountId(body: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || !Object.prototype.hasOwnProperty.call(body, "accountId")) {
    return { ok: false, error: "Say which company with accountId (an id, or null to unlink)." };
  }
  const v = (body as { accountId: unknown }).accountId;
  if (v === null) return { ok: true, value: null };
  if (typeof v === "string" && v.trim() && v.length <= 80) return { ok: true, value: v.trim() };
  return { ok: false, error: "accountId must be a company id, or null to unlink." };
}

/** A company items can be filed under: it exists and is not archived. */
export async function findLinkableAccount(accountId: string): Promise<{ ok: true; account: LinkedAccount } | { ok: false; status: 400 | 404; error: string }> {
  const account = await prisma.trackerAccount.findUnique({ where: { id: accountId }, select: { id: true, name: true, archived: true } });
  if (!account) return { ok: false, status: 404, error: "That company was not found." };
  if (account.archived) return { ok: false, status: 400, error: `${account.name} is archived. Restore it before adding to it.` };
  return { ok: true, account: { id: account.id, name: account.name } };
}

async function resolveTarget(accountId: string | null): Promise<{ ok: true; account: LinkedAccount | null } | { ok: false; status: 400 | 404; error: string }> {
  if (accountId === null) return { ok: true, account: null };
  return findLinkableAccount(accountId);
}

export async function linkChecklistToAccount(checklistId: string, accountId: string | null): Promise<LinkResult & { previousAccountId?: string | null }> {
  const current = await prisma.checklist.findUnique({ where: { id: checklistId }, select: { id: true, accountId: true, updatedAt: true } });
  if (!current) return { ok: false, status: 404, error: "Checklist not found." };
  const target = await resolveTarget(accountId);
  if (!target.ok) return target;
  if (current.accountId !== accountId) {
    await prisma.checklist.update({ where: { id: checklistId }, data: { accountId, updatedAt: current.updatedAt } });
  }
  return { ok: true, accountId, account: target.account, previousAccountId: current.accountId };
}

export async function linkWorkflowToAccount(workflowId: string, accountId: string | null): Promise<LinkResult & { previousAccountId?: string | null }> {
  const current = await prisma.workflowProject.findUnique({ where: { id: workflowId }, select: { id: true, accountId: true, updatedAt: true } });
  if (!current) return { ok: false, status: 404, error: "Workflow not found." };
  const target = await resolveTarget(accountId);
  if (!target.ok) return target;
  if (current.accountId !== accountId) {
    await prisma.workflowProject.update({ where: { id: workflowId }, data: { accountId, updatedAt: current.updatedAt } });
  }
  return { ok: true, accountId, account: target.account, previousAccountId: current.accountId };
}
