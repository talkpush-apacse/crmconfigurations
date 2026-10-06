import test from "node:test";
import assert from "node:assert/strict";

/**
 * Phase 2 behaviour that needs a real database: what the public page actually receives, conflict detection,
 * and "an editor's save never drops hidden steps" end to end. Runs only against a LOCAL database
 * (WORKFLOW_TEST_DATABASE_URL pointing at localhost); skipped otherwise.
 */

const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-workflow-api-tests-0123456789";
}
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const MARK = "INTERNAL-PLANTED-MARKER";

async function setup() {
  const { NextRequest } = await import("next/server");
  const { createToken } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/db");
  const cookie = `admin_token=${createToken("test-user-not-real")}`;
  const call = async (handler: any, url: string, opts: { method?: string; body?: unknown; auth?: boolean; params?: Json } = {}) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const req = new NextRequest(`http://localhost${url}`, {
      method: opts.method ?? "GET",
      headers: { "content-type": "application/json", ...(opts.auth === false ? {} : { cookie }) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const res: Response = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
    const text = await res.text();
    return { status: res.status, text, body: (text ? JSON.parse(text) : {}) as Json };
  };
  return { call, prisma };
}

const mkNode = (id: string, data: Json = {}) => ({ id, type: "stage", position: { x: 0, y: 0 }, data: { label: id, type: "stage", notes: `note ${id}`, feasibility: "needs_review", feasibilityNote: `${MARK} feasibility`, ...data } });

async function makeWorkflow(prisma: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const pages = [{
    id: "p1", name: "Page 1", viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      mkNode("a", { internalNotes: `${MARK} notes` }),
      mkNode("b"),
      mkNode("hidden", { visibility: "internal", label: `${MARK} hidden label`, internalNotes: MARK }),
    ],
    edges: [
      { id: "e1", source: "a", target: "b", data: {} },
      { id: "e2", source: "b", target: "hidden", data: { label: `${MARK} edge` } },
    ],
  }];
  const row = await prisma.workflowProject.create({
    data: { clientName: "Access test", workflowName: "Access test flow", pages, nodes: pages[0].nodes, edges: pages[0].edges, shareToken: "accesstest12", status: "shared" },
  });
  return row.id as string;
}

test("the public page receives no staff-only content (planted markers never appear)", { skip }, async () => {
  const { call, prisma } = await setup();
  let id = "";
  try {
    id = await makeWorkflow(prisma);
    const route = await import("../src/app/api/workflows/share/[token]/route");
    const res = await call(route.GET, "/api/workflows/share/accesstest12", { auth: false, params: { token: "accesstest12" } });
    assert.equal(res.status, 200);
    assert.ok(!res.text.includes(MARK), "the raw response text contains no staff-only marker");
    assert.ok(!res.text.includes("shareToken"), "no share token field");
    assert.deepEqual(res.body.pages[0].nodes.map((n: Json) => n.id), ["a", "b"]);
    assert.deepEqual(res.body.pages[0].edges.map((e: Json) => e.id), ["e1"]);
    // and the staff view still has everything
    const one = await import("../src/app/api/workflows/[id]/route");
    const staff = await call(one.GET, `/api/workflows/${id}`, { params: { id } });
    assert.ok(staff.text.includes(MARK), "staff still see the internal content");
  } finally {
    if (id) await prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});

test("saving: a stale revision gets a 409 and changes nothing; the right one works; approval is flagged as changed", { skip }, async () => {
  const { call, prisma } = await setup();
  let id = "";
  try {
    id = await makeWorkflow(prisma);
    const one = await import("../src/app/api/workflows/[id]/route");
    const page = (label: string) => ({ id: "p1", name: "Page 1", nodes: [mkNode("a", { label })], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });

    const first = await call(one.PUT, `/api/workflows/${id}`, { method: "PUT", params: { id }, body: { pages: [page("one")], baseRevision: 0 } });
    assert.equal(first.status, 200, first.text);
    assert.equal(first.body.revision, 1);

    const stale = await call(one.PUT, `/api/workflows/${id}`, { method: "PUT", params: { id }, body: { pages: [page("stale")], baseRevision: 0 } });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "conflict");
    assert.equal(stale.body.latestRevision, 1);
    const row = await prisma.workflowProject.findUniqueOrThrow({ where: { id } });
    assert.equal((row.pages as Json[])[0].nodes[0].data.label, "one", "the stale save wrote nothing");

    // approval, then an edit: no longer "approved"
    await prisma.workflowProject.update({ where: { id }, data: { status: "approved" } });
    const edited = await call(one.PUT, `/api/workflows/${id}`, { method: "PUT", params: { id }, body: { pages: [page("two")], baseRevision: 1 } });
    assert.equal(edited.status, 200, edited.text);
    assert.equal(edited.body.status, "modified_since_approval");

    // a save that sends no baseRevision still works (old behaviour) and still moves the revision on
    const legacy = await call(one.PUT, `/api/workflows/${id}`, { method: "PUT", params: { id }, body: { pages: [page("three")] } });
    assert.equal(legacy.status, 200);
    assert.equal(legacy.body.revision, 3);
  } finally {
    if (id) await prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});

test("saveOps: an editor's change keeps every hidden step; conflicts and wrong modes are refused", { skip }, async () => {
  const { prisma } = await setup();
  let id = "";
  try {
    id = await makeWorkflow(prisma);
    const { saveOps } = await import("../src/lib/workflow/access/ops-service");
    const { ADMIN } = await import("../src/lib/workflow/access/permissions");
    const editor = { kind: "member", level: "editor", editMode: "direct", canApprove: false, canComment: true, canAcceptSuggestions: false } as const;

    const ok = await saveOps({
      workflowId: id, baseRevision: 0, principal: editor,
      ops: [
        { op: "updateNode", pageId: "p1", nodeId: "a", patch: { label: "Edited by editor" } },
        { op: "addNode", pageId: "p1", node: { id: "new1", type: "stage", position: { x: 1, y: 1 }, data: { label: "New", type: "stage", notes: "" } } },
        { op: "deleteNode", pageId: "p1", nodeId: "b" },
      ],
    });
    assert.equal(ok.ok, true);
    const row = await prisma.workflowProject.findUniqueOrThrow({ where: { id } });
    const nodes = (row.pages as Json[])[0].nodes as Json[];
    assert.ok(nodes.some((n) => n.id === "hidden" && n.data.internalNotes === MARK), "the hidden step and its notes survived");
    assert.ok(nodes.some((n) => n.id === "a" && n.data.internalNotes === `${MARK} notes`), "an edited step kept its staff-only notes");
    assert.equal(row.revision, 1);
    assert.equal((row.nodes as Json[]).length, nodes.length, "legacy columns mirror page 1");

    const stale = await saveOps({ workflowId: id, baseRevision: 0, principal: editor, ops: [] });
    assert.deepEqual(stale, { ok: false, reason: "conflict", latestRevision: 1 });

    const suggestOnly = await saveOps({ workflowId: id, baseRevision: 1, principal: { ...editor, editMode: "suggest_only" }, ops: [] });
    assert.deepEqual(suggestOnly, { ok: false, reason: "forbidden" });
    const viewer = await saveOps({ workflowId: id, baseRevision: 1, principal: { ...editor, level: "viewer" }, ops: [] });
    assert.deepEqual(viewer, { ok: false, reason: "forbidden" });

    const missing = await saveOps({ workflowId: "nope", baseRevision: 0, principal: ADMIN, ops: [] });
    assert.deepEqual(missing, { ok: false, reason: "not_found" });

    await assert.rejects(
      saveOps({ workflowId: id, baseRevision: 1, principal: editor, ops: [{ op: "updateNode", pageId: "p1", nodeId: "hidden", patch: { label: "x" } }] }),
      (e: unknown) => (e as Error).name === "OpError"
    );
    const after = await prisma.workflowProject.findUniqueOrThrow({ where: { id } });
    assert.equal(after.revision, 1, "a refused change writes nothing");
  } finally {
    if (id) await prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});

test("diagram style: new workflows are Process Map, a template arrives arranged, the style can be switched and is client-visible", { skip }, async () => {
  const { call, prisma } = await setup();
  const ids: string[] = [];
  try {
    const list = await import("../src/app/api/workflows/route");
    const one = await import("../src/app/api/workflows/[id]/route");
    const tpl = await prisma.workflowTemplate.findFirst({ where: { name: "Interview scheduling and no-show recovery" } });

    const created = await call(list.POST, "/api/workflows", { method: "POST", body: { clientName: "Style test", workflowName: "Style flow", ...(tpl ? { templateId: tpl.id } : {}) } });
    assert.equal(created.status, 201, created.text);
    ids.push(created.body.id);
    const row = await prisma.workflowProject.findUniqueOrThrow({ where: { id: created.body.id } });
    assert.equal(row.diagramStyle, "process_map");
    assert.equal(row.numberingScheme, "decimal");
    assert.equal(row.look, "readable", "a new map gets the readable look");
    if (tpl) {
      const nodes = (row.pages as Json[])[0].nodes as Json[];
      const spineY = new Set(nodes.filter((n) => ["stage", "communication", "wait", "manual_action"].includes(n.type)).map((n) => Math.round(n.position.y)));
      assert.ok(spineY.size >= 1);
      assert.ok(nodes.every((n) => typeof n.position.x === "number"), "every step has a position");
    }

    const classic = await call(list.POST, "/api/workflows", { method: "POST", body: { clientName: "Style test", workflowName: "Classic flow", diagramStyle: "classic" } });
    ids.push(classic.body.id);
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id: classic.body.id } })).numberingScheme, "letters");

    const switched = await call(one.PUT, `/api/workflows/${classic.body.id}`, { method: "PUT", params: { id: classic.body.id }, body: { diagramStyle: "process_map" } });
    assert.equal(switched.status, 200, switched.text);
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id: classic.body.id } })).numberingScheme, "decimal");
    const bad = await call(one.PUT, `/api/workflows/${classic.body.id}`, { method: "PUT", params: { id: classic.body.id }, body: { diagramStyle: "fancy" } });
    assert.equal(bad.status, 400);

    // the client page data carries the style
    const { buildClientPagePayload } = await import("../src/lib/workflow/access/client-payload");
    const { ADMIN } = await import("../src/lib/workflow/access/permissions");
    const payload = await buildClientPagePayload(classic.body.id, { principal: { ...ADMIN, level: "viewer", kind: "link" }, identity: { displayName: null, verified: false } }, { needsName: false });
    assert.equal(payload?.workflow.diagramStyle, "process_map");
    assert.equal(payload?.workflow.look, "readable", "...and the client page carries the look");

    // The look can be switched either way; anything else is refused; an explicit "original" at creation is honoured.
    const toOriginal = await call(one.PUT, `/api/workflows/${classic.body.id}`, { method: "PUT", params: { id: classic.body.id }, body: { look: "original" } });
    assert.equal(toOriginal.status, 200, toOriginal.text);
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id: classic.body.id } })).look, "original");
    const badLook = await call(one.PUT, `/api/workflows/${classic.body.id}`, { method: "PUT", params: { id: classic.body.id }, body: { look: "fancy" } });
    assert.equal(badLook.status, 400);
    const keepOld = await call(list.POST, "/api/workflows", { method: "POST", body: { clientName: "Style test", workflowName: "Old look flow", look: "original" } });
    ids.push(keepOld.body.id);
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id: keepOld.body.id } })).look, "original");
  } finally {
    for (const id of ids) await prisma.workflowProject.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});
