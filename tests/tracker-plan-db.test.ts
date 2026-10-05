import test from "node:test";
import assert from "node:assert/strict";

/**
 * The standard plan against a real database: loading the catalogue, building a project's plan,
 * ticking and unticking, and what the client would see. Runs only against a LOCAL database
 * (TRACKER_TEST_DATABASE_URL pointing at localhost); skipped otherwise, so it can never touch live data.
 */

const testDb = process.env.TRACKER_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-tracker-plan-tests-0123456789";
}
const skip = !isLocalDb && "set TRACKER_TEST_DATABASE_URL to a localhost database";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function setup() {
  const { NextRequest } = await import("next/server");
  const { createToken } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/db");
  const cookie = `admin_token=${createToken("test-user-not-real")}`;
  const call = async (handler: any, url: string, opts: { method?: string; body?: unknown; params?: Json } = {}) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const req = new NextRequest(`http://localhost${url}`, {
      method: opts.method ?? "GET",
      headers: { "content-type": "application/json", cookie },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const res: Response = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : {}) as Json };
  };
  return { call, prisma };
}

test("the standard plan: load, tailor, tick and untick", { skip }, async () => {
  const { call, prisma } = await setup();
  const templateRoute = await import("../src/app/api/tracker/plan-template/route");
  const itemRoute = await import("../src/app/api/tracker/plan-template/items/[id]/route");
  const planRoute = await import("../src/app/api/tracker/projects/[id]/plan/route");
  const { STANDARD_ITEMS } = await import("../src/lib/tracker/plan-template-seed");
  const { findDependencyConflicts } = await import("../src/lib/tracker/schedule");
  const { isClientVisibleItem } = await import("../src/lib/tracker/visibility");

  const suffix = Date.now().toString(36);
  const account = await prisma.trackerAccount.create({ data: { name: `Plan test ${suffix}`, slug: `plan-test-${suffix}` } });
  const owner = await prisma.trackerPerson.create({ data: { accountId: null, side: "talkpush", name: `Owner ${suffix}` } });
  const project = await prisma.trackerProject.create({
    data: {
      accountId: account.id,
      title: "Plan test project",
      startDate: new Date("2026-10-05T00:00:00.000Z"), // a Monday
      ownerPersonId: owner.id,
      phases: { create: ["Scoping", "Configuration", "Integration", "UAT", "Training", "Go-live", "Hypercare"].map((name, sortOrder) => ({ name, sortOrder })) },
    },
  });
  const bare = await prisma.trackerProject.create({
    data: { accountId: account.id, title: "Plan test, no dates", phases: { create: [{ name: "Scoping", sortOrder: 0 }] } },
  });
  const params = { id: project.id };
  const keysOf = (items: Json[]) => items.map((i) => i.key as string);

  try {
    // Start from an empty catalogue (local test database only).
    await prisma.trackerPlanTemplate.deleteMany({});

    const empty = await call(templateRoute.GET, "/api/tracker/plan-template");
    assert.equal(empty.status, 200);
    assert.equal(empty.body.template, null);

    // Loading adds everything once and is safe to repeat.
    const first = await call(templateRoute.POST, "/api/tracker/plan-template", { method: "POST" });
    assert.equal(first.status, 201);
    assert.equal(first.body.created, STANDARD_ITEMS.length);
    const second = await call(templateRoute.POST, "/api/tracker/plan-template", { method: "POST" });
    assert.equal(second.body.created, 0);

    // Staff edits survive a reload, and a dependency loop is refused.
    const catalogue = await call(templateRoute.GET, "/api/tracker/plan-template");
    const kickoff = catalogue.body.items.find((i: Json) => i.key === "scoping-kickoff");
    const edited = await call(itemRoute.PATCH, `/api/tracker/plan-template/items/${kickoff.id}`, { method: "PATCH", params: { id: kickoff.id }, body: { title: "Kickoff call" } });
    assert.equal(edited.status, 200);
    const loop = await call(itemRoute.PATCH, `/api/tracker/plan-template/items/${kickoff.id}`, { method: "PATCH", params: { id: kickoff.id }, body: { dependsOnKeys: ["hypercare-exit"] } });
    assert.equal(loop.status, 400);
    await call(templateRoute.POST, "/api/tracker/plan-template", { method: "POST" });
    const afterReload = await call(templateRoute.GET, "/api/tracker/plan-template");
    assert.equal(afterReload.body.items.find((i: Json) => i.key === "scoping-kickoff").title, "Kickoff call");
    const badWindow = await call(itemRoute.PATCH, `/api/tracker/plan-template/items/${kickoff.id}`, { method: "PATCH", params: { id: kickoff.id }, body: { startDay: 5, endDay: 2 } });
    assert.equal(badWindow.status, 400);

    // A project with nothing built yet.
    const before = await call(planRoute.GET, `/api/tracker/projects/${project.id}/plan`, { params });
    assert.equal(before.status, 200);
    assert.equal(before.body.projectHasPlanItems, false);
    const defaults = keysOf(before.body.items.filter((i: Json) => i.defaultIncluded));

    // Build the default plan.
    const built = await call(planRoute.PUT, `/api/tracker/projects/${project.id}/plan`, { method: "PUT", params, body: { selectedKeys: defaults } });
    assert.equal(built.status, 200, JSON.stringify(built.body));
    assert.equal(built.body.created, defaults.length);
    assert.equal(built.body.restored + built.body.archived + built.body.kept, 0);
    assert.equal(built.body.hasStartDate, true);

    const items = await prisma.trackerItem.findMany({ where: { projectId: project.id }, include: { blockedBy: true } });
    const byKey = new Map(items.map((i) => [i.templateItemKey, i]));
    assert.equal(items.length, defaults.length);
    // Internal items are hidden from clients; client-side items have no owner; Talkpush items go to the project owner.
    assert.equal(byKey.get("config-admin-settings")!.visibility, "internal");
    assert.equal(isClientVisibleItem(byKey.get("config-admin-settings")!), false);
    assert.equal(byKey.get("scoping-workflow-signoff")!.visibility, "client_visible");
    assert.equal(byKey.get("scoping-workflow-signoff")!.ownerPersonId, owner.id);
    assert.equal(byKey.get("channel-email")!.ownerPersonId, null);
    // Dates come from the working-day offsets: Kickoff is days 1-2 = Mon 5 Oct to Tue 6 Oct.
    assert.equal(byKey.get("scoping-kickoff")!.startDate?.toISOString().slice(0, 10), "2026-10-05");
    assert.equal(byKey.get("scoping-kickoff")!.dueDate?.toISOString().slice(0, 10), "2026-10-06");
    assert.equal(byKey.get("hypercare-exit")!.dueDate?.toISOString().slice(0, 10), "2026-12-04");
    // Phases got their dates, items sit in the right phase, and nothing starts before its blocker is due.
    const phases = await prisma.trackerPhase.findMany({ where: { projectId: project.id } });
    const scoping = phases.find((p) => p.name === "Scoping")!;
    assert.equal(scoping.startDate?.toISOString().slice(0, 10), "2026-10-05");
    assert.equal(scoping.endDate?.toISOString().slice(0, 10), "2026-10-16");
    assert.equal(byKey.get("scoping-kickoff")!.phaseId, scoping.id);
    const edgeCount = items.reduce((n, i) => n + i.blockedBy.length, 0);
    assert.ok(edgeCount > 40, `expected many dependency links, got ${edgeCount}`);
    const conflicts = findDependencyConflicts(
      items.map((i) => ({
        id: i.id,
        title: i.title,
        status: i.status,
        startDate: i.startDate?.toISOString().slice(0, 10) ?? null,
        dueDate: i.dueDate?.toISOString().slice(0, 10) ?? null,
        isMilestone: i.isMilestone,
        blockedByItemIds: i.blockedBy.map((b) => b.blockedByItemId),
      }))
    );
    assert.deepEqual(conflicts, []);

    // Applying the same ticks again changes nothing.
    const again = await call(planRoute.PUT, `/api/tracker/projects/${project.id}/plan`, { method: "PUT", params, body: { selectedKeys: defaults } });
    assert.equal(again.body.created + again.body.restored + again.body.archived, 0);
    assert.equal(again.body.kept, defaults.length);
    assert.equal(await prisma.trackerItemDependency.count({ where: { item: { projectId: project.id } } }), edgeCount);

    // Unticking archives the item and removes the links that pointed at it. Nothing is deleted.
    const withoutLabels = defaults.filter((k) => k !== "crm-labels" && k !== "crm-folders");
    const removed = await call(planRoute.PUT, `/api/tracker/projects/${project.id}/plan`, { method: "PUT", params, body: { selectedKeys: withoutLabels } });
    assert.equal(removed.body.archived, 2);
    const archivedFolders = await prisma.trackerItem.findFirst({ where: { projectId: project.id, templateItemKey: "crm-folders" } });
    assert.equal(archivedFolders!.archived, true);
    assert.equal(await prisma.trackerItemDependency.count({ where: { blockedByItemId: archivedFolders!.id } }), 0);
    assert.equal(await prisma.trackerItem.count({ where: { projectId: project.id } }), defaults.length);

    // Ticking it again restores it (no duplicate) and re-links the items that wait on it.
    const restored = await call(planRoute.PUT, `/api/tracker/projects/${project.id}/plan`, { method: "PUT", params, body: { selectedKeys: defaults } });
    assert.equal(restored.body.restored, 2);
    assert.equal(restored.body.created, 0);
    assert.equal(await prisma.trackerItem.count({ where: { projectId: project.id, templateItemKey: "crm-folders" } }), 1);
    const waitingOnFolders = await prisma.trackerItemDependency.findMany({ where: { blockedByItemId: archivedFolders!.id } });
    assert.ok(waitingOnFolders.length >= 1, "autoflows should wait on folders again");

    // Work already started is protected unless the person confirms.
    await prisma.trackerItem.update({ where: { id: byKey.get("crm-labels")!.id }, data: { status: "in_progress" } });
    const withoutStarted = defaults.filter((k) => k !== "crm-labels");
    const guarded = await call(planRoute.PUT, `/api/tracker/projects/${project.id}/plan`, { method: "PUT", params, body: { selectedKeys: withoutStarted } });
    assert.equal(guarded.status, 400);
    assert.match(guarded.body.error, /already started/);
    assert.equal((await prisma.trackerItem.findUnique({ where: { id: byKey.get("crm-labels")!.id } }))!.archived, false);
    const confirmed = await call(planRoute.PUT, `/api/tracker/projects/${project.id}/plan`, { method: "PUT", params, body: { selectedKeys: withoutStarted, allowStarted: true } });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.archived, 1);

    // An unknown key is refused.
    const unknown = await call(planRoute.PUT, `/api/tracker/projects/${project.id}/plan`, { method: "PUT", params, body: { selectedKeys: ["not-a-real-key"] } });
    assert.equal(unknown.status, 400);

    // A project with no start date still gets its items, just without dates. Missing blockers are reported.
    const bareParams = { id: bare.id };
    const partial = await call(planRoute.PUT, `/api/tracker/projects/${bare.id}/plan`, { method: "PUT", params: bareParams, body: { selectedKeys: ["crm-autoflows"] } });
    assert.equal(partial.status, 200);
    assert.equal(partial.body.created, 1);
    assert.equal(partial.body.hasStartDate, false);
    assert.equal(partial.body.droppedDependencies.length, 4);
    const bareItem = await prisma.trackerItem.findFirst({ where: { projectId: bare.id } });
    assert.equal(bareItem!.dueDate, null);
    assert.equal(bareItem!.startDate, null);
    // The phase the item needs was created because this project only had Scoping.
    assert.ok(await prisma.trackerPhase.findFirst({ where: { projectId: bare.id, name: "Configuration" } }));

    // An archived project cannot be changed.
    await prisma.trackerProject.update({ where: { id: bare.id }, data: { archived: true } });
    const archivedTry = await call(planRoute.PUT, `/api/tracker/projects/${bare.id}/plan`, { method: "PUT", params: bareParams, body: { selectedKeys: [] } });
    assert.equal(archivedTry.status, 400);

    // Every change was recorded in the activity log.
    assert.ok((await prisma.trackerActivity.count({ where: { projectId: project.id, action: "project.plan_applied" } })) >= 5);
  } finally {
    await prisma.trackerActivity.deleteMany({ where: { projectId: { in: [project.id, bare.id] } } });
    await prisma.trackerItem.deleteMany({ where: { projectId: { in: [project.id, bare.id] } } });
    await prisma.trackerProject.deleteMany({ where: { id: { in: [project.id, bare.id] } } });
    await prisma.trackerPerson.deleteMany({ where: { id: owner.id } });
    await prisma.trackerAccount.deleteMany({ where: { id: account.id } });
    await prisma.$disconnect();
  }
});
