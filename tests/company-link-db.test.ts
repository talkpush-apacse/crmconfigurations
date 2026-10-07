import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/**
 * Filing checklists and workflows under a company (a Project Tracker account). Runs only against a LOCAL database
 * (skipped otherwise, and it refuses anything that is not localhost). It signs a made-up staff login in-process with a
 * made-up secret, so no real credential is involved.
 */
const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-company-link-tests-0123456789";
}
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const stamp = Date.now().toString(36);

async function setup(role: "editor" | "viewer" = "editor") {
  const { NextRequest } = await import("next/server");
  const { createToken } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/db");
  const user = await prisma.adminUser.create({ data: { email: `company-link-${role}-${stamp}@example.invalid`, role } });
  const cookie = `admin_token=${createToken(user.id)}`;
  const call = async (
    handler: (req: InstanceType<typeof NextRequest>, ctx: { params: Promise<Json> }) => Promise<Response>,
    url: string,
    opts: { method?: string; body?: unknown; auth?: boolean; params?: Json } = {}
  ) => {
    const req = new NextRequest(`http://localhost${url}`, {
      method: opts.method ?? "GET",
      headers: { "content-type": "application/json", ...(opts.auth === false ? {} : { cookie }) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : {}) as Json };
  };
  return { call, prisma, userId: user.id };
}

test("company link (local DB): file checklists and workflows under a company, several per company, move and unlink", { skip }, async () => {
  const { call, prisma, userId } = await setup();
  const accounts: string[] = [];
  const checklists: string[] = [];
  const workflows: string[] = [];
  try {
    const mk = async (name: string, archived = false) => {
      const a = await prisma.trackerAccount.create({ data: { name, slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp}`, archived } });
      accounts.push(a.id);
      return a;
    };
    const acme = await mk("Acme Link Test");
    const globex = await mk("Globex Link Test");
    const old = await mk("Archived Link Test", true);

    const checklistsRoute = await import("../src/app/api/checklists/route");
    const checklistAccount = await import("../src/app/api/checklists/[id]/account/route");
    const workflowsRoute = await import("../src/app/api/workflows/route");
    const workflowAccount = await import("../src/app/api/workflows/[id]/account/route");

    // ---- create already filed; several per company ----
    const c1 = await call(checklistsRoute.POST as never, "/api/checklists", { method: "POST", body: { clientName: `Acme PH ${stamp}`, accountId: acme.id } });
    assert.equal(c1.status, 201);
    checklists.push(c1.body.id);
    const c2 = await call(checklistsRoute.POST as never, "/api/checklists", { method: "POST", body: { clientName: `Acme SG ${stamp}`, accountId: acme.id } });
    assert.equal(c2.status, 201);
    checklists.push(c2.body.id);
    const unfiled = await call(checklistsRoute.POST as never, "/api/checklists", { method: "POST", body: { clientName: `Loose ${stamp}` } });
    checklists.push(unfiled.body.id);
    assert.equal((await prisma.checklist.findUniqueOrThrow({ where: { id: unfiled.body.id } })).accountId, null, "no company given means not linked");
    assert.equal((await prisma.checklist.count({ where: { accountId: acme.id } })), 2, "a company can have several checklists");

    const w1 = await call(workflowsRoute.POST as never, "/api/workflows", { method: "POST", body: { clientName: "Acme", workflowName: "Hiring", accountId: acme.id } });
    const w2 = await call(workflowsRoute.POST as never, "/api/workflows", { method: "POST", body: { clientName: "Acme", workflowName: "Offer", accountId: acme.id } });
    assert.equal(w1.status, 201);
    assert.equal(w2.status, 201);
    workflows.push(w1.body.id, w2.body.id);
    assert.equal(await prisma.workflowProject.count({ where: { accountId: acme.id } }), 2, "a company can have several workflows");

    // ---- bad company on create ----
    const missing = await call(checklistsRoute.POST as never, "/api/checklists", { method: "POST", body: { clientName: `Nope ${stamp}`, accountId: "no-such-account" } });
    assert.equal(missing.status, 404);
    const archivedTry = await call(workflowsRoute.POST as never, "/api/workflows", { method: "POST", body: { clientName: "X", workflowName: "Y", accountId: old.id } });
    assert.equal(archivedTry.status, 400);
    assert.match(archivedTry.body.error, /archived/i);
    const wrongType = await call(workflowsRoute.POST as never, "/api/workflows", { method: "POST", body: { clientName: "X", workflowName: "Y", accountId: 42 } });
    assert.equal(wrongType.status, 400);
    assert.equal(await prisma.checklist.count({ where: { clientName: `Nope ${stamp}` } }), 0, "a refused create writes nothing");

    // ---- lists tell staff which company ----
    const list = await call(checklistsRoute.GET as never, "/api/checklists");
    assert.equal(list.body.items.find((i: Json) => i.id === c1.body.id)?.accountId, acme.id);
    const wlist = await call(workflowsRoute.GET as never, "/api/workflows");
    assert.equal(wlist.body.items.find((i: Json) => i.id === w1.body.id)?.accountId, acme.id);

    // ---- move and unlink: filing is not an edit ----
    const before = await prisma.checklist.findUniqueOrThrow({ where: { id: c1.body.id } });
    await new Promise((r) => setTimeout(r, 15));
    const moved = await call(checklistAccount.PUT as never, `/api/checklists/${c1.body.id}/account`, { method: "PUT", body: { accountId: globex.id }, params: { id: c1.body.id } });
    assert.equal(moved.status, 200);
    assert.deepEqual(moved.body.account, { id: globex.id, name: "Globex Link Test" });
    const after = await prisma.checklist.findUniqueOrThrow({ where: { id: c1.body.id } });
    assert.equal(after.accountId, globex.id);
    assert.equal(after.version, before.version, "the checklist's version does not move, so a client editing is not disturbed");
    assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime(), "filing does not look like an edit");

    const wBefore = await prisma.workflowProject.findUniqueOrThrow({ where: { id: w1.body.id } });
    await new Promise((r) => setTimeout(r, 15));
    const wMoved = await call(workflowAccount.PUT as never, `/api/workflows/${w1.body.id}/account`, { method: "PUT", body: { accountId: globex.id }, params: { id: w1.body.id } });
    assert.equal(wMoved.status, 200);
    const wAfter = await prisma.workflowProject.findUniqueOrThrow({ where: { id: w1.body.id } });
    assert.equal(wAfter.accountId, globex.id);
    assert.equal(wAfter.revision, wBefore.revision, "the diagram revision does not move");
    assert.equal(wAfter.updatedAt.getTime(), wBefore.updatedAt.getTime(), "clients do not see 'updated just now' for a workflow nobody edited");
    const audit = await prisma.workflowAuditEvent.findFirst({ where: { workflowId: w1.body.id, action: "account.linked" } });
    assert.ok(audit, "the move is in the workflow's activity log");
    // the same company again is a no-op and logs nothing more
    await call(workflowAccount.PUT as never, `/api/workflows/${w1.body.id}/account`, { method: "PUT", body: { accountId: globex.id }, params: { id: w1.body.id } });
    assert.equal(await prisma.workflowAuditEvent.count({ where: { workflowId: w1.body.id, action: "account.linked" } }), 1);

    const unlinked = await call(checklistAccount.PUT as never, `/api/checklists/${c1.body.id}/account`, { method: "PUT", body: { accountId: null }, params: { id: c1.body.id } });
    assert.equal(unlinked.status, 200);
    assert.equal(unlinked.body.account, null);
    assert.equal((await prisma.checklist.findUniqueOrThrow({ where: { id: c1.body.id } })).accountId, null);

    // ---- refusals ----
    const noBody = await call(checklistAccount.PUT as never, `/api/checklists/${c2.body.id}/account`, { method: "PUT", body: {}, params: { id: c2.body.id } });
    assert.equal(noBody.status, 400, "forgetting accountId is refused, not treated as unlink");
    assert.equal((await call(checklistAccount.PUT as never, `/api/checklists/nope/account`, { method: "PUT", body: { accountId: acme.id }, params: { id: "nope" } })).status, 404);
    assert.equal((await call(workflowAccount.PUT as never, `/api/workflows/nope/account`, { method: "PUT", body: { accountId: acme.id }, params: { id: "nope" } })).status, 404);
    assert.equal((await call(workflowAccount.PUT as never, `/api/workflows/${w2.body.id}/account`, { method: "PUT", body: { accountId: old.id }, params: { id: w2.body.id } })).status, 400);
    assert.equal((await call(checklistAccount.PUT as never, `/api/checklists/${c2.body.id}/account`, { method: "PUT", body: { accountId: acme.id }, params: { id: c2.body.id }, auth: false })).status, 401);
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id: w2.body.id } })).accountId, acme.id, "a refused change leaves it where it was");

    // ---- a company is never lost: removing one only unfiles its items ----
    await prisma.trackerAccount.delete({ where: { id: globex.id } });
    accounts.splice(accounts.indexOf(globex.id), 1);
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id: w1.body.id } })).accountId, null);
  } finally {
    await prisma.workflowAuditEvent.deleteMany({ where: { workflowId: { in: workflows } } });
    await prisma.workflowProject.deleteMany({ where: { id: { in: workflows } } });
    await prisma.checklist.deleteMany({ where: { id: { in: checklists } } });
    await prisma.trackerAccount.deleteMany({ where: { id: { in: accounts } } });
    await prisma.adminUser.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});

test("company link (local DB): a read-only login cannot file anything", { skip }, async () => {
  const { call, prisma, userId } = await setup("viewer");
  const created: { checklist?: string; account?: string } = {};
  try {
    const acct = await prisma.trackerAccount.create({ data: { name: "Viewer Test", slug: `viewer-test-${stamp}` } });
    created.account = acct.id;
    const cl = await prisma.checklist.create({ data: { slug: `viewer-test-${stamp}`, clientName: "Viewer Test" } });
    created.checklist = cl.id;
    const route = await import("../src/app/api/checklists/[id]/account/route");
    const res = await call(route.PUT as never, `/api/checklists/${cl.id}/account`, { method: "PUT", body: { accountId: acct.id }, params: { id: cl.id } });
    assert.equal(res.status, 403);
    assert.equal((await prisma.checklist.findUniqueOrThrow({ where: { id: cl.id } })).accountId, null);
  } finally {
    if (created.checklist) await prisma.checklist.delete({ where: { id: created.checklist } });
    if (created.account) await prisma.trackerAccount.delete({ where: { id: created.account } });
    await prisma.adminUser.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});

test("company link (local DB): the client link and the editor link never carry the company", { skip }, async () => {
  const { prisma, userId } = await setup();
  const created: { checklist?: string; account?: string } = {};
  try {
    const { NextRequest } = await import("next/server");
    const acct = await prisma.trackerAccount.create({ data: { name: "Hidden Co", slug: `hidden-co-${stamp}` } });
    created.account = acct.id;
    const cl = await prisma.checklist.create({ data: { slug: `hidden-co-${stamp}`, clientName: "Hidden Co", accountId: acct.id } });
    created.checklist = cl.id;

    const { GET: bySlug } = await import("../src/app/api/checklists/route");
    const slugRes = await bySlug(new NextRequest(`http://localhost/api/checklists?slug=${cl.slug}`));
    const slugBody = (await slugRes.json()) as Json;
    assert.equal(slugRes.status, 200);
    assert.equal("accountId" in slugBody, false, "client link");

    // The editor-link route and the server-rendered pages use these same hide lists on a real row.
    const { omitInternalConfigForSlug, omitInternalConfigForToken } = await import("../src/lib/checklist-public");
    const row = (await prisma.checklist.findUniqueOrThrow({ where: { id: cl.id } })) as unknown as Record<string, unknown>;
    assert.equal(row.accountId, acct.id, "the row really is linked");
    assert.equal("accountId" in omitInternalConfigForSlug(row), false, "client link");
    assert.equal("accountId" in omitInternalConfigForToken(row), false, "editor link");
  } finally {
    if (created.checklist) await prisma.checklist.delete({ where: { id: created.checklist } });
    if (created.account) await prisma.trackerAccount.delete({ where: { id: created.account } });
    await prisma.adminUser.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});

test("company link (local DB): a copy of a workflow stays under the same company", { skip }, async () => {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
  const { prisma } = await import("../src/lib/db");
  const { createWorkflowMcpServer } = await import("../src/lib/mcp/workflows");
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1" });
  await Promise.all([createWorkflowMcpServer("https://example.test").connect(s as never), client.connect(c)]);
  const ids: string[] = [];
  let accountId = "";
  try {
    const acct = await prisma.trackerAccount.create({ data: { name: "Copy Co", slug: `copy-co-${stamp}` } });
    accountId = acct.id;
    const src = await prisma.workflowProject.create({ data: { clientName: "Copy Co", workflowName: "Original", accountId: acct.id } });
    ids.push(src.id);
    const out = await client.callTool({ name: "duplicate_workflow", arguments: { workflowId: src.id } });
    const copyId = JSON.parse((out as { content: { text: string }[] }).content.map((x) => x.text).join("")).workflowId as string;
    ids.push(copyId);
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id: copyId } })).accountId, acct.id);
  } finally {
    await prisma.workflowProject.deleteMany({ where: { id: { in: ids } } });
    if (accountId) await prisma.trackerAccount.delete({ where: { id: accountId } });
    await prisma.$disconnect();
  }
});
