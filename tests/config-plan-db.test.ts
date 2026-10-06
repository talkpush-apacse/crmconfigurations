import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

/**
 * The configuration plan against a real database: which workflow version is read, name lookup, safety around
 * secrets, the Claude tool and the staff route. Runs only against a LOCAL database
 * (TRACKER_TEST_DATABASE_URL pointing at localhost); skipped otherwise.
 */

const testDb = process.env.TRACKER_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-config-plan-tests-0123456789";
}
const skip = !isLocalDb && "set TRACKER_TEST_DATABASE_URL to a localhost database";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const SECRET_ADMIN = "SECRET_ADMIN_SETTINGS_VALUE";
const SECRET_EMAIL = "secret.user@example.invalid";

const stage = (id: string, folder: string) => ({ id, type: "stage", position: { x: 0, y: 0 }, data: { label: folder, type: "stage", actor: "automated", notes: "", feasibility: "confirmed", data: { targetFolder: folder } } });

test("configuration plan: loading, versions, lookups and safety", { skip }, async () => {
  const { NextRequest } = await import("next/server");
  const { createToken } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/db");
  const { loadConfigPlan } = await import("../src/lib/config-plan/service");
  const { getConfigPlanTool } = await import("../src/lib/mcp/config-plan");
  const route = await import("../src/app/api/tracker/projects/[id]/config-plan/route");

  // Staff routes look the login up in the database (requireAuth), so the test cookie needs a real editor login.
  const staffUser = await prisma.adminUser.create({ data: { email: `staff-${randomUUID()}@example.invalid`, role: "editor" }, select: { id: true } });
  const suffix = Date.now().toString(36);
  const client = `Configplan Test ${suffix}`;
  const checklist = await prisma.checklist.create({
    data: {
      slug: `configplan-${suffix}`,
      clientName: client,
      folders: [{ id: "f1", folderName: "New" }, { id: "f2", folderName: "Signed Off" }],
      users: [{ id: "u1", name: "Ana", accessType: "Recruiter", email: SECRET_EMAIL }],
      adminSettings: { telerivetProjectId: SECRET_ADMIN },
    },
  });
  const workflow = await prisma.workflowProject.create({
    data: { clientName: client, workflowName: `Hiring flow ${suffix}`, pages: [{ id: "p1", name: "Main", nodes: [stage("a", "Draft Only")], edges: [] }] },
  });
  const version = await prisma.workflowVersion.create({
    data: {
      workflowId: workflow.id,
      versionNumber: 1,
      status: "published",
      triggeredBy: "manual",
      nodes: [],
      edges: [],
      pages: [{ id: "p1", name: "Main", nodes: [stage("a", "Signed Off")], edges: [] }],
      nodeCount: 1,
      edgeCount: 0,
    },
  });
  const unpublished = await prisma.workflowProject.create({
    data: { clientName: client, workflowName: `Unpublished ${suffix}`, pages: [{ id: "p1", name: "Main", nodes: [stage("a", "Only Draft")], edges: [] }] },
  });
  const otherClient = await prisma.workflowProject.create({
    data: { clientName: `Someone else ${suffix}`, workflowName: `Other ${suffix}`, pages: [{ id: "p1", name: "Main", nodes: [stage("a", "Other")], edges: [] }] },
  });
  const tracked = await prisma.trackerAccount.create({ data: { name: `Cfg ${suffix}`, slug: `cfg-${suffix}` } });
  const project = await prisma.trackerProject.create({ data: { accountId: tracked.id, title: "Cfg project", checklistId: checklist.id } });
  const unlinked = await prisma.trackerProject.create({ data: { accountId: tracked.id, title: "No checklist" } });
  const folders = (plan: Json, source?: string) => (plan.sections.find((s: Json) => s.key === "folders")?.entries ?? []).filter((e: Json) => !source || e.source === source).map((e: Json) => e.name).sort();

  try {
    await prisma.workflowProject.update({ where: { id: workflow.id }, data: { publishedVersionId: version.id } });

    // The published version is read by default; the current draft only when asked.
    const published = await loadConfigPlan({ checklist: checklist.slug, workflow: workflow.id });
    assert.equal(published.workflow!.version, "published");
    assert.deepEqual(folders(published, "both"), ["Signed Off"]);
    assert.ok(!JSON.stringify(published).includes("Draft Only"));
    const current = await loadConfigPlan({ checklist: checklist.slug, workflow: workflow.id, version: "current" });
    assert.equal(current.workflow!.version, "current");
    assert.deepEqual(folders(current, "workflow"), ["Draft Only"]);

    // By checklist id, and by workflow name.
    assert.equal((await loadConfigPlan({ checklist: checklist.id, workflow: `Hiring flow ${suffix}` })).workflow!.id, workflow.id);

    // No published version: use the draft and say so.
    const draft = await loadConfigPlan({ checklist: checklist.slug, workflow: unpublished.id });
    assert.equal(draft.workflow!.version, "current");
    assert.ok(draft.warnings.some((w) => /no published version/.test(w)));

    // A workflow for another client is allowed but flagged.
    const mismatch = await loadConfigPlan({ checklist: checklist.slug, workflow: otherClient.id });
    assert.ok(mismatch.warnings.some((w) => /Check you picked the right pair/.test(w)));

    // No workflow: a checklist-only plan.
    assert.equal((await loadConfigPlan({ checklist: checklist.slug })).workflow, null);

    // Secrets never come out, even though they are in the database.
    const everything = JSON.stringify([published, current, draft, mismatch]);
    assert.ok(!everything.includes(SECRET_ADMIN));
    assert.ok(!everything.includes(SECRET_EMAIL));

    // Problems are reported in plain words.
    await assert.rejects(() => loadConfigPlan({ checklist: "no-such-checklist" }), /not found/);
    await assert.rejects(() => loadConfigPlan({ checklist: "   " }), /Say which checklist/);
    await assert.rejects(() => loadConfigPlan({ checklist: checklist.slug, workflow: "no such workflow anywhere" }), /not found/);
    const twin = await prisma.workflowProject.create({ data: { clientName: client, workflowName: `Hiring flow ${suffix}`, pages: [] } });
    await assert.rejects(() => loadConfigPlan({ checklist: checklist.slug, workflow: `Hiring flow ${suffix}` }), /More than one workflow/);
    await prisma.workflowProject.delete({ where: { id: twin.id } });

    // The Claude tool: summary first, full on request, read-only.
    assert.equal(getConfigPlanTool.access, "read");
    const handler = (getConfigPlanTool as unknown as { handler: (a: Json, c: Json) => Promise<Json> }).handler;
    const summary = await handler({ checklist: checklist.slug, workflow: workflow.id, detail: "summary" }, {});
    assert.ok(Array.isArray(summary.buildOrder) && summary.buildOrder.length > 0);
    assert.equal(summary.plan, undefined);
    const full = await handler({ checklist: checklist.slug, workflow: workflow.id, detail: "full" }, {});
    assert.match(full.markdown, /# Configuration plan/);
    assert.ok(full.plan.sections.length > 0);

    // The staff route.
    const cookie = `admin_token=${createToken(staffUser.id)}`;
    const call = async (id: string, qs = "", withCookie = true) => {
      const req = new NextRequest(`http://localhost/api/tracker/projects/${id}/config-plan${qs}`, { headers: withCookie ? { cookie } : {} });
      const res: Response = await route.GET(req, { params: Promise.resolve({ id }) });
      return { status: res.status, body: (await res.json()) as Json };
    };
    assert.equal((await call(project.id, "", false)).status, 401);
    assert.equal((await call(unlinked.id)).status, 400);
    assert.equal((await call("no-such-project")).status, 404);
    const first = await call(project.id);
    assert.equal(first.status, 200);
    assert.equal(first.body.candidates.length, 2, "this client has two workflows");
    assert.equal(first.body.selectedWorkflowId, null, "two candidates: nothing is picked for the person");
    assert.equal(first.body.plan.workflow, null);
    const picked = await call(project.id, `?workflow=${workflow.id}&version=published`);
    assert.equal(picked.body.selectedWorkflowId, workflow.id);
    assert.match(picked.body.markdown, /Signed Off/);
    await prisma.workflowProject.delete({ where: { id: unpublished.id } });
    const only = await call(project.id);
    assert.equal(only.body.selectedWorkflowId, workflow.id, "the only workflow is used when nothing is picked");
  } finally {
    await prisma.trackerProject.deleteMany({ where: { id: { in: [project.id, unlinked.id] } } });
    await prisma.trackerAccount.deleteMany({ where: { id: tracked.id } });
    await prisma.workflowProject.updateMany({ where: { id: workflow.id }, data: { publishedVersionId: null } });
    await prisma.workflowVersion.deleteMany({ where: { workflowId: workflow.id } });
    await prisma.workflowProject.deleteMany({ where: { id: { in: [workflow.id, unpublished.id, otherClient.id] } } });
    await prisma.checklist.deleteMany({ where: { id: checklist.id } });
    await prisma.adminUser.deleteMany({ where: { id: staffUser.id } });
    await prisma.$disconnect();
  }
});
