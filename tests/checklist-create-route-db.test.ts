import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

/**
 * The website's "Create New Checklist" request (POST /api/checklists). This pins down what it does today so that moving
 * its logic into src/lib/checklists/create-checklist.ts (shared with Claude's create_checklist tool) changes nothing.
 * Runs only against a LOCAL database (skipped otherwise). It signs a made-up staff login in-process with a made-up secret.
 */
const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-checklist-create-tests-0123456789";
  const req = Module.createRequire(__filename);
  const resolved = req.resolve("server-only");
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: {} } as never;
}
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const stamp = Date.now().toString(36);

test("website create-checklist request (local DB): checks, defaults and the 409 are what they were", { skip }, async () => {
  const { NextRequest } = await import("next/server");
  const { createToken } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/db");
  const { POST } = await import("../src/app/api/checklists/route");

  const user = await prisma.adminUser.create({ data: { email: `create-route-${stamp}@example.invalid`, role: "editor" } });
  const cookie = `admin_token=${createToken(user.id)}`;
  const post = async (body: unknown) => {
    const res = await POST(
      new NextRequest("http://localhost/api/checklists", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(body),
      })
    );
    return { status: res.status, body: (await res.json()) as Json };
  };

  const account = await prisma.trackerAccount.create({ data: { name: `Route Test Co ${stamp}`, slug: `route-test-co-${stamp}` } });
  const archived = await prisma.trackerAccount.create({ data: { name: `Route Old Co ${stamp}`, slug: `route-old-co-${stamp}`, archived: true } });
  const slugs: string[] = [];

  try {
    assert.deepEqual(await post({}), { status: 400, body: { error: "Client name is required" } });
    assert.deepEqual(await post({ clientName: "X", ownerEmail: "nope" }), { status: 400, body: { error: "Owner email must be a valid email address" } });
    assert.deepEqual(await post({ clientName: "X", accountId: "" }), { status: 400, body: { error: "accountId must be a company id." } });
    assert.deepEqual(await post({ clientName: "X", accountId: 5 }), { status: 400, body: { error: "accountId must be a company id." } });
    assert.deepEqual(await post({ clientName: "X", accountId: "no-such-id" }), { status: 404, body: { error: "That company was not found." } });
    const toArchived = await post({ clientName: "X", accountId: archived.id });
    assert.equal(toArchived.status, 400);
    assert.match(toArchived.body.error, /is archived/);

    const name = `Route Test ${stamp}`;
    const tabs = ["welcome", "users"];
    const made = await post({ clientName: name, accountId: account.id, enabledTabs: tabs, communicationChannels: { sms: true }, featureToggles: { a: 1 } });
    assert.equal(made.status, 201);
    slugs.push(made.body.slug);
    assert.equal(made.body.slug, `route-test-${stamp}`);
    assert.equal(made.body.clientName, name);
    assert.equal(made.body.accountId, account.id);
    assert.equal(made.body.isCustom, false);
    assert.equal(made.body.ownerEmail, null);
    assert.equal(made.body.archivedAt, null);
    assert.equal(made.body.viewToken, null, "no client link is turned on");
    assert.deepEqual(made.body.enabledTabs, tabs);
    assert.deepEqual(made.body.communicationChannels, { sms: true });
    assert.deepEqual(made.body.featureToggles, { a: 1 });
    assert.equal(made.body.configuratorChecklist, null, "no configurator items");
    for (const section of ["companyInfo", "users", "campaigns", "sites", "prescreening", "messaging", "sources", "folders", "documents", "attributes"]) {
      assert.notEqual(made.body[section], null, `${section} starts with its default content`);
    }

    assert.deepEqual(await post({ clientName: name }), { status: 409, body: { error: "A checklist with this name already exists" } });

    // Nothing chosen: tabs/channels/toggles stay empty (null), no account.
    const bare = await post({ clientName: `Route Bare ${stamp}`, ownerEmail: " Someone@Example.com " });
    assert.equal(bare.status, 201);
    slugs.push(bare.body.slug);
    assert.equal(bare.body.enabledTabs, null);
    assert.equal(bare.body.accountId, null);
    assert.equal(bare.body.ownerEmail, "someone@example.com");

    const custom = await post({ clientName: `Route Custom ${stamp}`, isCustom: true, customSchema: [{ id: "f1" }] });
    assert.equal(custom.status, 201);
    slugs.push(custom.body.slug);
    assert.equal(custom.body.isCustom, true);
    assert.deepEqual(custom.body.enabledTabs, []);
    assert.deepEqual(custom.body.customSchema, [{ id: "f1" }]);
    assert.deepEqual(custom.body.customData, {});
    assert.equal(custom.body.companyInfo, null);
  } finally {
    await prisma.checklist.deleteMany({ where: { slug: { in: slugs } } });
    await prisma.trackerAccount.deleteMany({ where: { id: { in: [account.id, archived.id] } } });
    await prisma.adminUser.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});
