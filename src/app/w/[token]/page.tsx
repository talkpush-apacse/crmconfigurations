import { cookies } from "next/headers";
import { after } from "next/server";
import ClientWorkflowGate from "@/components/workflow/client/ClientWorkflowGate";
import type { ApiProblem } from "@/components/workflow/client/api";
import { recordAudit } from "@/lib/workflow/access/audit";
import { actorOf } from "@/lib/workflow/access/actor";
import { buildClientPagePayload } from "@/lib/workflow/access/client-payload";
import { GUEST_COOKIE } from "@/lib/workflow/access/guest";
import { problemMessage, resolveAccess } from "@/lib/workflow/access/resolve";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Workflow review",
  robots: { index: false, follow: false },
};

/**
 * The client page. The link is checked and the data is built here on the server, so the browser gets the diagram
 * in the first response instead of loading an empty page and then asking for it.
 */
export default async function ClientWorkflowPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const jar = await cookies();
  const result = await resolveAccess({ token, guestCookie: jar.get(GUEST_COOKIE)?.value });

  if (!result.ok) {
    const msg = problemMessage(result.problem);
    const problem: ApiProblem = {
      status: result.problem === "not_found" ? 404 : 403,
      error: msg.title,
      problem: result.problem,
      title: msg.title,
      message: msg.body,
      canRequestAccess: msg.canRequestAccess,
      clientName: result.clientName ?? null,
    };
    return <ClientWorkflowGate token={token} initial={null} initialProblem={problem} />;
  }

  const { access } = result;
  const who = { principal: access.principal, identity: access.identity };
  const payload = await buildClientPagePayload(access.workflowId, who, { needsName: access.needsName, pinnedVersionId: access.pinnedVersionId });
  if (!payload) return <ClientWorkflowGate token={token} initial={null} initialProblem={{ status: 404, error: "Not found", title: "We could not find this page", message: "The link may be mistyped.", canRequestAccess: false }} />;

  // The audit line is bookkeeping: write it after the page has been sent, not before.
  after(() => recordAudit({ workflowId: access.workflowId, ...actorOf(who), action: "link.opened", detail: { via: access.source.type } }));
  return <ClientWorkflowGate token={token} initial={payload} initialProblem={null} />;
}
