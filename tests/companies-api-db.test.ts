import test from "node:test";
import assert from "node:assert/strict";

/**
 * The company screens' read routes, against a LOCAL database only (skipped otherwise). Signs a made-up staff login
 * in-process with a made-up secret, so no real credential is involved.
 */
const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-companies-api-tests-0123456789";
}
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const stamp = Date.now().toString(36);

async function setup(role: "editor" | "viewer" = "editor") {
  const { NextRequest } = await import("next/server");
  const { createToken } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/db");
  const user = await prisma.adminUser.create({ data: { email: `companies-${role}-${stamp}@example.invalid`, role } });
  const cookie = `admin_token=${createToken(user.id)}`;
  const call = async (handler: (req: InstanceType<typeof NextRequest>, ctx: { params: Promise<Json> }) => Promise<Response>, url: string, opts: { auth?: boolean; params?: Json } = {}) => {
    const req = new NextRequest(`http://localhost${url}`, { headers: opts.auth === false ? {} : { cookie } });
    const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : {}) as Json };
  };
  return { call, prisma, userId: user.id };
}

test("companies API (local DB): counts, attention, recent activity, holding area and company page", { skip }, async () => {
  const { call, prisma, userId } = await setup("viewer"); // read-only logins can look at everything
  const accounts: string[] = [];
  const checklists: string[] = [];
  const workflows: string[] = [];
  try {
    const gallery = await import("../src/app/api/companies/route");
    const one = await import("../src/app/api/companies/[id]/route");
    const loose = await import("../src/app/api/companies/unassigned/route");

    assert.equal((await call(gallery.GET as never, "/api/companies", { auth: false })).status, 401);

    const mk = async (name: string, archived = false) => {
      const a = await prisma.trackerAccount.create({ data: { name: `${name} ${stamp}`, slug: `${name.toLowerCase()}-${stamp}`, archived } });
      accounts.push(a.id);
      return a;
    };
    const acme = await mk("Acme");
    const quiet = await mk("Quiet");
    const gone = await mk("Gone", true);

    const c = await prisma.checklist.create({ data: { slug: `acme-ph-${stamp}`, clientName: `Acme PH ${stamp}`, accountId: acme.id } });
    checklists.push(c.id);
    const w = await prisma.workflowProject.create({ data: { clientName: "Acme", workflowName: "Hiring", accountId: acme.id } });
    const w2 = await prisma.workflowProject.create({ data: { clientName: "Acme", workflowName: "Offer", accountId: acme.id } });
    workflows.push(w.id, w2.id);
    await prisma.workflowComment.createMany({
      data: [
        { workflowId: w.id, pageId: "p", body: "open one", authorName: "Client", status: "open" },
        { workflowId: w.id, pageId: "p", body: "open two", authorName: "Client", status: "open" },
        { workflowId: w.id, pageId: "p", body: "done", authorName: "Client", status: "resolved" },
      ],
    });
    await prisma.workflowAccessRequest.create({ data: { workflowId: w2.id, name: "Someone" } });
    await prisma.trackerProject.create({ data: { accountId: acme.id, title: `Acme rollout ${stamp}` } });

    // unfiled items for the holding area
    const looseChecklist = await prisma.checklist.create({ data: { slug: `loose-${stamp}`, clientName: `Quiet ${stamp}` } });
    const looseWorkflow = await prisma.workflowProject.create({ data: { clientName: `quiet ${stamp}`, workflowName: "Loose flow" } });
    checklists.push(looseChecklist.id);
    workflows.push(looseWorkflow.id);

    // ---- gallery ----
    const g = await call(gallery.GET as never, "/api/companies");
    assert.equal(g.status, 200);
    const card = g.body.companies.find((x: Json) => x.id === acme.id);
    assert.equal(card.checklistCount, 1);
    assert.equal(card.workflowCount, 2);
    assert.equal(card.projectCount, 1);
    assert.deepEqual(card.attention, { openComments: 2, pendingSuggestions: 0, openRequests: 1 }, "resolved comments are not counted");
    const empty = g.body.companies.find((x: Json) => x.id === quiet.id);
    assert.deepEqual([empty.checklistCount, empty.workflowCount, empty.projectCount], [0, 0, 0]);
    assert.equal(g.body.companies.some((x: Json) => x.id === gone.id), false, "archived companies stay out of the gallery");
    assert.ok(g.body.unassigned.checklists >= 1 && g.body.unassigned.workflows >= 1, "unfiled items are counted");
    assert.ok(new Date(card.lastActivityAt).getTime() >= acme.updatedAt.getTime());

    // ---- one company ----
    const page = await call(one.GET as never, `/api/companies/${acme.id}`, { params: { id: acme.id } });
    assert.equal(page.status, 200);
    assert.equal(page.body.company.name, `Acme ${stamp}`);
    assert.deepEqual(page.body.checklists.map((x: Json) => x.id), [c.id]);
    assert.ok(page.body.checklists[0].completionSummary, "checklist progress is included");
    const hiring = page.body.workflows.find((x: Json) => x.id === w.id);
    assert.equal(hiring.attention.openComments, 2);
    assert.equal(page.body.workflows.length, 2);
    assert.equal((await call(one.GET as never, `/api/companies/nope`, { params: { id: "nope" } })).status, 404);

    // ---- holding area ----
    const un = await call(loose.GET as never, "/api/companies/unassigned");
    assert.equal(un.status, 200);
    const group = un.body.groups.find((x: Json) => x.checklists.some((i: Json) => i.id === looseChecklist.id));
    assert.ok(group, "the unfiled checklist is listed");
    assert.ok(group.workflows.some((i: Json) => i.id === looseWorkflow.id), "the same client name, spelled differently, is one group");
    assert.deepEqual(group.suggestion, { id: quiet.id, name: `Quiet ${stamp}` }, "a name match is offered as a suggestion");
    assert.equal(un.body.groups.some((x: Json) => x.checklists.some((i: Json) => i.id === c.id)), false, "filed items are not listed");
  } finally {
    await prisma.trackerProject.deleteMany({ where: { accountId: { in: accounts } } });
    await prisma.workflowProject.deleteMany({ where: { id: { in: workflows } } });
    await prisma.checklist.deleteMany({ where: { id: { in: checklists } } });
    await prisma.trackerAccount.deleteMany({ where: { id: { in: accounts } } });
    await prisma.adminUser.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
