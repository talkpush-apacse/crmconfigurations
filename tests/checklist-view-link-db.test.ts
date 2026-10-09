import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

/**
 * The read-only "can view" link, through the REAL routes and a real LOCAL database: who may create it, that the
 * address works, that "new address" and "turn off" kill the old one at once, that it never opens the editor
 * routes (so it cannot save), and that nothing public ever returns it.
 * Skipped unless WORKFLOW_TEST_DATABASE_URL points at localhost (see tests/edit-history-db.test.ts).
 */
const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-view-link-tests-0123456789abcdef";
  const req = Module.createRequire(__filename);
  const resolved = req.resolve("server-only");
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: {} } as never;
}
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

test("view link (local DB): create, copy again, new address, turn off, and never a way to write", { skip }, async () => {
  const { NextRequest } = await import("next/server");
  const { createToken } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/db");
  const { loadPublicChecklistByViewToken, loadPublicChecklistBySlug } = await import("../src/lib/checklist-loaders");
  const route = await import("../src/app/api/checklists/[id]/view-link/route");
  const byToken = await import("../src/app/api/checklists/by-token/[token]/route");
  const bySlug = await import("../src/app/api/checklists/by-slug/[slug]/route");

  const stamp = Date.now().toString(36);
  const editor = await prisma.adminUser.create({ data: { email: `vl-editor-${stamp}@example.invalid`, role: "editor" } });
  const viewer = await prisma.adminUser.create({ data: { email: `vl-viewer-${stamp}@example.invalid`, role: "viewer" } });
  const cookies = { editor: `admin_token=${createToken(editor.id)}`, viewer: `admin_token=${createToken(viewer.id)}` };
  const checklist = await prisma.checklist.create({
    data: { slug: `vl-${stamp}`, clientName: `View Link Test ${stamp}`, ownerEmail: "owner@example.invalid" },
  });

  const call = async (handler: any, url: string, opts: { method?: string; body?: unknown; as?: "editor" | "viewer"; params?: Json } = {}) => {
    const req = new NextRequest(`http://localhost${url}`, {
      method: opts.method ?? "GET",
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
    return { status: res.status, body, text };
  };
  const url = `/api/checklists/${checklist.id}/view-link`;
  const params = { id: checklist.id };
  const act = (action: string, as: "editor" | "viewer" | "signed-out" = "editor") =>
    call(route.POST, url, { method: "POST", body: { action }, as: as === "signed-out" ? undefined : as, params });

  try {
    // Off to begin with, and only a signed-in Talkpush Admin may even look.
    assert.equal((await call(route.GET, url, { as: "editor", params })).body.token, null);
    assert.equal((await call(route.GET, url, { params })).status, 401, "signed out");
    assert.equal((await call(route.GET, url, { as: "viewer", params })).status, 403, "read-only login must not see the secret");
    assert.equal((await act("enable", "viewer")).status, 403, "read-only login must not create it");
    assert.equal((await act("enable", "signed-out")).status, 401);
    assert.equal((await act("nonsense")).status, 400);
    assert.equal((await call(route.GET, "/api/checklists/nope/view-link", { as: "editor", params: { id: "nope" } })).status, 404);

    // Create it. Asking again keeps the same address, so a link already sent never breaks.
    const first = (await act("enable")).body.token as string;
    assert.match(first, /^[A-Za-z0-9_-]{32}$/);
    assert.equal((await act("enable")).body.token, first);

    // The address opens the client slice, with neither secret in it.
    const page = await loadPublicChecklistByViewToken(first);
    assert.equal(page?.clientName, `View Link Test ${stamp}`);
    const asJson = JSON.stringify(page);
    assert.equal(asJson.includes(first), false, "the view token is not echoed");
    assert.equal(asJson.includes(checklist.editorToken), false, "the editor token is not exposed");
    assert.equal(asJson.includes("owner@example.invalid"), false, "the owner's email is not exposed");

    // It is not an editor link or a client link: no read or write route accepts it.
    assert.equal((await call(byToken.GET, `/api/checklists/by-token/${first}`, { params: { token: first } })).status, 404);
    for (const put of [
      await call(byToken.PUT, `/api/checklists/by-token/${first}`, {
        method: "PUT",
        body: { version: 0, changedFields: ["users"], users: [{ id: "u1", name: "Intruder" }] },
        params: { token: first },
      }),
      await call(bySlug.PUT, `/api/checklists/by-slug/${first}`, {
        method: "PUT",
        body: { version: 0, changedFields: ["users"], users: [{ id: "u1", name: "Intruder" }] },
        params: { slug: first },
      }),
    ]) {
      assert.equal(put.status, 404, "the view link cannot save");
    }
    assert.deepEqual((await prisma.checklist.findUnique({ where: { id: checklist.id }, select: { users: true } }))?.users ?? [], []);

    // Nothing public returns the view token.
    const editorSlice = await call(byToken.GET, "/x", { params: { token: checklist.editorToken } });
    assert.equal(editorSlice.status, 200);
    assert.equal(editorSlice.text.includes(first), false);
    assert.equal("viewToken" in editorSlice.body, false);
    const clientSlice = JSON.stringify(await loadPublicChecklistBySlug(checklist.slug));
    assert.equal(clientSlice.includes(first), false);
    assert.equal(clientSlice.includes("viewToken"), false);

    // A new address replaces the old one at once.
    const second = (await act("regenerate")).body.token as string;
    assert.notEqual(second, first);
    assert.equal(await loadPublicChecklistByViewToken(first), null);
    assert.ok(await loadPublicChecklistByViewToken(second));

    // Turned off: nothing matches, not even the empty value.
    assert.equal((await act("turn_off")).body.token, null);
    assert.equal(await loadPublicChecklistByViewToken(second), null);
    assert.equal(await loadPublicChecklistByViewToken(""), null);

    // Turning it on again makes a fresh address, never an old one.
    const third = (await act("enable")).body.token as string;
    assert.ok(third !== first && third !== second);
  } finally {
    await prisma.checklist.deleteMany({ where: { id: checklist.id } });
    await prisma.adminUser.deleteMany({ where: { id: { in: [editor.id, viewer.id] } } });
    await prisma.$disconnect();
  }
});
