import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

/**
 * The "others editing this tab" banner's data, through the REAL routes and a real LOCAL database: who is listed, that
 * your own changes are left out, that clients never see a staff email, the 10-minute window, the "changed since you
 * opened it" flag (the same rule the save uses to refuse a stale write), and who may ask.
 * Skipped unless WORKFLOW_TEST_DATABASE_URL points at localhost (a local Postgres with ssl = on).
 */
const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-tab-activity-tests-0123456789";
  const req = Module.createRequire(__filename);
  const resolved = req.resolve("server-only");
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: {} } as never;
}
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;
const stamp = Date.now().toString(36);
let counter = 0;

test("others editing this tab (local DB): who is listed, own changes left out, names by audience, window, since-flag, access", { skip }, async () => {
  const { NextRequest } = await import("next/server");
  const { createToken } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/db");
  const record = await import("../src/lib/edit-history/record");
  const editor = await prisma.adminUser.create({ data: { email: `ta-editor-${stamp}@example.invalid`, role: "editor" } });
  const viewer = await prisma.adminUser.create({ data: { email: `ta-viewer-${stamp}@example.invalid`, role: "viewer" } });
  const other = await prisma.adminUser.create({ data: { email: `ta-other-${stamp}@example.invalid`, role: "editor" } });
  const cookie = (u: { id: string }) => `admin_token=${createToken(u.id)}`;

  const call = async (handler: any, url: string, opts: { method?: string; body?: unknown; as?: { id: string }; params?: Json } = {}) => {
    const req = new NextRequest(`http://localhost${url}`, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "PUT"),
      headers: { "content-type": "application/json", ...(opts.as ? { cookie: cookie(opts.as) } : {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const res: Response = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
    const text = await res.text();
    let body: Json = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    return { status: res.status, body, text, headers: res.headers };
  };
  const routes = {
    byToken: await import("../src/app/api/checklists/by-token/[token]/route"),
    bySlug: await import("../src/app/api/checklists/by-slug/[slug]/route"),
    admin: await import("../src/app/api/checklists/[id]/route"),
    links: await import("../src/app/api/checklists/[id]/edit-links/route"),
    link: await import("../src/app/api/checklists/[id]/edit-links/[linkId]/route"),
    actToken: await import("../src/app/api/checklists/by-token/[token]/activity/route"),
    actSlug: await import("../src/app/api/checklists/by-slug/[slug]/activity/route"),
    actStaff: await import("../src/app/api/checklists/[id]/activity/route"),
  };

  const n = ++counter;
  const tab = (id: string, slug: string, label: string, rows: Json[]): Json => ({ id, slug, label, icon: "i", fields: [], mode: "table", columns: [{ key: "name", label: "Name", type: "text" }], rows });
  const c = await prisma.checklist.create({
    data: {
      slug: `ta-${stamp}-${n}`, clientName: `Tab Activity Test ${stamp}-${n}`,
      users: [{ id: "u1", name: "Jane Cruz", email: "j@x.com" }],
      customTabs: [tab("ct1", "scripts", "Scripts", [{ id: "r1", name: "a" }]), tab("ct2", "other", "Other", [{ id: "r2", name: "b" }])],
    },
  });
  try {
    const newLink = async (name: string) => {
      const r = await call(routes.links.POST, `/api/checklists/${c.id}/edit-links`, { method: "POST", body: { name }, as: editor, params: { id: c.id } });
      assert.equal(r.status, 201, r.text);
      return r.body.link as Json;
    };
    const jane = await newLink("Jane Cruz (TP)");
    const raj = await newLink("Raj Patel (TP Philippines)");
    const putTok = (token: string, body: unknown) => call(routes.byToken.PUT, `/api/checklists/by-token/${token}`, { method: "PUT", body, params: { token } });
    const act = (token: string, tabSlug: string, since: number | null) =>
      call(routes.actToken.GET, `/api/checklists/by-token/${token}/activity?tab=${tabSlug}${since === null ? "" : `&since=${since}`}`, { params: { token } });
    const usersBody = (version: number, email: string) => ({ version, changedFields: ["users"], users: [{ id: "u1", name: "Jane Cruz", email }] });

    // Nobody has changed anything yet.
    const quiet = await act(raj.token, "users", 0);
    assert.equal(quiet.status, 200, quiet.text);
    assert.equal(quiet.headers.get("cache-control"), "no-store, max-age=0");
    assert.deepEqual(quiet.body, { changedSinceYouOpened: false, others: [] });

    // Jane changes the User List. Raj (page opened at version 0) is told; Jane is not told about herself.
    const s1 = await putTok(jane.token, usersBody(0, "a@x.com"));
    assert.equal(s1.status, 200, s1.text);
    await record.flushEditHistory();
    const rajSees = await act(raj.token, "users", 0);
    assert.equal(rajSees.body.changedSinceYouOpened, true, "the tab changed after Raj's page version, so his next save would be refused");
    assert.deepEqual(rajSees.body.others.map((o: Json) => o.name), ["Jane Cruz (TP)"]);
    assert.ok(Date.now() - Date.parse(rajSees.body.others[0].at) < 60_000);
    const janeSees = await act(jane.token, "users", s1.body.version);
    assert.deepEqual(janeSees.body, { changedSinceYouOpened: false, others: [] }, "your own change is never shown to you");

    // Another tab is unaffected; a missing version never raises the strong flag.
    assert.deepEqual((await act(raj.token, "sites", 0)).body, { changedSinceYouOpened: false, others: [] });
    const noSince = await act(raj.token, "users", null);
    assert.equal(noSince.body.changedSinceYouOpened, false);
    assert.equal(noSince.body.others.length, 1, "without a version, recent changes still show as the softer note");

    // Staff change it too. A client sees "Talkpush team", never the email; staff see the full name.
    const s2 = await call(routes.admin.PUT, `/api/checklists/${c.id}`, { method: "PUT", body: usersBody(s1.body.version, "admin@x.com"), as: editor, params: { id: c.id } });
    assert.equal(s2.status, 200, s2.text);
    await record.flushEditHistory();
    const clientView = await act(raj.token, "users", 0);
    assert.deepEqual(clientView.body.others.map((o: Json) => o.name).sort(), ["Jane Cruz (TP)", "Talkpush team"]);
    assert.equal(clientView.text.includes(editor.email), false, "a client is never shown a staff email");
    const staffAsk = (as: { id: string } | undefined, since: number | null, params = { id: c.id }) =>
      call(routes.actStaff.GET, `/api/checklists/${c.id}/activity?tab=users${since === null ? "" : `&since=${since}`}`, { as, params });
    const staffOther = await staffAsk(other, 0);
    assert.deepEqual(staffOther.body.others.map((o: Json) => o.name).sort(), [editor.email, "Jane Cruz (TP)"].sort(), "staff see full names");
    const staffSelf = await staffAsk(editor, s2.body.version);
    assert.deepEqual(staffSelf.body.others.map((o: Json) => o.name), ["Jane Cruz (TP)"], "a staff member's own change is left out");
    assert.equal(staffSelf.body.changedSinceYouOpened, false);

    // The shared links are described, not named, and cannot be told apart from yourself.
    const legacy = await putTok(c.editorToken, usersBody(s2.body.version, "legacy@x.com"));
    assert.equal(legacy.status, 200);
    const slugSave = await call(routes.bySlug.PUT, `/api/checklists/by-slug/${c.slug}`, { method: "PUT", body: usersBody(legacy.body.version, "slug@x.com"), params: { slug: c.slug } });
    assert.equal(slugSave.status, 200, slugSave.text);
    await record.flushEditHistory();
    const names = (await act(raj.token, "users", 0)).body.others.map((o: Json) => o.name);
    assert.equal(names.length, 3, "at most three names");
    const viaLegacy = await act(c.editorToken, "users", 0);
    assert.ok(viaLegacy.body.others.every((o: Json) => o.name !== "Someone using the shared link"), "the shared link's own changes are 'mine'");
    assert.ok(viaLegacy.body.others.some((o: Json) => o.name === "Someone using the client form link"));
    const viaSlug = await call(routes.actSlug.GET, `/api/checklists/by-slug/${c.slug}/activity?tab=users&since=0`, { params: { slug: c.slug } });
    assert.equal(viaSlug.status, 200);
    assert.ok(viaSlug.body.others.some((o: Json) => o.name === "Someone using the shared link"));
    assert.ok(viaSlug.body.others.every((o: Json) => o.name !== "Someone using the client form link"));
    assert.ok(!viaSlug.text.includes(editor.email));

    // Only the last 10 minutes count.
    await prisma.checklistEditEvent.updateMany({ where: { checklistId: c.id }, data: { updatedAt: new Date(Date.now() - 11 * 60 * 1000) } });
    const stale = await act(raj.token, "users", 0);
    assert.deepEqual(stale.body.others, [], "changes older than 10 minutes are not 'recent'");
    assert.equal(stale.body.changedSinceYouOpened, true, "but the version rule is unaffected by age");

    // Custom tabs share one saved section: a change to one warns people on the other, but names stay per tab.
    const scripts = (await prisma.checklist.findUniqueOrThrow({ where: { id: c.id } })).customTabs as Json[];
    const edited = JSON.parse(JSON.stringify(scripts));
    edited[0].rows[0].name = "changed";
    const cur = await prisma.checklist.findUniqueOrThrow({ where: { id: c.id } });
    const customSave = await putTok(jane.token, { version: cur.version, changedFields: ["customTabs"], customTabs: edited });
    assert.equal(customSave.status, 200, customSave.text);
    await record.flushEditHistory();
    const onScripts = await act(raj.token, "custom-scripts", cur.version);
    assert.deepEqual(onScripts.body.others.map((o: Json) => o.name), ["Jane Cruz (TP)"]);
    assert.equal(onScripts.body.changedSinceYouOpened, true);
    const onOther = await act(raj.token, "custom-other", cur.version);
    assert.equal(onOther.body.changedSinceYouOpened, true, "a save of ANY custom tab would be refused after this");
    assert.deepEqual(onOther.body.others, [], "no one changed THIS custom tab, so no name");

    // Access: turned-off link, unknown link, bad request, read-only login, anonymous.
    await call(routes.link.DELETE, `/api/checklists/${c.id}/edit-links/${raj.id}`, { method: "DELETE", as: editor, params: { id: c.id, linkId: raj.id } });
    const off = await act(raj.token, "users", 0);
    assert.equal(off.status, 410);
    assert.equal(off.body.code, "link_off");
    assert.equal((await act("cel_" + "z".repeat(43), "users", 0)).status, 404);
    assert.equal((await call(routes.actToken.GET, `/api/checklists/by-token/${jane.token}/activity`, { params: { token: jane.token } })).status, 400);
    assert.equal((await call(routes.actToken.GET, `/api/checklists/by-token/${jane.token}/activity?tab=a%20b`, { params: { token: jane.token } })).status, 400);
    assert.equal((await staffAsk(viewer, 0)).status, 200, "a read-only login may look");
    assert.equal((await staffAsk(undefined, 0)).status, 401);
    assert.deepEqual((await act(jane.token, "welcome", 0)).body, { changedSinceYouOpened: false, others: [] }, "a page that is not a tab has nothing to report");
  } finally {
    await new Promise((r) => setTimeout(r, 300));
    await prisma.checklist.deleteMany({ where: { id: c.id } });
    await prisma.adminUser.deleteMany({ where: { id: { in: [editor.id, viewer.id, other.id] } } });
    await prisma.$disconnect();
  }
});
