import { NextRequest } from "next/server";
import { AccessError, badRequest } from "@/lib/workflow/access/errors";
import { readJson, withStaff } from "@/lib/workflow/access/route-helpers";
import { actorOf } from "@/lib/workflow/access/actor";
import { recordAudit } from "@/lib/workflow/access/audit";
import { linkWorkflowToAccount, parseAccountId } from "@/lib/accounts/company-link";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/**
 * File a workflow under a company, or take it out (accountId: null). Filing is not a canvas edit: the revision, the
 * diagram and the "updated" time clients see are untouched.
 */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withStaff(request, async ({ who }) => {
    const parsed = parseAccountId(await readJson(request));
    if (!parsed.ok) throw badRequest(parsed.error);
    const result = await linkWorkflowToAccount(id, parsed.value);
    if (!result.ok) throw new AccessError(result.error, result.status, result.status === 404 ? "not_found" : "bad_request");
    if (result.previousAccountId !== result.accountId) {
      // Names are kept in the entry so the Activity tab can say "filed under Acme" even if the company is renamed later.
      const ids = [result.accountId, result.previousAccountId].filter((x): x is string => !!x);
      const named = ids.length ? await prisma.trackerAccount.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
      const nameFor = (accountId: string | null | undefined) => named.find((n) => n.id === accountId)?.name ?? null;
      await recordAudit({
        workflowId: id,
        ...actorOf(who),
        action: result.accountId ? "account.linked" : "account.unlinked",
        detail: {
          accountId: result.accountId,
          accountName: nameFor(result.accountId),
          previousAccountId: result.previousAccountId ?? null,
          previousAccountName: nameFor(result.previousAccountId),
        },
      });
    }
    return { id, accountId: result.accountId, account: result.account };
  });
}
