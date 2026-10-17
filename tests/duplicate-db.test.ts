import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

/**
 * Duplicating a tracker project and a workflow. The database parts run only against a LOCAL database
 * (TRACKER_TEST_DATABASE_URL pointing at localhost); skipped otherwise, so they can never touch live data.
 */
const testDb = process.env.TRACKER_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) process.env.DATABASE_URL_DIRECT = testDb;
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
const skip = !isLocalDb && "set TRACKER_TEST_DATABASE_URL to a localhost database";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

test("cloneGraphWithFreshIds: new ids everywhere, jump and note links follow the copy", async () => {
  const { cloneGraphWithFreshIds } = await import("../src/lib/workflow/duplicate");
  const nodes = [
    { id: "a", type: "stage", position: { x: 0, y: 0 }, data: { label: "A" } },
    { id: "b", type: "jump", position: { x: 0, y: 0 }, data: { label: "Go", jumpToNodeId: "a" } },
    { id: "n", type: "note", position: { x: 0, y: 0 }, data: { label: "Note", attachTo: "a" } },
    { id: "z", type: "jump", position: { x: 0, y: 0 }, data: { label: "Elsewhere", jumpToNodeId: "not-on-this-page" } },
  ];
  const edges = [
    { id: "e1", source: "a", target: "b", data: {} },
    { id: "e2", source: "a", target: "gone", data: {} },
  ];
  const copy = cloneGraphWithFreshIds(nodes as never, edges as never);
  const [a, b, n, z] = copy.nodes as Json[];
  assert.ok(copy.nodes.every((x, i) => x.id !== nodes[i].id));
  assert.equal(b.data.jumpToNodeId, a.id, "a jump points at the copied step");
  assert.equal(n.data.attachTo, a.id, "a note stays attached to the copied step");
  assert.equal(z.data.jumpToNodeId, "not-on-this-page", "a link to something not copied is left alone");
  assert.equal(copy.edges.length, 1, "a connector to a step that is not in the copy is dropped");
  assert.equal(copy.edges[0].source, a.id);
  assert.equal(copy.edges[0].target, b.id);
  assert.equal(nodes[1].data.jumpToNodeId, "a", "the original is untouched");
});

