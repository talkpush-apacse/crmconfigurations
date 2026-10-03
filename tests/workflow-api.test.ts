import test from "node:test";
import assert from "node:assert/strict";

/**
 * The ported REST API, exercised against a real LOCAL database (skipped otherwise, and it refuses to run
 * against anything that is not localhost). Staff routes need a login cookie; the test signs one in-process
 * with a made-up test secret for a made-up user, so no real credential is involved.
 */

const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-workflow-api-tests-0123456789";
}
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function setup() {
  const { NextRequest } = await import("next/server");
  const { createToken } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/db");
  const cookie = `admin_token=${createToken("test-user-not-real")}`;
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
  return { call, prisma };
}

test("workflow API: staff routes refuse a visitor with no login", { skip }, async () => {
  const { call, prisma } = await setup();
  try {
    const list = await import("../src/app/api/workflows/route");
    assert.equal((await call(list.GET as never, "/api/workflows", { auth: false })).status, 401);
    const one = await import("../src/app/api/workflows/[id]/route");
    assert.equal((await call(one.PUT as never, "/api/workflows/x", { method: "PUT", body: {}, auth: false, params: { id: "x" } })).status, 401);
    const share = await import("../src/app/api/workflows/[id]/share/route");
    assert.equal((await call(share.POST as never, "/api/workflows/x/share", { method: "POST", auth: false, params: { id: "x" } })).status, 401);
  } finally {
    await prisma.$disconnect();
  }
});

test("workflow API: create, save, version, share, public view, sign-off, revoke", { skip }, async () => {
  const { call, prisma } = await setup();
  let id = "";
  try {
    const list = await import("../src/app/api/workflows/route");
    const one = await import("../src/app/api/workflows/[id]/route");
    const shareRoute = await import("../src/app/api/workflows/[id]/share/route");
    const publicRoute = await import("../src/app/api/workflows/share/[token]/route");
    const feedback = await import("../src/app/api/workflows/[id]/feedback/route");
    const versions = await import("../src/app/api/workflows/[id]/versions/route");

    // create
    const created = await call(list.POST as never, "/api/workflows", {
      method: "POST",
      body: { clientName: "<b>API Test</b> Client", workflowName: "API test flow" },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    id = created.body.id;
    const fetched = await call(one.GET as never, `/api/workflows/${id}`, { params: { id } });
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.clientName, "API Test Client", "HTML is stripped from text");
    assert.equal(fetched.body.pages.length, 1, "a Page 1 is always created");

    // save two nodes + an edge on page 1; the legacy columns must mirror page 1
    const nodes = [
      { id: "n1", type: "stage", position: { x: 0, y: 0 }, data: { label: "Step A", type: "stage" } },
      { id: "n2", type: "stage", position: { x: 0, y: 200 }, data: { label: "Step B", type: "stage" } },
    ];
    const edges = [{ id: "e1", source: "n1", target: "n2", data: {} }];
    const pageId = fetched.body.pages[0].id;
    const saved = await call(one.PUT as never, `/api/workflows/${id}`, {
      method: "PUT",
      params: { id },
      body: { pages: [{ id: pageId, name: "Page 1", nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } }] },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const row = await prisma.workflowProject.findUniqueOrThrow({ where: { id } });
    assert.equal((row.nodes as unknown[]).length, 2, "legacy nodes column mirrors page 1");
    assert.equal(row.currentVersion >= 1, true, "the first canvas save makes an Initial version");

    // share
    const shared = await call(shareRoute.POST as never, `/api/workflows/${id}/share`, { method: "POST", params: { id } });
    assert.equal(shared.status, 200, JSON.stringify(shared.body));
    assert.match(shared.body.shareUrl, /\/w\/[A-Za-z0-9_-]{12}$/);
    const token = shared.body.shareUrl.split("/w/")[1];

    // public view: no login needed
    const pub = await call(publicRoute.GET as never, `/api/workflows/share/${token}`, { auth: false, params: { token } });
    assert.equal(pub.status, 200);
    assert.equal(pub.body.workflowName, "API test flow");
    const bad = await call(publicRoute.GET as never, "/api/workflows/share/nope", { auth: false, params: { token: "nope" } });
    assert.equal(bad.status, 404);

    // sign-off needs the right token and a name, and records a version
    const noToken = await call(feedback.POST as never, `/api/workflows/${id}/feedback`, {
      method: "POST", auth: false, params: { id }, body: { action: "approved", reviewerName: "Pat" },
    });
    assert.ok([400, 403].includes(noToken.status), `missing token refused (got ${noToken.status})`);
    const approved = await call(feedback.POST as never, `/api/workflows/${id}/feedback`, {
      method: "POST", auth: false, params: { id }, body: { action: "approved", reviewerName: "Pat", shareToken: token },
    });
    assert.ok([200, 201].includes(approved.status), JSON.stringify(approved.body));
    const afterApproval = await prisma.workflowProject.findUniqueOrThrow({ where: { id } });
    assert.equal(afterApproval.status, "approved");

    const vlist = await call(versions.GET as never, `/api/workflows/${id}/versions`, { params: { id } });
    assert.equal(vlist.status, 200);
    assert.ok(vlist.body.items.length >= 2, "status changes snapshot a version");

    // revoke
    const revoked = await call(shareRoute.DELETE as never, `/api/workflows/${id}/share`, { method: "DELETE", params: { id } });
    assert.equal(revoked.status, 200);
    const gone = await call(publicRoute.GET as never, `/api/workflows/share/${token}`, { auth: false, params: { token } });
    assert.equal(gone.status, 404, "a revoked link stops working");
  } finally {
    if (id) await prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});
