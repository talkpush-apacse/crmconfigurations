import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/**
 * Archiving a workflow. Runs only against a LOCAL database (skipped otherwise, and it refuses anything that is not
 * localhost). It signs a made-up staff login in-process with a made-up secret, so no real credential is involved.
 */
const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-workflow-archive-tests-0123456789";
  // Some modules guard themselves with `server-only`, which refuses to load outside a Next.js build. Not needed here.
  const req = Module.createRequire(__filename);
  const resolved = req.resolve("server-only");
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: {} } as never;
}
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const stamp = Date.now().toString(36);

async function setup(role: "editor" | "viewer") {
  const { NextRequest } = await import("next/server");
  const { createToken } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/db");
  const user = await prisma.adminUser.create({ data: { email: `wf-archive-${role}-${stamp}@example.invalid`, role } });
  const cookie = `admin_token=${createToken(user.id)}`;
  const call = async (
    handler: (req: InstanceType<typeof NextRequest>, ctx: { params: Promise<Json> }) => Promise<Response>,
    url: string,
    opts: { method?: string; body?: unknown; params?: Json } = {}
  ) => {
    const req = new NextRequest(`http://localhost${url}`, {
      method: opts.method ?? "GET",
      headers: { "content-type": "application/json", cookie },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : {}) as Json };
  };
  return { call, prisma, userId: user.id };
}