test("duplicate a tracker project: plan comes across, progress and private things do not", { skip }, async () => {
  const { prisma } = await import("../src/lib/db");
  const { duplicateProject } = await import("../src/lib/tracker/project-service");
  const tag = randomUUID().slice(0, 8);
  const actor = { label: "tester", via: "web" as const };

  const account = await prisma.trackerAccount.create({ data: { name: `Dup test ${tag}`, slug: `dup-test-${tag}` } });
  const other = await prisma.trackerAccount.create({ data: { name: `Dup other ${tag}`, slug: `dup-other-${tag}` } });
  const owner = await prisma.trackerPerson.create({ data: { accountId: account.id, side: "client", name: "Olive Owner" } });
  const checklist = await prisma.checklist.create({ data: { slug: `dup-${tag}`, clientName: `Dup ${tag}` } });
  const source = await prisma.trackerProject.create({
    data: {
      accountId: account.id,
      title: `Rollout ${tag}`,
      objective: "Go live",
      status: "active",
      startDate: new Date("2026-01-05"),
      targetDate: new Date("2026-03-01"),
      originalTargetDate: new Date("2026-02-01"),
      rescheduleCount: 2,
      healthOverride: "at_risk",
      ownerPersonId: owner.id,
      checklistId: checklist.id,
    },
  });
  const [scoping, uat] = await Promise.all([
    prisma.trackerPhase.create({ data: { projectId: source.id, name: "Scoping", sortOrder: 0, exitCriteria: "Signed off", startDate: new Date("2026-01-05") } }),
    prisma.trackerPhase.create({ data: { projectId: source.id, name: "UAT", sortOrder: 1 } }),
  ]);
  const first = await prisma.trackerItem.create({
    data: {
      projectId: source.id, phaseId: scoping.id, title: "Kickoff call", description: "Agree scope", type: "decision", priority: "high",
      status: "done", completedAt: new Date(), ownerPersonId: owner.id, startDate: new Date("2026-01-06"), dueDate: new Date("2026-01-10"),
      links: [{ url: "https://example.atlassian.net/browse/ABC-1" }], checklistTabSlug: "sites", templateItemKey: "kickoff", sortOrder: 0,
      isMilestone: true, visibility: "internal", staffReviewedAt: new Date(),
    },
  });
  const second = await prisma.trackerItem.create({
    data: { projectId: source.id, phaseId: uat.id, title: "Run UAT", status: "blocked", blockerReason: "Waiting on data", waitingOn: "Client", sortOrder: 1 },
  });
  const gone = await prisma.trackerItem.create({ data: { projectId: source.id, title: "Old idea", archived: true, sortOrder: 2 } });
  await prisma.trackerItemDependency.createMany({
    data: [
      { itemId: second.id, blockedByItemId: first.id },
      { itemId: second.id, blockedByItemId: gone.id },
    ],
  });
  await prisma.trackerRemark.create({ data: { itemId: first.id, body: "Private note", authorLabel: "me" } });
  const metric = await prisma.trackerMetric.create({
    data: { projectId: source.id, name: "Time to hire", unit: "days", direction: "lower_is_better", baselineValue: 21, targetValue: 14, currentValue: 18, source: "ATS", sortOrder: 0 },
  });
  await prisma.trackerMetric.create({ data: { projectId: source.id, name: "Retired metric", unit: "%", archived: true } });
  await prisma.trackerMetricReading.create({ data: { metricId: metric.id, value: 18, asOf: new Date("2026-02-01") } });
  await prisma.trackerProjectFile.create({
    data: { projectId: source.id, fileName: "contract.pdf", mimeType: "application/pdf", sizeBytes: 10, storagePath: `dup-${tag}/contract.pdf`, uploadedBy: "me" },
  });
  await prisma.trackerShareLink.create({ data: { projectId: source.id, kind: "viewer", tokenHash: `hash-${tag}`, createdBy: "me" } });
  const created: string[] = [];

  try {
    // Same account, default name.
    const copy = await duplicateProject(source.id, {}, actor);
    created.push(copy.id);
    assert.equal(copy.title, `Rollout ${tag} (Copy)`);
    assert.equal(copy.accountId, account.id);
    assert.equal(copy.objective, "Go live");
    assert.equal(copy.status, "planned");
    assert.equal(copy.startDate, null);
    assert.equal(copy.targetDate, null);
    assert.equal(copy.originalTargetDate, null);
    assert.equal(copy.rescheduleCount, 0);
    assert.equal(copy.healthOverride, null);
    assert.equal(copy.checklistId, null, "the checklist link is not copied");
    assert.equal(copy.owner?.id, owner.id, "owner stays on the same account");

    const phases = await prisma.trackerPhase.findMany({ where: { projectId: copy.id }, orderBy: { sortOrder: "asc" } });
    assert.deepEqual(phases.map((p) => p.name), ["Scoping", "UAT"]);
    assert.equal(phases[0].exitCriteria, "Signed off");
    assert.equal(phases[0].startDate, null, "phase dates are cleared");
    assert.ok(phases.every((p) => p.id !== scoping.id && p.id !== uat.id));

    const items = await prisma.trackerItem.findMany({ where: { projectId: copy.id }, orderBy: { sortOrder: "asc" } });
    assert.deepEqual(items.map((i) => i.title), ["Kickoff call", "Run UAT"], "archived items are left behind");
    const [k, u] = items;
    assert.equal(k.phaseId, phases[0].id, "items land in the copied phase, not the original's");
    assert.equal(u.phaseId, phases[1].id);
    assert.equal(k.status, "not_started");
    assert.equal(k.completedAt, null);
    assert.equal(k.ownerPersonId, null);
    assert.equal(k.startDate, null);
    assert.equal(k.dueDate, null);
    assert.deepEqual(k.links, [], "Jira links are cleared");
    assert.equal(u.status, "not_started");
    assert.equal(u.blockerReason, null);
    assert.equal(u.waitingOn, null);
    assert.equal(k.description, "Agree scope");
    assert.equal(k.type, "decision");
    assert.equal(k.priority, "high");
    assert.equal(k.isMilestone, true);
    assert.equal(k.visibility, "internal");
    assert.equal(k.checklistTabSlug, "sites");
    assert.equal(k.templateItemKey, "kickoff");
    assert.equal(k.staffReviewedAt, null);
    assert.equal(k.createdVia, "web");

    const deps = await prisma.trackerItemDependency.findMany({ where: { itemId: { in: items.map((i) => i.id) } } });
    assert.equal(deps.length, 1, "only the dependency between copied items is kept");
    assert.equal(deps[0].itemId, u.id);
    assert.equal(deps[0].blockedByItemId, k.id);

    const metrics = await prisma.trackerMetric.findMany({ where: { projectId: copy.id } });
    assert.equal(metrics.length, 1, "archived metrics are left behind");
    assert.equal(metrics[0].name, "Time to hire");
    assert.equal(metrics[0].direction, "lower_is_better");
    assert.equal(metrics[0].targetValue, 14);
    assert.equal(metrics[0].baselineValue, null);
    assert.equal(metrics[0].currentValue, null);
    assert.equal(await prisma.trackerMetricReading.count({ where: { metricId: metrics[0].id } }), 0);

    assert.equal(await prisma.trackerRemark.count({ where: { itemId: { in: items.map((i) => i.id) } } }), 0);
    assert.equal(await prisma.trackerProjectFile.count({ where: { projectId: copy.id } }), 0);
    assert.equal(await prisma.trackerShareLink.count({ where: { projectId: copy.id } }), 0);
    const activity = await prisma.trackerActivity.findMany({ where: { projectId: copy.id } });
    assert.equal(activity.length, 1, "the copy starts with just its own 'created' entry");
    assert.equal(activity[0].action, "project.created");

    // The original is exactly as it was.
    const still = await prisma.trackerItem.findUniqueOrThrow({ where: { id: first.id } });
    assert.equal(still.status, "done");
    assert.equal(await prisma.trackerRemark.count({ where: { itemId: first.id } }), 1);
    assert.equal(await prisma.trackerProjectFile.count({ where: { projectId: source.id } }), 1);

    // Own title, another account: the owner (a person of the first account) is not carried over.
    const moved = await duplicateProject(source.id, { title: "Next client plan", accountId: other.id }, actor);
    created.push(moved.id);
    assert.equal(moved.title, "Next client plan");
    assert.equal(moved.accountId, other.id);
    assert.equal(moved.owner, null);

    await assert.rejects(() => duplicateProject("does-not-exist", {}, actor), /not found/i);
    await assert.rejects(() => duplicateProject(source.id, { accountId: "does-not-exist" }, actor), /not found/i);
    await assert.rejects(() => duplicateProject(source.id, { title: "   " }, actor));
  } finally {
    await prisma.trackerProject.deleteMany({ where: { id: { in: [source.id, ...created] } } });
    await prisma.trackerPerson.deleteMany({ where: { id: owner.id } });
    await prisma.trackerAccount.deleteMany({ where: { id: { in: [account.id, other.id] } } });
    await prisma.checklist.deleteMany({ where: { id: checklist.id } });
  }
});

