import { NextRequest } from "next/server";
import { AccessError, badRequest } from "@/lib/workflow/access/errors";
import { readJson, withStaff } from "@/lib/workflow/access/route-helpers";
import { actorOf } from "@/lib/workflow/access/actor";
import { recordAudit } from "@/lib/workflow/access/audit";
import { linkWorkflowToAccount, parseAccountId } from "@/lib/accounts/company-link";

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
      await recordAudit({ workflowId: id, ...actorOf(who), action: result.accountId ? "account.linked" : "account.unlinked", detail: { accountId: result.accountId, previousAccountId: result.previousAccountId ?? null } });
    }
    return { id, accountId: result.accountId, account: result.account };
  });
}
