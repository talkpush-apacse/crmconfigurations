import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

/**
 * Client contributor links against a real database: what the public routes accept, refuse and return.
 * Runs only against a LOCAL database (TRACKER_TEST_DATABASE_URL pointing at localhost); skipped otherwise.
 */

const testDb = process.env.TRACKER_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-tracker-contributor-tests-0123456789";
}
const skip = !isLocalDb && "set TRACKER_TEST_DATABASE_URL to a localhost database";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const SECRET_INTERNAL = "SECRET_INTERNAL_ITEM_TITLE";
const SECRET_BLOCKER = "SECRET_BLOCKER_REASON_TEXT";
const SECRET_EMAIL = "secret.person@example.invalid";

async function setup() {
  const { NextRequest } = await import("next/server");
  const { createToken } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/db");
  // Staff routes look the login up in the database (requireAuth), so the test cookie needs a real editor login.
  const staffUser = await prisma.adminUser.create({ data: { email: `staff-${randomUUID()}@example.invalid`, role: "editor" }, select: { id: true } });
  const staffCookie = `admin_token=${createToken(staffUser.id)}`;
  let ip = 0;
  const call = async (handler: any, url: string, opts: { method?: string; body?: unknown; params?: Json; staff?: boolean; ip?: string; raw?: string; contentType?: string } = {}) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const headers: Record<string, string> = { "x-forwarded-for": opts.ip ?? `10.0.0.${++ip}` };
    if (opts.body !== undefined || opts.raw !== undefined) headers["content-type"] = opts.contentType ?? "application/json";
    if (opts.staff) headers.cookie = staffCookie;
    const req = new NextRequest(`http://localhost${url}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
    });
    const res: Response = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
    const text = await res.text();
    let body: Json = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    return { status: res.status, text, body, headers: res.headers };
  };
  return { call, prisma, staffUserId: staffUser.id };
}

test("client contributor links", { skip }, async () => {
  const { call, prisma, staffUserId } = await setup();
  // Both test files use the one global plan catalogue, and the test runner runs files at the same time.
  // A database lock makes them take turns (the pool has one connection, so the lock lasts the whole test).
  await prisma.$executeRaw`SELECT pg_advisory_lock(727001)`;
  const links = await import("../src/app/api/tracker/projects/[id]/contributor-links/route");
  const viewRoute = await import("../src/app/api/contribute/[token]/route");
  const itemsRoute = await import("../src/app/api/contribute/[token]/items/route");
  const itemRoute = await import("../src/app/api/contribute/[token]/items/[itemId]/route");
  const remarksRoute = await import("../src/app/api/contribute/[token]/items/[itemId]/remarks/route");
  const viewerRoute = await import("../src/app/api/share/[token]/route");
  const reviewRoute = await import("../src/app/api/tracker/items/[id]/review/route");
  const reviewAllRoute = await import("../src/app/api/tracker/projects/[id]/review-all/route");
  const { resetContributorLimiters } = await import("../src/lib/tracker/contributor-route");
  const { createViewerLink, revokeShareLink } = await import("../src/lib/tracker/share-service");
  const { getProjectDetail } = await import("../src/lib/tracker/project-service");
  const { CLIENT_LIMITS } = await import("../src/lib/tracker/contributor-validations");

  const suffix = Date.now().toString(36);
  const account = await prisma.trackerAccount.create({ data: { name: `Contributor test ${suffix}`, slug: `contrib-test-${suffix}` } });
  const otherAccount = await prisma.trackerAccount.create({ data: { name: `Other ${suffix}`, slug: `contrib-other-${suffix}` } });
  const ana = await prisma.trackerPerson.create({ data: { accountId: account.id, side: "client", name: "Ana Reyes", email: SECRET_EMAIL } });
  const ben = await prisma.trackerPerson.create({ data: { accountId: account.id, side: "client", name: "Ben Cruz" } });
  const staffPerson = await prisma.trackerPerson.create({ data: { accountId: null, side: "talkpush", name: `Staff ${suffix}` } });
  const stranger = await prisma.trackerPerson.create({ data: { accountId: otherAccount.id, side: "client", name: "Zed Other" } });
  const project = await prisma.trackerProject.create({
    data: {
      accountId: account.id,
      title: "Contributor test project",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      targetDate: new Date("2026-12-01T00:00:00.000Z"),
      phases: { create: [{ name: "Configuration", sortOrder: 0 }] },
    },
  });
  const other = await prisma.trackerProject.create({ data: { accountId: otherAccount.id, title: "Someone else's project" } });
  const mk = (title: string, data: Json = {}) =>
    prisma.trackerItem.create({ data: { projectId: project.id, title, visibility: "client_visible", sortOrder: 0, ...data } });
  const internal = await mk(SECRET_INTERNAL, { visibility: "internal", ownerPersonId: staffPerson.id });
  const talkpush = await mk("Talkpush builds the autoflows", { ownerPersonId: staffPerson.id });
  const mine = await mk("Provide DNS records", { ownerPersonId: ana.id, dueDate: new Date("2026-10-01T00:00:00.000Z") });
  const blockedMine = await mk("Approve templates", { ownerPersonId: ana.id, status: "blocked", blockerReason: SECRET_BLOCKER });
  const bens = await mk("Ben's item", { ownerPersonId: ben.id });
  const unassignedClient = await mk("Name your champions", { templateItemKey: "test-client-key" });
  const othersItem = await prisma.trackerItem.create({ data: { projectId: other.id, title: "Other project item", visibility: "client_visible" } });
  const template = await prisma.trackerPlanTemplate.create({
    data: { name: `Contrib test template ${suffix}`, items: { create: [{ key: "test-client-key", phaseName: "Scoping", groupName: "g", title: "Name your champions", audience: "client" }] } },
  });

  const staff = { staff: true };
  const params = { id: project.id };
  const tokenFor = async (personId: string, extra: Json = {}) => {
    const res = await call(links.POST, `/api/tracker/projects/${project.id}/contributor-links`, { method: "POST", params, body: { personId, ...extra }, ...staff });
    assert.equal(res.status, 201, res.text);
    return res.body as { id: string; token: string; itemsAssigned: number };
  };

  try {
    // ---- staff creates links: only for a client contact of this project's account
    assert.equal((await call(links.POST, `/api/tracker/projects/${project.id}/contributor-links`, { method: "POST", params, body: { personId: staffPerson.id }, ...staff })).status, 400);
    assert.equal((await call(links.POST, `/api/tracker/projects/${project.id}/contributor-links`, { method: "POST", params, body: { personId: stranger.id }, ...staff })).status, 400);
    assert.equal((await call(links.POST, `/api/tracker/projects/${project.id}/contributor-links`, { method: "POST", params, body: { personId: ana.id } })).status, 401, "staff route must need a login");

    const anaLink = await tokenFor(ana.id, { assignUnassigned: true });
    assert.ok(anaLink.token.startsWith("tpc_"));
    assert.equal(anaLink.itemsAssigned, 1, "the unassigned client item goes to Ana");
    assert.equal((await prisma.trackerItem.findUnique({ where: { id: unassignedClient.id } }))!.ownerPersonId, ana.id);
    const stored = await prisma.trackerShareLink.findUnique({ where: { id: anaLink.id } });
    assert.notEqual(stored!.tokenHash, anaLink.token, "only a hash is stored");
    assert.equal(stored!.kind, "contributor");
    assert.equal(stored!.personId, ana.id);

    const T = { token: anaLink.token };
    const get = () => call(viewRoute.GET, `/api/contribute/${T.token}`, { params: T });
    const post = (body: unknown, extra: Json = {}) => call(itemsRoute.POST, `/api/contribute/${T.token}/items`, { method: "POST", params: T, body, ...extra });
    const patch = (itemId: string, body: unknown) => call(itemRoute.PATCH, `/api/contribute/${T.token}/items/${itemId}`, { method: "PATCH", params: { ...T, itemId }, body });
    const note = (itemId: string, body: unknown) => call(remarksRoute.POST, `/api/contribute/${T.token}/items/${itemId}/remarks`, { method: "POST", params: { ...T, itemId }, body });

    // ---- bad, wrong-kind and unknown links all look the same
    resetContributorLimiters();
    const nothing = await call(viewRoute.GET, "/api/contribute/nonsense", { params: { token: "nonsense" } });
    assert.equal(nothing.status, 404);
    assert.deepEqual(nothing.body, { error: "Not found" });
    const unknown = await call(viewRoute.GET, "/api/contribute/tpc_" + "a".repeat(43), { params: { token: "tpc_" + "a".repeat(43) } });
    assert.deepEqual(unknown.body, { error: "Not found" });
    const viewer = await createViewerLink(project.id, {}, { label: "test", via: "web" });
    const wrongKind = await call(viewRoute.GET, `/api/contribute/${viewer.token}`, { params: { token: viewer.token } });
    assert.equal(wrongKind.status, 404);
    const viewerOnShare = await call(viewerRoute.GET, `/api/share/${T.token}`, { params: T });
    assert.equal(viewerOnShare.status, 404, "a contributor link must not open the viewer route");

    // ---- what the client sees
    const seen = await get();
    assert.equal(seen.status, 200);
    assert.equal(seen.headers.get("cache-control"), "no-store, max-age=0");
    assert.equal(seen.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
    for (const secret of [SECRET_INTERNAL, SECRET_BLOCKER, SECRET_EMAIL, "staffReviewedAt", "createdVia"]) {
      assert.ok(!seen.text.includes(secret), `the client view must not contain ${secret}`);
    }
    const titles = seen.body.items.map((i: Json) => i.title);
    assert.ok(!titles.includes(SECRET_INTERNAL));
    assert.ok(titles.includes("Talkpush builds the autoflows"));
    assert.equal(seen.body.you.name, "Ana Reyes");
    const view = (title: string) => seen.body.items.find((i: Json) => i.title === title);
    assert.equal(view("Provide DNS records").mine, true);
    assert.equal(view("Provide DNS records").canUpdate, true);
    assert.equal(view("Approve templates").canUpdate, false, "blocked items cannot be changed by the client");
    assert.equal(view("Ben's item").mine, false);
    assert.equal(view("Ben's item").canUpdate, false);
    assert.equal(view("Talkpush builds the autoflows").canUpdate, false);

    // ---- adding an item
    const added = await post({ title: "Send the IT contact", description: "Needed for DNS", priority: "high", dueDate: "2026-11-15", waitsOn: [talkpush.id] });
    assert.equal(added.status, 201, added.text);
    assert.equal(added.body.awaitingReview, true);
    const row = await prisma.trackerItem.findUnique({ where: { id: added.body.id }, include: { blockedBy: true } });
    assert.equal(row!.createdVia, "client");
    assert.equal(row!.ownerPersonId, ana.id);
    assert.equal(row!.visibility, "client_visible");
    assert.equal(row!.status, "not_started");
    assert.equal(row!.type, "config");
    assert.equal(row!.isMilestone, false);
    assert.equal(row!.phaseId, null);
    assert.equal(row!.staffReviewedAt, null);
    assert.deepEqual(row!.blockedBy.map((b) => b.blockedByItemId), [talkpush.id]);
    const log = await prisma.trackerActivity.findFirst({ where: { entityId: row!.id, action: "item.created" } });
    assert.equal(log!.actorLabel, "client:Ana Reyes");
    assert.equal(log!.via, "client");

    // fields a client may not set are refused, not ignored
    for (const extra of [{ visibility: "internal" }, { ownerPersonId: ben.id }, { status: "done" }, { type: "risk" }, { isMilestone: true }]) {
      assert.equal((await post({ title: "Sneaky", ...extra })).status, 400, JSON.stringify(extra));
    }
    assert.equal((await post({ title: "Waits on a secret", waitsOn: [internal.id] })).status, 400, "cannot depend on an internal item");
    assert.equal((await post({ title: "Waits on another project", waitsOn: [othersItem.id] })).status, 400);
    assert.equal((await post({ title: "Too far", dueDate: "2040-01-01" })).status, 400);
    assert.equal((await post({ title: "x" }, {})).status, 201);
    assert.equal((await call(itemsRoute.POST, `/api/contribute/${T.token}/items`, { method: "POST", params: T, raw: "title=x", contentType: "text/plain" })).status, 415);
    assert.equal((await call(itemsRoute.POST, `/api/contribute/${T.token}/items`, { method: "POST", params: T, raw: "{not json" })).status, 400);
    assert.equal((await call(itemsRoute.POST, `/api/contribute/${T.token}/items`, { method: "POST", params: T, raw: JSON.stringify({ title: "y".repeat(20000) }) })).status, 413);
    assert.equal(await prisma.trackerItem.count({ where: { projectId: other.id, createdVia: "client" } }), 0, "nothing lands in another project");

    // ---- an unreviewed client item stays out of project health; review brings it in
    await prisma.trackerItem.update({ where: { id: row!.id }, data: { dueDate: new Date("2026-09-10T00:00:00.000Z") } }); // overdue
    await prisma.trackerItem.update({ where: { id: mine.id }, data: { dueDate: null } });
    const before = await getProjectDetail(project.id);
    // The blocked item alone may make the project amber (thresholds can change); what matters is the overdue client item is not counted.
    assert.ok(!before.summary.health.reasons.some((r) => /overdue/.test(r)), JSON.stringify(before.summary.health.reasons));
    assert.equal(before.items.filter((i) => i.needsReview).length, 2);
    const reviewed = await call(reviewRoute.POST, `/api/tracker/items/${row!.id}/review`, { method: "POST", params: { id: row!.id }, ...staff });
    assert.equal(reviewed.body.reviewed, 1);
    assert.ok((await getProjectDetail(project.id)).summary.health.reasons.some((r) => /overdue/.test(r)), "once reviewed, the overdue item counts");
    assert.equal((await call(reviewRoute.POST, `/api/tracker/items/${row!.id}/review`, { method: "POST", params: { id: row!.id }, ...staff })).body.reviewed, 0, "reviewing twice does nothing");
    assert.equal((await call(reviewRoute.POST, `/api/tracker/items/${row!.id}/review`, { method: "POST", params: { id: row!.id } })).status, 401);
    const all = await call(reviewAllRoute.POST, `/api/tracker/projects/${project.id}/review-all`, { method: "POST", params, ...staff });
    assert.equal(all.body.reviewed, 1);
    assert.equal((await getProjectDetail(project.id)).items.filter((i) => i.needsReview).length, 0);
    assert.ok(await prisma.trackerActivity.findFirst({ where: { entityId: row!.id, action: "item.reviewed" } }));

    // ---- updating status
    const done = await patch(mine.id, { status: "done" });
    assert.equal(done.status, 200, done.text);
    assert.equal((await prisma.trackerItem.findUnique({ where: { id: mine.id } }))!.status, "done");
    assert.ok((await prisma.trackerItem.findUnique({ where: { id: mine.id } }))!.completedAt, "done stamps a completion time");
    assert.equal((await patch(mine.id, { status: "in_progress" })).status, 200, "can reopen their own item");
    assert.equal((await patch(bens.id, { status: "done" })).status, 403, "cannot change someone else's item");
    assert.equal((await patch(talkpush.id, { status: "done" })).status, 403);
    assert.equal((await patch(blockedMine.id, { status: "in_progress" })).status, 400, "blocked items are Talkpush's to change");
    assert.equal((await patch(internal.id, { status: "done" })).status, 404, "internal items look like they do not exist");
    assert.equal((await patch(othersItem.id, { status: "done" })).status, 404);
    assert.equal((await patch(mine.id, { status: "blocked" })).status, 400);
    assert.equal((await patch(mine.id, { status: "done", title: "renamed" })).status, 400);
    assert.equal((await prisma.trackerItem.findUnique({ where: { id: mine.id } }))!.title, "Provide DNS records");

    // ---- notes
    const noted = await note(mine.id, { body: "Sent to our IT team today" });
    assert.equal(noted.status, 201, noted.text);
    const remark = await prisma.trackerRemark.findFirst({ where: { itemId: mine.id } });
    assert.equal(remark!.visibility, "shared");
    assert.equal(remark!.createdVia, "client");
    assert.equal((await note(bens.id, { body: "hi" })).status, 403);
    assert.equal((await note(mine.id, { body: "hi", visibility: "internal" })).status, 400);

    // ---- limits
    resetContributorLimiters();
    const changesToday = await prisma.trackerActivity.count({ where: { projectId: project.id, via: "client" } });
    assert.ok(changesToday < CLIENT_LIMITS.changesPerDay);
    const madeToday = await prisma.trackerItem.count({ where: { projectId: project.id, createdVia: "client" } });
    let last = 201;
    for (let i = madeToday; i <= CLIENT_LIMITS.newItemsPerDay; i++) {
      resetContributorLimiters(); // isolate the daily cap from the per-minute address limit
      last = (await post({ title: `Bulk ${i}` })).status;
    }
    assert.equal(last, 429, "the daily cap on new items applies");

    // ---- guessing is throttled
    resetContributorLimiters();
    let throttled = 0;
    for (let i = 0; i < 20; i++) {
      const r = await call(viewRoute.GET, `/api/contribute/tpc_${"b".repeat(43)}`, { params: { token: `tpc_${"b".repeat(43)}` }, ip: "203.0.113.9" });
      if (r.status === 429) throttled++;
    }
    assert.ok(throttled >= 4, "repeated bad links get slowed down");
    resetContributorLimiters();

    // ---- revoke, expiry, archived contact
    const benLink = await tokenFor(ben.id);
    assert.equal((await call(viewRoute.GET, `/api/contribute/${benLink.token}`, { params: { token: benLink.token } })).status, 200);
    await revokeShareLink(benLink.id, { label: "staff", via: "web" });
    assert.equal((await call(viewRoute.GET, `/api/contribute/${benLink.token}`, { params: { token: benLink.token } })).status, 404, "revoked links stop at once");

    const expiring = await tokenFor(ben.id);
    await prisma.trackerShareLink.update({ where: { id: expiring.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await call(viewRoute.GET, `/api/contribute/${expiring.token}`, { params: { token: expiring.token } })).status, 404);

    const archivedContact = await tokenFor(ben.id);
    await prisma.trackerPerson.update({ where: { id: ben.id }, data: { archived: true } });
    assert.equal((await call(viewRoute.GET, `/api/contribute/${archivedContact.token}`, { params: { token: archivedContact.token } })).status, 404);
    await prisma.trackerPerson.update({ where: { id: ben.id }, data: { archived: false } });

    await prisma.trackerProject.update({ where: { id: project.id }, data: { archived: true } });
    assert.equal((await get()).status, 404, "an archived project is no longer reachable");
    assert.equal((await post({ title: "Late" })).status, 404);
  } finally {
    await prisma.trackerPlanTemplate.deleteMany({ where: { id: template.id } });
    const ids = [project.id, other.id];
    await prisma.trackerActivity.deleteMany({ where: { projectId: { in: ids } } });
    await prisma.trackerItem.deleteMany({ where: { projectId: { in: ids } } });
    await prisma.trackerShareLink.deleteMany({ where: { projectId: { in: ids } } });
    await prisma.trackerProject.deleteMany({ where: { id: { in: ids } } });
    await prisma.trackerPerson.deleteMany({ where: { id: { in: [ana.id, ben.id, staffPerson.id, stranger.id] } } });
    await prisma.trackerAccount.deleteMany({ where: { id: { in: [account.id, otherAccount.id] } } });
    await prisma.adminUser.deleteMany({ where: { id: staffUserId } });
    await prisma.$executeRaw`SELECT pg_advisory_unlock(727001)`;
    await prisma.$disconnect();
  }
});
