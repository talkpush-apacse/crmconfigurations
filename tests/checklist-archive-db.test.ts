import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

/**
 * Archiving a CRM Config Checklist. Runs only against a LOCAL database (skipped otherwise, and it refuses anything
 * that is not localhost). It signs a made-up staff login in-process with a made-up secret, so no real credential is
 * involved.
 */
const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-checklist-archive-tests-0123456789";
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
  const user = await prisma.adminUser.create({ data: { email: `archive-${role}-${stamp}@example.invalid`, role } });
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

test("checklist archive (local DB): archive hides it from lists, restore brings it back, nothing else changes", { skip }, async () => {
  const { call, prisma, userId } = await setup("editor");
  const ids: string[] = [];
  let accountId = "";
  try {
    const acct = await prisma.trackerAccount.create({ data: { name: "Archive Co", slug: `archive-co-${stamp}` } });
    accountId = acct.id;
    const keep = await prisma.checklist.create({ data: { slug: `archive-keep-${stamp}`, clientName: "Keep Me", accountId } });
    const gone = await prisma.checklist.create({ data: { slug: `archive-gone-${stamp}`, clientName: "Archive Me", accountId } });
    const loose = await prisma.checklist.create({ data: { slug: `archive-loose-${stamp}`, clientName: "Loose Archive Me" } });
    ids.push(keep.id, gone.id, loose.id);
    const before = await prisma.checklist.findUniqueOrThrow({ where: { id: gone.id } });

    const listRoute = await import("../src/app/api/checklists/route");
    const oneRoute = await import("../src/app/api/checklists/[id]/route");
    const overview = await import("../src/lib/companies/overview");
    const patch = (id: string, body: unknown) => call(oneRoute.PATCH as never, `/api/checklists/${id}`, { method: "PATCH", body, params: { id } });

    // ---- bad requests change nothing ----
    assert.equal((await patch(gone.id, {})).status, 400);
    assert.equal((await patch(gone.id, { archived: "yes" })).status, 400);
    assert.equal((await patch("no-such-checklist", { archived: true })).status, 404);
    assert.equal((await prisma.checklist.findUniqueOrThrow({ where: { id: gone.id } })).archivedAt, null);

    // ---- archive ----
    const archived = await patch(gone.id, { archived: true });
    assert.equal(archived.status, 200);
    assert.ok(archived.body.archivedAt, "the archive date is returned");
    await patch(loose.id, { archived: true });

    const after = await prisma.checklist.findUniqueOrThrow({ where: { id: gone.id } });
    assert.ok(after.archivedAt);
    assert.equal(after.version, before.version, "archiving is not an edit: the version does not move, so no one's save conflicts");
    assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime(), "and the last-updated time stays put");
    assert.equal(after.clientName, before.clientName);

    // Archiving twice keeps the first date.
    const again = await patch(gone.id, { archived: true });
    assert.equal(again.status, 200);
    assert.equal(new Date(again.body.archivedAt).getTime(), after.archivedAt!.getTime());

    // ---- lists ----
    const list = await call(listRoute.GET as never, "/api/checklists");
    const listed = (list.body.items as Json[]).map((i) => i.id);
    assert.ok(listed.includes(keep.id));
    assert.ok(!listed.includes(gone.id), "an archived checklist is left out of the list");
    const all = await call(listRoute.GET as never, "/api/checklists?includeArchived=true");
    const row = (all.body.items as Json[]).find((i) => i.id === gone.id);
    assert.ok(row, "…unless archived ones are asked for");
    assert.ok(row?.archivedAt);
    assert.equal(all.body.total - list.body.total >= 2, true, "the total follows the same rule");

    // ---- company screens ----
    const gallery = await overview.listCompanies();
    assert.equal(gallery.companies.find((c) => c.id === accountId)?.checklistCount, 1, "the company card counts only active checklists");
    const company = await overview.getCompany(accountId);
    assert.equal(company.checklists.length, 2, "the company page still has the archived one, marked");
    assert.ok(company.checklists.find((c) => c.id === gone.id)?.archivedAt);
    assert.equal(company.checklists.find((c) => c.id === keep.id)?.archivedAt, null);
    const unassigned = await overview.getUnassigned();
    const unassignedIds = unassigned.groups.flatMap((g) => g.checklists.map((c) => c.id));
    assert.ok(!unassignedIds.includes(loose.id), "an archived checklist is not in “needs an account”");

    // ---- the checklist itself still opens ----
    const one = await call(oneRoute.GET as never, `/api/checklists/${gone.id}`, { params: { id: gone.id } });
    assert.equal(one.status, 200);
    assert.ok(one.body.archivedAt);

    // ---- restore ----
    const restored = await patch(gone.id, { archived: false });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.archivedAt, null);
    const back = await call(listRoute.GET as never, "/api/checklists");
    assert.ok((back.body.items as Json[]).some((i) => i.id === gone.id), "a restored checklist is back in the list");
  } finally {
    await prisma.checklist.deleteMany({ where: { id: { in: ids } } });
    if (accountId) await prisma.trackerAccount.delete({ where: { id: accountId } });
    await prisma.adminUser.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});

test("checklist archive (local DB): a read-only login cannot archive", { skip }, async () => {
  const { call, prisma, userId } = await setup("viewer");
  let id = "";
  try {
    const cl = await prisma.checklist.create({ data: { slug: `archive-viewer-${stamp}`, clientName: "Viewer Archive" } });
    id = cl.id;
    const oneRoute = await import("../src/app/api/checklists/[id]/route");
    const res = await call(oneRoute.PATCH as never, `/api/checklists/${id}`, { method: "PATCH", body: { archived: true }, params: { id } });
    assert.equal(res.status, 403);
    assert.equal((await prisma.checklist.findUniqueOrThrow({ where: { id } })).archivedAt, null);
  } finally {
    if (id) await prisma.checklist.delete({ where: { id } });
    await prisma.adminUser.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