test("workflow archive (local DB): archive hides it from lists, restore brings it back, nothing else changes", { skip }, async () => {
  const { call, prisma, userId } = await setup("editor");
  const ids: string[] = [];
  let accountId = "";
  const [c, s] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: "test", version: "1" });
  try {
    const acct = await prisma.trackerAccount.create({ data: { name: "WF Archive Co", slug: `wf-archive-co-${stamp}` } });
    accountId = acct.id;
    const keep = await prisma.workflowProject.create({ data: { clientName: "WF Archive Co", workflowName: "Keep Me", accountId } });
    const gone = await prisma.workflowProject.create({ data: { clientName: "WF Archive Co", workflowName: "Archive Me", accountId, status: "approved", shareToken: `share-${stamp}` } });
    const loose = await prisma.workflowProject.create({ data: { clientName: `Loose ${stamp}`, workflowName: "Loose Archive Me" } });
    ids.push(keep.id, gone.id, loose.id);
    const before = await prisma.workflowProject.findUniqueOrThrow({ where: { id: gone.id } });

    const listRoute = await import("../src/app/api/workflows/route");
    const oneRoute = await import("../src/app/api/workflows/[id]/route");
    const shareRoute = await import("../src/app/api/workflows/share/[token]/route");
    const overview = await import("../src/lib/companies/overview");
    const { createWorkflowMcpServer } = await import("../src/lib/mcp/workflows");
    await Promise.all([createWorkflowMcpServer("https://example.test").connect(s as never), mcp.connect(c)]);
    const patch = (id: string, body: unknown) => call(oneRoute.PATCH as never, `/api/workflows/${id}`, { method: "PATCH", body, params: { id } });

    // ---- bad requests change nothing ----
    assert.equal((await patch(gone.id, {})).status, 400);
    assert.equal((await patch(gone.id, { archived: "yes" })).status, 400);
    assert.equal((await patch("no-such-workflow", { archived: true })).status, 404);
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id: gone.id } })).archivedAt, null);

    // ---- archive ----
    const archived = await patch(gone.id, { archived: true });
    assert.equal(archived.status, 200);
    assert.ok(archived.body.archivedAt, "the archive date is returned");
    await patch(loose.id, { archived: true });

    const after = await prisma.workflowProject.findUniqueOrThrow({ where: { id: gone.id } });
    assert.ok(after.archivedAt);
    assert.equal(after.revision, before.revision, "archiving is not an edit: the revision does not move, so no one's save clashes");
    assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime(), "and the last-updated time stays put");
    assert.equal(after.status, "approved", "the review status is its own thing and is not touched");
    assert.equal(after.shareToken, before.shareToken);

    // Archiving twice keeps the first date.
    const again = await patch(gone.id, { archived: true });
    assert.equal(again.status, 200);
    assert.equal(new Date(again.body.archivedAt).getTime(), after.archivedAt!.getTime());

    // ---- lists ----
    const list = await call(listRoute.GET as never, "/api/workflows");
    const listed = (list.body.items as Json[]).map((i) => i.id);
    assert.ok(listed.includes(keep.id));
    assert.ok(!listed.includes(gone.id), "an archived workflow is left out of the list");
    const all = await call(listRoute.GET as never, "/api/workflows?includeArchived=true");
    const row = (all.body.items as Json[]).find((i) => i.id === gone.id);
    assert.ok(row, "…unless archived ones are asked for");
    assert.ok(row?.archivedAt);

    // ---- company screens ----
    const gallery = await overview.listCompanies();
    assert.equal(gallery.companies.find((x) => x.id === accountId)?.workflowCount, 1, "the company card counts only active workflows");
    const company = await overview.getCompany(accountId);
    assert.equal(company.workflows.length, 2, "the company page still has the archived one, marked");
    assert.ok(company.workflows.find((w) => w.id === gone.id)?.archivedAt);
    assert.equal(company.workflows.find((w) => w.id === keep.id)?.archivedAt, null);
    const unassigned = await overview.getUnassigned();
    const unassignedIds = unassigned.groups.flatMap((g) => g.workflows.map((w) => w.id));
    assert.ok(!unassignedIds.includes(loose.id), "an archived workflow is not in “needs an account”");

    // ---- Claude's list_workflows ----
    const mcpList = async (args: Json) => {
      const out = await mcp.callTool({ name: "list_workflows", arguments: { limit: 50, ...args } });
      return JSON.parse((out as { content: { text: string }[] }).content.map((x) => x.text).join("")).items as Json[];
    };
    assert.ok(!(await mcpList({ search: "Archive Me" })).some((w) => w.id === gone.id), "Claude's list leaves archived workflows out");
    const withArchived = await mcpList({ search: "Archive Me", include_archived: true });
    assert.ok(withArchived.find((w) => w.id === gone.id)?.archivedAt, "…unless include_archived is true");

    // ---- the workflow itself still opens, and its share link still works and never reveals the archive ----
    const one = await call(oneRoute.GET as never, `/api/workflows/${gone.id}`, { params: { id: gone.id } });
    assert.equal(one.status, 200);
    assert.ok(one.body.archivedAt);
    const shared = await call(shareRoute.GET as never, `/api/workflows/share/share-${stamp}`, { params: { token: `share-${stamp}` } });
    assert.equal(shared.status, 200, "the share link keeps working for an archived workflow");
    assert.equal("archivedAt" in shared.body, false, "and does not tell the visitor it is archived");

    // ---- restore ----
    const restored = await patch(gone.id, { archived: false });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.archivedAt, null);
    const back = await call(listRoute.GET as never, "/api/workflows");
    assert.ok((back.body.items as Json[]).some((i) => i.id === gone.id), "a restored workflow is back in the list");
  } finally {
    await mcp.close().catch(() => undefined);
    await prisma.workflowProject.deleteMany({ where: { id: { in: ids } } });
    if (accountId) await prisma.trackerAccount.delete({ where: { id: accountId } });
    await prisma.adminUser.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});

test("workflow archive (local DB): a read-only login cannot archive", { skip }, async () => {
  const { call, prisma, userId } = await setup("viewer");
  let id = "";
  try {
    const wf = await prisma.workflowProject.create({ data: { clientName: "Viewer Archive", workflowName: "Viewer Archive WF" } });
    id = wf.id;
    const oneRoute = await import("../src/app/api/workflows/[id]/route");
    const res = await call(oneRoute.PATCH as never, `/api/workflows/${id}`, { method: "PATCH", body: { archived: true }, params: { id } });
    assert.equal(res.status, 403);
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id } })).archivedAt, null);
  } finally {
    if (id) await prisma.workflowProject.delete({ where: { id } });
    await prisma.adminUser.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
