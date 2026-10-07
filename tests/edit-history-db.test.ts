import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/**
 * Named edit links and the edit history, through the REAL routes and a real LOCAL database: who a save is attributed
 * to, merging of rapid saves, turned-off links in every place a link is accepted, passwords kept out, the staff
 * screens' permissions, Claude's changes, snapshot restore, and "a history failure never fails a save".
 * Skipped unless WORKFLOW_TEST_DATABASE_URL points at localhost (the app always connects with SSL, so use a local
 * Postgres with ssl = on; see README "Local development").
 */
const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-edit-history-tests-0123456789";
  // Some modules guard themselves with `server-only`, which refuses to load outside a Next.js build. Not needed here.
  const req = Module.createRequire(__filename);
  const resolved = req.resolve("server-only");
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: {} } as never;
}
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;
const stamp = Date.now().toString(36);
let counter = 0;

async function setup() {
  const { NextRequest } = await import("next/server");
  const { createToken } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/db");
  const record = await import("../src/lib/edit-history/record");
  const editor = await prisma.adminUser.create({ data: { email: `eh-editor-${stamp}@example.invalid`, role: "editor" } });
  const viewer = await prisma.adminUser.create({ data: { email: `eh-viewer-${stamp}@example.invalid`, role: "viewer" } });
  const cookies = { editor: `admin_token=${createToken(editor.id)}`, viewer: `admin_token=${createToken(viewer.id)}` };

  const call = async (handler: any, url: string, opts: { method?: string; body?: unknown; as?: "editor" | "viewer"; params?: Json } = {}) => {
    const req = new NextRequest(`http://localhost${url}`, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "PUT"),
      headers: { "content-type": "application/json", ...(opts.as ? { cookie: cookies[opts.as] } : {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const res: Response = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
    const text = await res.text();
    let body: Json = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    return { status: res.status, body, text, headers: res.headers };
  };

  const routes = {
    byToken: await import("../src/app/api/checklists/by-token/[token]/route"),
    bySlug: await import("../src/app/api/checklists/by-slug/[slug]/route"),
    admin: await import("../src/app/api/checklists/[id]/route"),
    exportByToken: await import("../src/app/api/export/by-token/[token]/route"),
    links: await import("../src/app/api/checklists/[id]/edit-links/route"),
    link: await import("../src/app/api/checklists/[id]/edit-links/[linkId]/route"),
    history: await import("../src/app/api/checklists/[id]/edit-history/route"),
    event: await import("../src/app/api/checklists/[id]/edit-history/[eventId]/route"),
  };

  const created: string[] = [];
  const mkChecklist = async (over: Json = {}) => {
    const n = ++counter;
    const row = await prisma.checklist.create({
      data: {
        slug: `eh-${stamp}-${n}`,
        clientName: `Edit History Test ${stamp}-${n}`,
        users: [{ id: "u1", name: "Jane Cruz", email: "j@x.com" }],
        ...over,
      },
    });
    created.push(row.id);
    return row;
  };

  const flush = () => record.flushEditHistory();
  const events = (checklistId: string) =>
    prisma.checklistEditEvent.findMany({ where: { checklistId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const usersBody = (version: number, email: string) => ({
    version,
    changedFields: ["users"],
    users: [{ id: "u1", name: "Jane Cruz", email }],
  });
  const putToken = (token: string, body: unknown) => call(routes.byToken.PUT, `/api/checklists/by-token/${token}`, { method: "PUT", body, params: { token } });
  const getToken = (token: string) => call(routes.byToken.GET, `/api/checklists/by-token/${token}`, { params: { token } });
  const newLink = async (checklistId: string, name: string) => {
    const r = await call(routes.links.POST, `/api/checklists/${checklistId}/edit-links`, { method: "POST", body: { name }, as: "editor", params: { id: checklistId } });
    assert.equal(r.status, 201, r.text);
    return r.body.link as Json;
  };

  const cleanup = async () => {
    await new Promise((r) => setTimeout(r, 300)); // let any unawaited background sweep finish
    await prisma.checklist.deleteMany({ where: { id: { in: created } } });
    await prisma.adminUser.deleteMany({ where: { id: { in: [editor.id, viewer.id] } } });
    await prisma.$disconnect();
  };
  return { call, prisma, routes, record, mkChecklist, flush, events, usersBody, putToken, getToken, newLink, cleanup, editor, viewer };
}

test("edit history (local DB): named links, attribution, merging, and turning a link off", { skip }, async () => {
  const t = await setup();
  try {
    const c = await t.mkChecklist();

    // ---- creating links: staff only, clean names, no duplicates ----
    const asViewer = await t.call(t.routes.links.POST, `/api/checklists/${c.id}/edit-links`, { method: "POST", body: { name: "Nope" }, as: "viewer", params: { id: c.id } });
    assert.equal(asViewer.status, 403, "a read-only login cannot create links");
    const viewerList = await t.call(t.routes.links.GET, `/api/checklists/${c.id}/edit-links`, { as: "viewer", params: { id: c.id } });
    assert.equal(viewerList.status, 403, "a read-only login cannot see the secret link text");
    const anon = await t.call(t.routes.links.GET, `/api/checklists/${c.id}/edit-links`, { params: { id: c.id } });
    assert.equal(anon.status, 401);
    const empty = await t.call(t.routes.links.POST, `/api/checklists/${c.id}/edit-links`, { method: "POST", body: { name: "   " }, as: "editor", params: { id: c.id } });
    assert.equal(empty.status, 400);

    const jane = await t.newLink(c.id, "Jane Cruz (TP)");
    assert.match(jane.token, /^cel_[A-Za-z0-9_-]{40,}$/);
    const dup = await t.call(t.routes.links.POST, `/api/checklists/${c.id}/edit-links`, { method: "POST", body: { name: "jane cruz (tp)" }, as: "editor", params: { id: c.id } });
    assert.equal(dup.status, 409, "two active links with the same name would blur the history");
    assert.equal(dup.headers.get("cache-control"), "no-store, max-age=0");
    const cleaned = await t.newLink(c.id, "  Raj\u0000\n  Patel  ");
    assert.equal(cleaned.name, "Raj Patel");

    // ---- the editor opens it: named link says who; the original link says nothing ----
    const named = await t.getToken(jane.token);
    assert.equal(named.status, 200);
    assert.equal(named.body.editingAs, "Jane Cruz (TP)");
    assert.equal(named.body.editLinks, undefined);
    assert.equal(named.text.includes("cel_"), false, "the page data never carries link text");
    const legacy = await t.getToken(c.editorToken);
    assert.equal(legacy.status, 200);
    assert.equal(legacy.body.editingAs, null);
    assert.equal((await t.getToken("cel_" + "x".repeat(43))).status, 404, "an unknown named link is a plain 404");
    assert.equal((await t.getToken("not-a-token")).status, 404);

    // ---- a save through a named link is recorded with her name ----
    const save1 = await t.putToken(jane.token, t.usersBody(0, "a@x.com"));
    assert.equal(save1.status, 200, save1.text);
    await t.flush();
    let ev = await t.events(c.id);
    assert.equal(ev.length, 1);
    assert.equal(ev[0].actorType, "link");
    assert.equal(ev[0].actorName, "Jane Cruz (TP)");
    assert.equal(ev[0].linkId, jane.id);
    assert.equal(ev[0].tabLabel, "User List");
    assert.equal(ev[0].rowLabel, "Jane Cruz");
    assert.equal(ev[0].fieldKey, "email");
    assert.equal(ev[0].before, "j@x.com");
    assert.equal(ev[0].after, "a@x.com");
    const opened = await t.prisma.checklistEditLink.findUniqueOrThrow({ where: { id: jane.id } });
    assert.ok(opened.firstOpenedAt && opened.lastUsedAt, "using the link notes when it was first and last used");

    // ---- typing makes one line, not many: the first 'before' and the latest 'after' ----
    const save2 = await t.putToken(jane.token, t.usersBody(save1.body.version, "b@x.com"));
    assert.equal(save2.status, 200);
    const save3 = await t.putToken(jane.token, t.usersBody(save2.body.version, "c@x.com"));
    assert.equal(save3.status, 200);
    await t.flush();
    ev = await t.events(c.id);
    assert.equal(ev.length, 1, "rapid saves of the same cell merge into one line");
    assert.equal(ev[0].before, "j@x.com", "the line keeps what it was before the first edit");
    assert.equal(ev[0].after, "c@x.com");
    assert.equal(ev[0].checklistVersion, save3.body.version);

    // ---- an older write arriving late cannot overwrite a newer one ----
    const now = Date.now();
    const draft = (after: string) => ({ tabKey: "users", tabLabel: "User List", rowId: "u9", rowLabel: "Late", fieldKey: "email", fieldLabel: "Email", changeType: "edited" as const, summary: "x", before: "z", after, truncated: false, subject: "users|u9|email|edited" });
    const actor = { type: "link" as const, name: "Jane Cruz (TP)", linkId: jane.id };
    await t.record.recordEditEvents({ checklistId: c.id, actor, version: 50, events: [draft("newer")], now });
    await t.record.recordEditEvents({ checklistId: c.id, actor, version: 40, events: [draft("older")], now });
    const late = (await t.events(c.id)).filter((e) => e.rowId === "u9");
    assert.equal(late.length, 1);
    assert.equal(late[0].after, "newer", "the higher version wins even when it is written first");
    // The same person, a different cell, is a different line; the same cell in the NEXT window is a new line too.
    await t.record.recordEditEvents({ checklistId: c.id, actor, version: 60, events: [draft("later")], now: now + 11 * 60 * 1000 });
    assert.equal((await t.events(c.id)).filter((e) => e.rowId === "u9").length, 2);

    // ---- two different people are two different lines ----
    const raj = cleaned;
    const rajSave = await t.putToken(raj.token, t.usersBody(save3.body.version, "raj@x.com"));
    assert.equal(rajSave.status, 200);
    await t.flush();
    const byRaj = (await t.events(c.id)).filter((e) => e.actorName === "Raj Patel");
    assert.equal(byRaj.length, 1);
    assert.equal(byRaj[0].before, "c@x.com");

    // ---- the original link still works and is labelled as unnamed ----
    const legacySave = await t.putToken(c.editorToken, t.usersBody(rajSave.body.version, "legacy@x.com"));
    assert.equal(legacySave.status, 200);
    await t.flush();
    const legacyEvent = (await t.events(c.id)).find((e) => e.actorType === "legacy_link");
    assert.equal(legacyEvent?.actorName, "Original shared link (unnamed)");
    assert.equal(legacyEvent?.linkId, null);

    // ---- the client-form link is recorded too ----
    const slugSave = await t.call(t.routes.bySlug.PUT, `/api/checklists/by-slug/${c.slug}`, {
      method: "PUT",
      body: t.usersBody(legacySave.body.version, "slug@x.com"),
      params: { slug: c.slug },
    });
    assert.equal(slugSave.status, 200, slugSave.text);
    await t.flush();
    assert.equal((await t.events(c.id)).find((e) => e.actorType === "slug")?.actorName, "Client form link (unnamed)");

    // ---- staff edits are told apart from a client's ----
    const adminSave = await t.call(t.routes.admin.PUT, `/api/checklists/${c.id}`, {
      method: "PUT",
      body: t.usersBody(slugSave.body.version, "admin@x.com"),
      as: "editor",
      params: { id: c.id },
    });
    assert.equal(adminSave.status, 200, adminSave.text);
    await t.flush();
    const adminEvent = (await t.events(c.id)).find((e) => e.actorType === "admin");
    assert.equal(adminEvent?.actorName, t.editor.email);
    assert.equal(adminEvent?.before, "slug@x.com");

    // ---- the whole-document save method is one honest, coarse line ----
    const whole = await t.putToken(jane.token, { version: adminSave.body.version, users: [{ id: "u1", name: "Jane Cruz", email: "whole@x.com" }] });
    assert.equal(whole.status, 200, whole.text);
    await t.flush();
    const wholeEvent = (await t.events(c.id)).find((e) => e.changeType === "replaced" && e.tabKey === "document");
    assert.match(wholeEvent?.summary ?? "", /whole checklist at once/);

    // ---- turning a link off stops it everywhere a link is accepted ----
    const off = await t.call(t.routes.link.DELETE, `/api/checklists/${c.id}/edit-links/${raj.id}`, { method: "DELETE", as: "editor", params: { id: c.id, linkId: raj.id } });
    assert.equal(off.status, 200);
    assert.ok(off.body.link.revokedAt);
    const got = await t.getToken(raj.token);
    assert.equal(got.status, 410);
    assert.equal(got.body.code, "link_off");
    assert.match(got.body.error, /turned off/);
    assert.equal(got.text.includes(c.clientName), false, "a turned-off link reveals nothing about the checklist");
    assert.equal((await t.putToken(raj.token, t.usersBody(whole.body.version, "no@x.com"))).status, 410);
    const exp = await t.call(t.routes.exportByToken.GET, `/api/export/by-token/${raj.token}`, { params: { token: raj.token } });
    assert.equal(exp.status, 410);
    const expOk = await t.call(t.routes.exportByToken.GET, `/api/export/by-token/${jane.token}`, { params: { token: jane.token } });
    assert.equal(expOk.status, 200, "a working named link can export");
    const stillThere = await t.prisma.checklistEditLink.findUniqueOrThrow({ where: { id: raj.id } });
    assert.ok(stillThere.revokedAt, "a turned-off link keeps its row");
    assert.equal((await t.events(c.id)).filter((e) => e.actorName === "Raj Patel").length, 1, "and the history keeps his name");
    const again = await t.call(t.routes.link.DELETE, `/api/checklists/${c.id}/edit-links/${raj.id}`, { method: "DELETE", as: "editor", params: { id: c.id, linkId: raj.id } });
    assert.equal(again.status, 200, "turning off twice is harmless");
    // …and its name can be used again for a fresh link.
    const rajAgain = await t.newLink(c.id, "Raj Patel");
    assert.notEqual(rajAgain.id, raj.id);

    // ---- another checklist's link id cannot be touched through this checklist ----
    const other = await t.mkChecklist();
    const crossed = await t.call(t.routes.link.DELETE, `/api/checklists/${other.id}/edit-links/${jane.id}`, { method: "DELETE", as: "editor", params: { id: other.id, linkId: jane.id } });
    assert.equal(crossed.status, 404);
    assert.equal((await t.getToken(jane.token)).status, 200, "Jane's link still works");

    // ---- an expired link says it was turned off ----
    const old = await t.prisma.checklistEditLink.create({ data: { checklistId: c.id, name: "Expired Ed", token: "cel_" + "e".repeat(43), expiresAt: new Date(Date.now() - 60_000) } });
    assert.equal((await t.getToken(old.token)).status, 410);

    // ---- a new address keeps the name and the history; the old address stops ----
    const regen = await t.call(t.routes.link.PATCH, `/api/checklists/${c.id}/edit-links/${jane.id}`, { method: "PATCH", body: { regenerate: true }, as: "editor", params: { id: c.id, linkId: jane.id } });
    assert.equal(regen.status, 200);
    assert.notEqual(regen.body.link.token, jane.token);
    assert.equal(regen.body.link.name, "Jane Cruz (TP)");
    assert.equal((await t.getToken(jane.token)).status, 404, "the old address no longer exists");
    assert.equal((await t.getToken(regen.body.link.token)).status, 200);
    // Renaming changes the name from now on; lines already written keep the name they were written with.
    const renamed = await t.call(t.routes.link.PATCH, `/api/checklists/${c.id}/edit-links/${jane.id}`, { method: "PATCH", body: { name: "Jane C." }, as: "editor", params: { id: c.id, linkId: jane.id } });
    assert.equal(renamed.body.link.name, "Jane C.");
    assert.ok((await t.events(c.id)).some((e) => e.linkId === jane.id && e.actorName === "Jane Cruz (TP)"));
  } finally {
    await t.cleanup();
  }
});

test("edit history (local DB): staff screens, filters, paging, and what is never stored", { skip }, async () => {
  const t = await setup();
  try {
    const c = await t.mkChecklist({ adminSettings: { tecolocoPassword: "old", tecolocoUsername: "bob" } });
    const jane = await t.newLink(c.id, "Jane Cruz (TP)");

    // Passwords change, and an ordinary cell changes, through the same link.
    const s1 = await t.putToken(jane.token, { version: 0, changedFields: ["adminSettings"], adminSettings: { tecolocoPassword: "hunter2-new-secret", tecolocoUsername: "bob" } });
    assert.equal(s1.status, 200, s1.text);
    const s2 = await t.putToken(jane.token, t.usersBody(s1.body.version, "j2@x.com"));
    const s3 = await t.call(t.routes.admin.PUT, `/api/checklists/${c.id}`, { method: "PUT", body: t.usersBody(s2.body.version, "admin@x.com"), as: "editor", params: { id: c.id } });
    assert.equal(s3.status, 200);
    await t.flush();

    const rows = await t.prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM "ChecklistEditEvent" WHERE "checklistId" = ${c.id}`;
    const dump = JSON.stringify(rows);
    assert.equal(dump.includes("hunter2"), false, "no password text reaches the history");
    assert.equal(rows.length, 3, "sanity: the three changes were recorded, so the check above looked at real rows");
    const settings = rows.find((r) => r.tabKey === "adminSettings");
    assert.ok(settings, "the fact that admin settings changed is recorded");
    assert.equal(settings?.before, null);
    assert.equal(settings?.after, null);

    // ---- staff list: newest first, no link text, no before/after in the list ----
    const list = await t.call(t.routes.history.GET, `/api/checklists/${c.id}/edit-history`, { as: "viewer", params: { id: c.id } });
    assert.equal(list.status, 200, "a read-only login may read the history");
    assert.equal(list.text.includes("cel_"), false, "history never carries link text");
    assert.equal(list.body.events.length, 3);
    assert.equal(list.body.events[0].actorType, "admin", "newest first");
    assert.equal("before" in list.body.events[0], false, "the list does not load the (possibly huge) before/after text");
    assert.deepEqual(list.body.overview.people.map((p: Json) => p.label).sort(), ["Jane Cruz (TP)", t.editor.email].sort());
    assert.ok(list.body.overview.firstRecordedAt);
    assert.deepEqual(list.body.overview.tabs.map((x: Json) => x.tabKey).sort(), ["adminSettings", "users"]);

    // ---- filters ----
    const byJane = await t.call(t.routes.history.GET, `/api/checklists/${c.id}/edit-history?person=link:${jane.id}`, { as: "editor", params: { id: c.id } });
    assert.equal(byJane.body.events.length, 2);
    assert.ok(byJane.body.events.every((e: Json) => e.linkId === jane.id));
    const byAdmin = await t.call(t.routes.history.GET, `/api/checklists/${c.id}/edit-history?person=admin:${encodeURIComponent(t.editor.email)}`, { as: "editor", params: { id: c.id } });
    assert.equal(byAdmin.body.events.length, 1);
    const byTab = await t.call(t.routes.history.GET, `/api/checklists/${c.id}/edit-history?tab=users`, { as: "editor", params: { id: c.id } });
    assert.equal(byTab.body.events.length, 2);

    // ---- paging by cursor, with no repeats ----
    const p1 = await t.call(t.routes.history.GET, `/api/checklists/${c.id}/edit-history?limit=2`, { as: "editor", params: { id: c.id } });
    assert.equal(p1.body.events.length, 2);
    assert.ok(p1.body.nextCursor);
    const p2 = await t.call(t.routes.history.GET, `/api/checklists/${c.id}/edit-history?limit=2&cursor=${p1.body.nextCursor}`, { as: "editor", params: { id: c.id } });
    assert.equal(p2.body.events.length, 1);
    assert.equal(p2.body.nextCursor, null);
    assert.equal(p2.body.overview, null, "the filter lists come with the first page only");
    const ids = [...p1.body.events, ...p2.body.events].map((e: Json) => e.id);
    assert.equal(new Set(ids).size, 3);

    // ---- opening one change shows before and after ----
    const userEvent = list.body.events.find((e: Json) => e.actorType === "link" && e.tabKey === "users");
    const detail = await t.call(t.routes.event.GET, `/api/checklists/${c.id}/edit-history/${userEvent.id}`, { as: "editor", params: { id: c.id, eventId: userEvent.id } });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.event.before, "j@x.com");
    assert.equal(detail.body.event.after, "j2@x.com");
    const wrongChecklist = await t.mkChecklist();
    const crossed = await t.call(t.routes.event.GET, `/api/checklists/${wrongChecklist.id}/edit-history/${userEvent.id}`, { as: "editor", params: { id: wrongChecklist.id, eventId: userEvent.id } });
    assert.equal(crossed.status, 404, "an event is only readable through its own checklist");
    assert.equal((await t.call(t.routes.history.GET, `/api/checklists/${c.id}/edit-history`, { params: { id: c.id } })).status, 401);

    // ---- a section that changed after recording began, with no record, is flagged ----
    await t.prisma.$executeRaw`UPDATE "Checklist" SET "fieldVersions" = jsonb_set(COALESCE("fieldVersions", '{}'::jsonb), '{sites}', '999'::jsonb) WHERE id = ${c.id}`;
    const flagged = await t.call(t.routes.history.GET, `/api/checklists/${c.id}/edit-history`, { as: "editor", params: { id: c.id } });
    assert.deepEqual(flagged.body.overview.possiblyMissing, ["Sites"]);
  } finally {
    await t.cleanup();
  }
});

test("edit history (local DB): a history failure never fails a save; Claude's changes and restores are recorded", { skip }, async () => {
  const t = await setup();
  try {
    // ---- the history table breaks: the save still succeeds ----
    const c = await t.mkChecklist();
    const jane = await t.newLink(c.id, "Jane Cruz (TP)");
    await t.prisma.$executeRawUnsafe(`ALTER TABLE "ChecklistEditEvent" RENAME TO "ChecklistEditEvent_off"`);
    try {
      const saved = await t.putToken(jane.token, t.usersBody(0, "safe@x.com"));
      assert.equal(saved.status, 200, "the save is not affected by a history failure");
      await t.flush(); // must not throw
    } finally {
      await t.prisma.$executeRawUnsafe(`ALTER TABLE "ChecklistEditEvent_off" RENAME TO "ChecklistEditEvent"`);
    }
    const row = await t.prisma.checklist.findUniqueOrThrow({ where: { id: c.id } });
    assert.equal(((row.users as Json[])[0]).email, "safe@x.com", "and the client's change really was saved");
    assert.equal((await t.events(c.id)).length, 0, "nothing was recorded while the table was broken");

    // ---- Claude (MCP) changes a custom tab row: recorded as Claude, with the row and column named ----
    const tab = {
      id: "ct_scripts", slug: "ai-call-scripts", label: "AI Call Scripts", icon: "Phone", fields: [], mode: "table",
      columns: [{ key: "name", label: "Script name", type: "text" }, { key: "script", label: "Call Script", type: "textarea" }],
      rows: [{ id: "r1", name: "Scheduling", script: "Hello, this is a short script." }],
    };
    const c2 = await t.mkChecklist({ customTabs: [tab] });
    const { createMcpServer } = await import("../src/lib/mcp-server");
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "1" });
    await Promise.all([createMcpServer().connect(b as never), client.connect(a)]);
    const out = (await client.callTool({
      name: "edit_custom_tab_rows",
      arguments: { slug: c2.slug, tab_id: "ct_scripts", mode: "update", rows: [{ id: "r1", script: "Hello, this is the NEW script." }] },
    })) as { isError?: boolean; content: { text: string }[] };
    assert.ok(!out.isError, JSON.stringify(out));
    await t.flush();
    const mcpEvents = (await t.events(c2.id)).filter((e) => e.actorType === "mcp");
    assert.equal(mcpEvents.length, 1);
    assert.equal(mcpEvents[0].actorName, "Claude (MCP)");
    assert.equal(mcpEvents[0].tabLabel, "AI Call Scripts");
    assert.equal(mcpEvents[0].rowLabel, "Scheduling");
    assert.equal(mcpEvents[0].fieldLabel, "Call Script");
    assert.equal(mcpEvents[0].before, "Hello, this is a short script.");
    assert.equal(mcpEvents[0].after, "Hello, this is the NEW script.");

    // ---- restoring a snapshot is recorded: one line, then what changed ----
    const { restoreSnapshot } = await import("../src/lib/snapshot-service");
    const c3 = await t.mkChecklist();
    const snap = await t.prisma.checklistSnapshot.create({
      data: { checklistId: c3.id, label: "Oct 5 backup", payload: { users: [{ id: "u1", name: "Jane Cruz", email: "from-backup@x.com" }] }, versionAtSnapshot: 0, createdBy: "admin" },
    });
    await restoreSnapshot(snap.id, { createdBy: "mcp", createdByLabel: null });
    await t.flush();
    const restored = await t.events(c3.id);
    assert.ok(restored.some((e) => e.changeType === "system" && /Restored the snapshot "Oct 5 backup"/.test(e.summary)));
    const cell = restored.find((e) => e.fieldKey === "email");
    assert.equal(cell?.actorType, "mcp");
    assert.equal(cell?.before, "j@x.com");
    assert.equal(cell?.after, "from-backup@x.com");
  } finally {
    await t.cleanup();
  }
});
