import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

/**
 * Super admins against a real database, through the real routes. Runs only against a LOCAL database
 * (TRACKER_TEST_DATABASE_URL pointing at localhost); skipped otherwise.
 */

const testDb = process.env.TRACKER_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-super-admin-tests-0123456789";
}
const skip = !isLocalDb && "set TRACKER_TEST_DATABASE_URL to a localhost database";

// The users routes reach src/lib/user-invitation.ts, which imports "server-only". That package throws
// unless Next's react-server condition is active, so outside Next it must be stubbed or the import fails.
if (isLocalDb) {
  const require = createRequire(import.meta.url);
  const id = require.resolve("server-only");
  require.cache[id] = { id, filename: id, loaded: true, exports: {} } as NodeJS.Module;
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

test("super admins: who may change what", { skip }, async () => {
  const { NextRequest } = await import("next/server");
  const { createToken } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/db");
  const list = await import("../src/app/api/users/route");
  const one = await import("../src/app/api/users/[id]/route");

  const tag = randomUUID().slice(0, 8);
  const mk = (name: string, role: string, isSuperAdmin = false) =>
    prisma.adminUser.create({ data: { email: `${name}-${tag}@example.invalid`, role, isSuperAdmin }, select: { id: true, email: true } });
  const boss = await mk("boss", "editor", true);
  const admin = await mk("admin", "editor");
  const other = await mk("other", "editor");
  const reader = await mk("reader", "viewer");
  const cookie = (id: string) => `admin_token=${createToken(id)}`;

  const call = async (handler: any, method: string, as: string, id?: string, body?: unknown) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const req = new NextRequest(`http://localhost/api/users${id ? `/${id}` : ""}`, {
      method,
      headers: { cookie: cookie(as), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const res: Response = await handler(req, { params: Promise.resolve({ id: id ?? "" }) });
    const text = await res.text();
    let json: Json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json, text };
  };

  try {
    // a Talkpush Admin cannot make a super admin, and a read-only login cannot do anything here
    assert.equal((await call(one.PATCH, "PATCH", admin.id, other.id, { isSuperAdmin: true })).status, 403);
    assert.equal((await call(one.PATCH, "PATCH", reader.id, other.id, { isSuperAdmin: true })).status, 403);
    assert.equal((await call(list.GET, "GET", reader.id)).status, 403, "read-only logins cannot even look at the list");

    // a super admin can, but only for a Talkpush Admin
    const toReader = await call(one.PATCH, "PATCH", boss.id, reader.id, { isSuperAdmin: true });
    assert.equal(toReader.status, 400);
    assert.match(toReader.json.error, /Talkpush Admin first/);
    const made = await call(one.PATCH, "PATCH", boss.id, admin.id, { isSuperAdmin: true });
    assert.equal(made.status, 200);
    assert.equal(made.json.isSuperAdmin, true);

    // the list shows the flag and never a password hash
    const listed = await call(list.GET, "GET", boss.id);
    assert.equal(listed.status, 200);
    const row = (listed.json.users as Json[]).find((u) => u.id === admin.id);
    assert.equal(row?.isSuperAdmin, true);
    assert.equal(listed.text.includes("passwordHash"), false);

    // an ordinary Talkpush Admin cannot demote or remove a super admin; they still manage ordinary logins
    assert.equal((await call(one.PATCH, "PATCH", other.id, admin.id, { role: "viewer" })).status, 403);
    assert.equal((await call(one.DELETE, "DELETE", other.id, admin.id)).status, 403);
    assert.equal((await call(one.PATCH, "PATCH", other.id, reader.id, { role: "editor" })).status, 200);
    assert.equal((await call(one.PATCH, "PATCH", other.id, reader.id, { role: "viewer" })).status, 200);

    // a super admin cannot be demoted to read-only while still a super admin
    const demote = await call(one.PATCH, "PATCH", boss.id, admin.id, { role: "viewer" });
    assert.equal(demote.status, 400);
    assert.match(demote.json.error, /super admin/);

    // either a role or a super admin flag, never both; nothing else is accepted
    assert.equal((await call(one.PATCH, "PATCH", boss.id, other.id, { role: "viewer", isSuperAdmin: true })).status, 400);
    assert.equal((await call(one.PATCH, "PATCH", boss.id, other.id, { isSuperAdmin: "yes" })).status, 400);

    // a super admin can take it away again, and remove an ordinary Talkpush Admin
    assert.equal((await call(one.PATCH, "PATCH", boss.id, admin.id, { isSuperAdmin: false })).json.isSuperAdmin, false);
    assert.equal((await call(one.DELETE, "DELETE", boss.id, other.id)).status, 200);
  } finally {
    await prisma.adminUser.deleteMany({ where: { id: { in: [boss.id, admin.id, other.id, reader.id] } } }).catch(() => undefined);
  }
});
