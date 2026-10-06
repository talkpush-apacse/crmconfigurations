import test from "node:test";
import assert from "node:assert/strict";

/**
 * Client contributors editing any item, commenting on any item, and the activity trail clients can see.
 * Runs only against a LOCAL database (TRACKER_TEST_DATABASE_URL pointing at localhost); skipped otherwise.
 */

const testDb = process.env.TRACKER_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-client-edit-tests-0123456789";
}
const skip = !isLocalDb && "set TRACKER_TEST_DATABASE_URL to a localhost database";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const SECRET_INTERNAL = "SECRET_INTERNAL_ITEM_TITLE";
const SECRET_BLOCKER = "SECRET_BLOCKER_REASON_TEXT";
const SECRET_EMAIL = "secret.staff@example.invalid";
const SECRET_NOTE = "SECRET_INTERNAL_REMARK_TEXT";

test("client edits, comments and the trail", { skip }, async () => {
  const { NextRequest } = await import("next/server");
  const { prisma } = await import("../src/lib/db");
  const viewRoute = await import("../src/app/api/contribute/[token]/route");
  const itemRoute = await import("../src/app/api/contribute/[token]/items/[itemId]/route");
  const remarksRoute = await import("../src/app/api/contribute/[token]/items/[itemId]/remarks/route");
  const contribActivity = await import("../src/app/api/contribute/[token]/activity/route");
  const shareActivity = await import("../src/app/api/share/[token]/activity/route");
  const { resetContributorLimiters } = await import("../src/lib/tracker/contributor-route");
  const { resetShareLimiters } = await import("../src/lib/tracker/share-access");
  const { createViewerLink } = await import("../src/lib/tracker/share-service");
  const { issueContributorLink } = await import("../src/lib/tracker/contributor-service");
  const { updateItem, addRemark } = await import("../src/lib/tracker/item-service");

  const staffActor = { label: SECRET_EMAIL, via: "web" as const };
  let ip = 0;
  const call = async (handler: any, url: string, opts: { method?: string; body?: unknown; params?: Json } = {}) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const headers: Record<string, string> = { "x-forwarded-for": `10.3.0.${++ip}` };
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    const req = new NextRequest(`http://localhost${url}`, { method: opts.method ?? "GET", headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    const res: Response = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
    const text = await res.text();
    let body: Json = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    return { status: res.status, body, text };
  };

  const suffix = Date.now().toString(36);
  const account = await prisma.trackerAccount.create({ data: { name: `Edits test ${suffix}`, slug: `edits-test-${suffix}` } });
  const otherAccount = await prisma.trackerAccount.create({ data: { name: `Other ${suffix}`, slug: `edits-other-${suffix}` } });
  const ana = await prisma.trackerPerson.create({ data: { accountId: account.id, side: "client", name: "Ana Reyes" } });
  const ben = await prisma.trackerPerson.create({ data: { accountId: account.id, side: "client", name: "Ben Cruz" } });
  const staffPerson = await prisma.trackerPerson.create({ data: { accountId: null, side: "talkpush", name: `Staff ${suffix}` } });
  const stranger = await prisma.trackerPerson.create({ data: { accountId: otherAccount.id, side: "client", name: "Zed Other" } });
  const project = await prisma.trackerProject.create({
    data: { accountId: account.id, title: "Edits test project", startDate: new Date("2026-09-01T00:00:00.000Z"), targetDate: new Date("2026-12-01T00:00:00.000Z"), phases: { create: [{ name: "Configuration", sortOrder: 0 }] } },
  });
  const mk = (title: string, data: Json = {}) => prisma.trackerItem.create({ data: { projectId: project.id, title, visibility: "client_visible", sortOrder: 0, ...data } });
  const internal = await mk(SECRET_INTERNAL, { visibility: "internal", ownerPersonId: staffPerson.id });
  const talkpush = await mk("Talkpush builds the autoflows", { ownerPersonId: staffPerson.id });
  const bens = await mk("Ben's item", { ownerPersonId: ben.id });
  const mine = await mk("Provide DNS records", { ownerPersonId: ana.id });
  const blockedMine = await mk("Approve templates", { ownerPersonId: ana.id, status: "blocked", blockerReason: SECRET_BLOCKER });
  const unowned = await mk("Unowned item");
  await prisma.trackerItemDependency.createMany({ data: [{ itemId: mine.id, blockedByItemId: internal.id }, { itemId: mine.id, blockedByItemId: bens.id }] });

  const link = await issueContributorLink(project.id, { personId: ana.id, label: null, expiresAt: new Date(Date.now() + 86_400_000), assignUnassigned: false }, { label: "test", via: "web" });
  const viewer = await createViewerLink(project.id, {}, { label: "test", via: "web" });
  const T = { token: link.token };
  const get = () => call(viewRoute.GET, `/api/contribute/${T.token}`, { params: T });
  const patch = (itemId: string, body: unknown) => call(itemRoute.PATCH, `/api/contribute/${T.token}/items/${itemId}`, { method: "PATCH", params: { ...T, itemId }, body });
  const note = (itemId: string, body: unknown) => call(remarksRoute.POST, `/api/contribute/${T.token}/items/${itemId}/remarks`, { method: "POST", params: { ...T, itemId }, body });
  const stamp = async (id: string) => (await prisma.trackerItem.findUnique({ where: { id }, select: { updatedAt: true } }))!.updatedAt.toISOString();
  const depsOf = async (id: string) => (await prisma.trackerItemDependency.findMany({ where: { itemId: id } })).map((d) => d.blockedByItemId).sort();

  try {
    resetContributorLimiters();
    resetShareLimiters();

    // ---- editing any visible item: a colleague's, a Talkpush one, an unowned one
    const edited = await patch(bens.id, { title: "Ben's item (renamed)", description: "More detail", priority: "high", dueDate: "2026-11-02", startDate: "2026-10-20", status: "in_progress" });
    assert.equal(edited.status, 200, edited.text);
    const row = await prisma.trackerItem.findUnique({ where: { id: bens.id } });
    assert.equal(row!.title, "Ben's item (renamed)");
    assert.equal(row!.priority, "high");
    assert.equal(row!.status, "in_progress");
    assert.equal(row!.dueDate!.toISOString().slice(0, 10), "2026-11-02");
    assert.equal(row!.visibility, "client_visible", "visibility is untouched");
    const log = await prisma.trackerActivity.findFirst({ where: { entityId: bens.id, action: "item.status_changed" } });
    assert.equal(log!.actorLabel, "client:Ana Reyes");
    assert.equal(log!.via, "client");
    assert.equal((await patch(talkpush.id, { description: "Notes from the client" })).status, 200);
    assert.equal((await patch(unowned.id, { status: "done" })).status, 200);
    assert.equal((await patch(mine.id, { description: "" })).status, 200);
    assert.equal((await prisma.trackerItem.findUnique({ where: { id: mine.id } }))!.description, null, "empty clears the text");

    // ---- never outside the approved fields, never team-only or other projects' items
    assert.equal((await patch(bens.id, { visibility: "internal" })).status, 400);
    assert.equal((await patch(bens.id, { phaseId: "x", type: "risk", isMilestone: true })).status, 400);
    assert.equal((await patch(internal.id, { title: "x" })).status, 404);
    assert.equal((await prisma.trackerItem.findUnique({ where: { id: internal.id } }))!.title, SECRET_INTERNAL);

    // ---- two people editing at once: the second save is refused, nothing is overwritten
    const seen = await stamp(mine.id);
    assert.equal((await patch(mine.id, { title: "Ana was first", expectedUpdatedAt: seen })).status, 200);
    const clash = await patch(mine.id, { title: "Ben was second", expectedUpdatedAt: seen });
    assert.equal(clash.status, 409);
    assert.match(clash.body.error, /Someone changed this item/);
    assert.equal((await prisma.trackerItem.findUnique({ where: { id: mine.id } }))!.title, "Ana was first");
    assert.equal((await patch(mine.id, { title: "Provide DNS records", expectedUpdatedAt: await stamp(mine.id) })).status, 200, "with the fresh time it goes through");

    // ---- blocked and dropped stay with Talkpush; other fields on them can still be edited
    assert.equal((await patch(blockedMine.id, { status: "in_progress" })).status, 400);
    assert.equal((await patch(blockedMine.id, { description: "We are waiting on legal" })).status, 200);
    const stillBlocked = await prisma.trackerItem.findUnique({ where: { id: blockedMine.id } });
    assert.equal(stillBlocked!.status, "blocked");
    assert.equal(stillBlocked!.blockerReason, SECRET_BLOCKER, "the blocker reason is untouched");

    // ---- dates
    assert.equal((await patch(mine.id, { dueDate: "2040-01-01" })).status, 400);
    assert.equal((await patch(mine.id, { startDate: "2026-11-10", dueDate: "2026-11-01" })).status, 400, "due before start");

    // ---- owner: client contacts on this account only, and never a Talkpush-owned item
    assert.equal((await patch(mine.id, { ownerPersonId: ben.id })).status, 200);
    assert.equal((await patch(mine.id, { ownerPersonId: ana.id })).status, 200);
    assert.equal((await patch(mine.id, { ownerPersonId: stranger.id })).status, 400, "a contact from another account");
    assert.equal((await patch(mine.id, { ownerPersonId: staffPerson.id })).status, 400, "a Talkpush person");
    assert.equal((await patch(talkpush.id, { ownerPersonId: ana.id })).status, 403, "a Talkpush-owned item keeps its owner");
    assert.equal((await patch(unowned.id, { ownerPersonId: ben.id })).status, 200);
    assert.equal((await patch(unowned.id, { ownerPersonId: null })).status, 200);

    // ---- "waits for": visible items only, loops refused, and a team-only dependency is never lost
    assert.deepEqual(await depsOf(mine.id), [internal.id, bens.id].sort());
    assert.equal((await patch(mine.id, { waitsOn: [] })).status, 200);
    assert.deepEqual(await depsOf(mine.id), [internal.id], "the team-only dependency survived a client replacing the list");
    assert.equal((await patch(mine.id, { waitsOn: [talkpush.id, unowned.id] })).status, 200);
    assert.deepEqual(await depsOf(mine.id), [internal.id, talkpush.id, unowned.id].sort());
    assert.equal((await patch(mine.id, { waitsOn: [internal.id] })).status, 400, "cannot choose a team-only item");
    assert.equal((await patch(talkpush.id, { waitsOn: [mine.id] })).status, 400, "a loop is refused");
    assert.equal((await patch(mine.id, { waitsOn: [mine.id] })).status, 200, "an item cannot wait for itself (ignored)");

    // ---- comments on any visible item
    assert.equal((await note(bens.id, { body: "Ana here: we will send this on Friday" })).status, 201);
    assert.equal((await note(talkpush.id, { body: "Can you confirm the date?" })).status, 201);
    assert.equal((await note(internal.id, { body: "hi" })).status, 404);
    await addRemark(talkpush.id, { body: "Confirmed for Monday", visibility: "shared" }, staffActor);
    await addRemark(talkpush.id, { body: SECRET_NOTE, visibility: "internal" }, staffActor);

    // ---- what the contributor page receives
    const page = await get();
    assert.equal(page.status, 200);
    for (const secret of [SECRET_INTERNAL, SECRET_BLOCKER, SECRET_EMAIL, SECRET_NOTE, "staffReviewedAt"]) assert.ok(!page.text.includes(secret), `the page must not contain ${secret}`);
    const comments = page.body.comments as Json[];
    assert.ok(comments.some((c) => c.itemId === bens.id && c.author === "Ana Reyes" && c.side === "client"));
    assert.ok(comments.some((c) => c.itemId === talkpush.id && c.author === "Talkpush team" && c.body === "Confirmed for Monday"));
    assert.ok(!comments.some((c) => c.body === SECRET_NOTE));
    assert.deepEqual((page.body.people as Json[]).map((p) => p.name).sort(), ["Ana Reyes", "Ben Cruz"], "only client contacts of this account");
    const view = (id: string) => (page.body.items as Json[]).find((i) => i.id === id)!;
    assert.equal(view(mine.id).canChangeOwner, true);
    assert.equal(view(talkpush.id).canChangeOwner, false);
    assert.equal(typeof view(mine.id).updatedAt, "string");

    // ---- the trail: the same allow-list on both kinds of link
    // team-only history must stay hidden even after an item is made visible later
    const later = await mk("Becomes visible later", { visibility: "internal" });
    await updateItem(later.id, { status: "in_progress" }, staffActor);
    await new Promise((r) => setTimeout(r, 15));
    await updateItem(later.id, { visibility: "client_visible" }, staffActor);
    await new Promise((r) => setTimeout(r, 15));
    await updateItem(later.id, { status: "done" }, staffActor);
    await updateItem(internal.id, { status: "blocked", blockerReason: SECRET_BLOCKER }, staffActor);
    await prisma.trackerActivity.createMany({
      data: [
        { projectId: project.id, entityType: "project", entityId: project.id, action: "export.downloaded", after: { audience: "client" }, actorLabel: SECRET_EMAIL, via: "web" },
        { projectId: project.id, entityType: "project", entityId: project.id, action: "share.created", after: { label: "SECRET_LINK_LABEL" }, actorLabel: SECRET_EMAIL, via: "web" },
        { projectId: project.id, entityType: "item", entityId: talkpush.id, action: "item.updated", before: { title: "x" }, after: { blockerReason: SECRET_BLOCKER, links: [SECRET_EMAIL] }, actorLabel: SECRET_EMAIL, via: "web" },
      ],
    });

    const vt = { token: viewer.token };
    const trailV = await call(shareActivity.GET, `/api/share/${viewer.token}/activity`, { params: vt });
    const trailC = await call(contribActivity.GET, `/api/contribute/${link.token}/activity`, { params: T });
    for (const trail of [trailV, trailC]) {
      assert.equal(trail.status, 200, trail.text);
      for (const secret of [SECRET_EMAIL, SECRET_BLOCKER, SECRET_INTERNAL, SECRET_NOTE, "SECRET_LINK_LABEL", "export", "downloaded"]) assert.ok(!trail.text.includes(secret), `the trail must not contain ${secret}`);
      const texts = (trail.body.entries as Json[]).map((e) => `${e.who} ${e.text}`);
      assert.ok(texts.some((t) => /^Ana Reyes moved "Unowned item"/.test(t)), texts.join("\n"));
      assert.ok(texts.some((t) => /^Ana Reyes commented on "Ben's item/.test(t)));
      assert.ok(texts.some((t) => /^Talkpush team commented on "Talkpush builds the autoflows"/.test(t)));
      assert.ok(texts.some((t) => /^Talkpush team moved "Becomes visible later" from In progress to Done/.test(t)), "what happened after it became visible shows");
      assert.ok(!texts.some((t) => /Becomes visible later.*(Not started|Blocked)/.test(t)), "what happened while it was team-only does not");
      assert.ok(!(trail.body.entries as Json[]).some((e) => e.itemId === internal.id), "team-only items never appear");
    }
    assert.deepEqual((trailV.body.entries as Json[]).map((e) => e.id), (trailC.body.entries as Json[]).map((e) => e.id), "both kinds of link show the same trail");

    // one item's history
    const only = await call(contribActivity.GET, `/api/contribute/${link.token}/activity?item=${bens.id}`, { params: T });
    assert.ok((only.body.entries as Json[]).length >= 2);
    assert.ok((only.body.entries as Json[]).every((e) => e.itemId === bens.id));

    // bad and wrong-kind links look the same
    const bad = await call(shareActivity.GET, "/api/share/nonsense/activity", { params: { token: "nonsense" } });
    assert.equal(bad.status, 404);
    assert.deepEqual(bad.body, { error: "Not found" });
    assert.equal((await call(shareActivity.GET, `/api/share/${link.token}/activity`, { params: T })).status, 404, "a contributor link is not a view-only link");
    assert.equal((await call(contribActivity.GET, `/api/contribute/${viewer.token}/activity`, { params: vt })).status, 404, "a view-only link cannot open the contributor trail");
  } finally {
    await prisma.trackerProject.delete({ where: { id: project.id } }).catch(() => undefined);
    await prisma.trackerPerson.deleteMany({ where: { id: { in: [ana.id, ben.id, staffPerson.id, stranger.id] } } }).catch(() => undefined);
    await prisma.trackerAccount.deleteMany({ where: { id: { in: [account.id, otherAccount.id] } } }).catch(() => undefined);
  }
});