test("duplicate a workflow: every page and its look come across, sharing and review history do not", { skip }, async () => {
  const { prisma } = await import("../src/lib/db");
  const { duplicateWorkflowProject } = await import("../src/lib/workflow/duplicate");
  const tag = randomUUID().slice(0, 8);
  const account = await prisma.trackerAccount.create({ data: { name: `Dup wf ${tag}`, slug: `dup-wf-${tag}` } });
  const node = (id: string, label: string, extra: Json = {}) => ({ id, type: "stage", position: { x: 10, y: 20 }, data: { label, ...extra } });
  const page1 = {
    id: "page_one",
    name: "Application",
    nodes: [node("p1a", "Apply"), node("p1b", "Screen"), node("p1j", "Go", { jumpToNodeId: "p1a" })],
    edges: [{ id: "p1e", source: "p1a", target: "p1b", type: "custom", data: {} }],
    viewport: { x: 5, y: 6, zoom: 0.5 },
  };
  const page2 = {
    id: "page_two",
    name: "Interview",
    nodes: [node("p2a", "Schedule")],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
  const source = await prisma.workflowProject.create({
    data: {
      clientName: "Acme", accountId: account.id, workflowName: `Hiring ${tag}`, description: "How we hire", status: "published",
      diagramStyle: "process_map", numberingScheme: "decimal", look: "readable", showFeasibility: true,
      shareToken: `share-${tag}`, generalAccess: "anyone_with_link", currentVersion: 3, revision: 9,
      nodes: page1.nodes, edges: page1.edges, viewport: page1.viewport, pages: [page1, page2],
    },
  });
  await prisma.workflowComment.create({ data: { workflowId: source.id, pageId: "page_one", body: "Check this", authorName: "Rae" } });
  await prisma.workflowScopingArtifact.create({ data: { workflowId: source.id, kind: "open_question", title: "Q", detail: "?" } });
  const created: string[] = [];

  try {
    const copy = await duplicateWorkflowProject(source.id);
    assert.ok(copy);
    created.push(copy.id);
    assert.equal(copy.pageCount, 2);
    const row = await prisma.workflowProject.findUniqueOrThrow({ where: { id: copy.id } });
    assert.equal(row.workflowName, `Hiring ${tag} (Copy)`);
    assert.equal(row.clientName, "Acme");
    assert.equal(row.accountId, account.id);
    assert.equal(row.description, "How we hire");
    assert.equal(row.diagramStyle, "process_map");
    assert.equal(row.numberingScheme, "decimal");
    assert.equal(row.look, "readable");
    assert.equal(row.showFeasibility, true);
    assert.equal(row.status, "draft");
    assert.equal(row.shareToken, null);
    assert.equal(row.generalAccess, "restricted");
    assert.equal(row.currentVersion, 0);
    assert.equal(row.revision, 0);

    const pages = row.pages as Json[];
    assert.deepEqual(pages.map((p) => p.name), ["Application", "Interview"]);
    assert.ok(pages.every((p, i) => p.id !== [page1, page2][i].id), "pages get new ids");
    assert.deepEqual(pages[0].viewport, page1.viewport);
    const [a, b, j] = pages[0].nodes as Json[];
    assert.ok([a, b, j].every((n) => !["p1a", "p1b", "p1j"].includes(n.id)), "steps get new ids");
    assert.equal(j.data.jumpToNodeId, a.id);
    const [e] = pages[0].edges as Json[];
    assert.equal(e.source, a.id);
    assert.equal(e.target, b.id);
    assert.equal((pages[1].nodes as Json[])[0].data.label, "Schedule");
    assert.deepEqual(row.nodes, pages[0].nodes, "the single-canvas columns mirror the first page");
    assert.deepEqual(row.edges, pages[0].edges);

    assert.equal(await prisma.workflowComment.count({ where: { workflowId: copy.id } }), 0);
    assert.equal(await prisma.workflowScopingArtifact.count({ where: { workflowId: copy.id } }), 0);
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id: source.id } })).shareToken, `share-${tag}`);

    const named = await duplicateWorkflowProject(source.id, { workflowName: "Renamed copy" });
    created.push(named!.id);
    assert.equal((await prisma.workflowProject.findUniqueOrThrow({ where: { id: named!.id } })).workflowName, "Renamed copy");

    assert.equal(await duplicateWorkflowProject("does-not-exist"), null);
  } finally {
    await prisma.workflowProject.deleteMany({ where: { id: { in: [source.id, ...created] } } });
    await prisma.trackerAccount.deleteMany({ where: { id: account.id } });
  }
});
