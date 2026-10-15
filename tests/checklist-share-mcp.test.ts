import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/**
 * Checklist client links through the Claude connector (create_checklist_link, list_checklist_links, change_checklist_link).
 * The first part needs no database. The second part runs only against a LOCAL database (WORKFLOW_TEST_DATABASE_URL
 * pointing at localhost), the same rule as tests/checklist-view-link-db.test.ts.
 */

const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  // view-link.ts guards itself with `server-only`, which refuses to load outside a Next.js build.
  const req = Module.createRequire(__filename);
  const resolved = req.resolve("server-only");
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: {} } as never;
} else {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
}
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

const ORIGIN = "https://hub.example.test";
const SHARE_TOOLS = ["create_checklist_link", "list_checklist_links", "change_checklist_link"];

type ServerLike = { connect: (t: never) => Promise<void> };
async function connect(server: ServerLike) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1" });
  await Promise.all([server.connect(serverSide as never), client.connect(clientSide)]);
  return client;
}

async function serverFor(readOnly: boolean, origin: string | null = ORIGIN) {
  const { createCombinedMcpServer } = await import("../src/lib/mcp/combined");
  return createCombinedMcpServer(ORIGIN, { actor: { label: "Claude for tester@talkpush.com", via: "mcp" }, readOnly, origin: origin ?? undefined }) as unknown as ServerLike;
}

async function call(client: Client, name: string, args: Record<string, unknown>) {
  const res = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { type: string; text: string }[] };
  const text = res.content[0]?.text ?? "";
  let json: Record<string, any> | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    json = JSON.parse(text);
  } catch {
    /* an error message, not JSON */
  }
  return { isError: !!res.isError, text, json };
}

test("link tools: offered to an editor, hidden from a read-only connection", async () => {
  const editor = (await (await connect(await serverFor(false))).listTools()).tools.map((t) => t.name);
  for (const name of SHARE_TOOLS) assert.ok(editor.includes(name), `${name} is offered to an editor`);
  const readOnly = (await (await connect(await serverFor(true))).listTools()).tools.map((t) => t.name);
  for (const name of SHARE_TOOLS) assert.ok(!readOnly.includes(name), `${name} is hidden from a read-only login (it shows secret addresses)`);
});

test("link tools: they ask for an explicit request and say nothing is emailed", async () => {
  const { checklistShareTools } = await import("../src/lib/mcp/checklist-share-tools");
  assert.deepEqual(checklistShareTools.map((t) => t.name).sort(), [...SHARE_TOOLS].sort());
  for (const t of checklistShareTools) assert.equal(t.access, "write", `${t.name} must not be offered to read-only logins`);
  const create = checklistShareTools.find((t) => t.name === "create_checklist_link")!;
  assert.match(create.description, /explicitly asks/);
  assert.match(create.description, /nothing is emailed/i);
  assert.match(create.description, /Original shared link/);
});

test("link tools: no address to build links on is a plain message, not a crash", async () => {
  const client = await connect(await serverFor(false, null));
  const r = await call(client, "create_checklist_link", { slug: "does-not-matter", level: "view" });
  assert.equal(r.isError, true);
  assert.match(r.text, /address/);
});

test("link tools (local DB): view, original edit, named edit, list, new address, turn off", { skip }, async () => {
  const { prisma } = await import("../src/lib/db");
  const stamp = Date.now().toString(36);
  const checklist = await prisma.checklist.create({
    data: { slug: `csl-${stamp}`, clientName: `Share Tool Test ${stamp}`, ownerEmail: "owner@example.invalid" },
  });
  try {
    const client = await connect(await serverFor(false));
    const slug = checklist.slug;

    // view: off at first, create turns it on, asking again returns the same address
    const v1 = await call(client, "create_checklist_link", { slug, level: "view" });
    assert.equal(v1.isError, false, v1.text);
    const viewToken = (await prisma.checklist.findUniqueOrThrow({ where: { id: checklist.id } })).viewToken;
    assert.ok(viewToken);
    assert.equal(v1.json?.url, `${ORIGIN}/view/${viewToken}/welcome`);
    const v2 = await call(client, "create_checklist_link", { slug, level: "view", tab: "users" });
    assert.equal(v2.json?.url, `${ORIGIN}/view/${viewToken}/users`, "same address, opens the tab asked for");
    const byLabel = await call(client, "create_checklist_link", { slug, level: "view", tab: "User List" });
    assert.equal(byLabel.json?.url, `${ORIGIN}/view/${viewToken}/users`, "a tab can be named by its label");

    // a tab Talkpush fills in is not part of the view link, so it opens the start page with a note
    const talkpushTab = await call(client, "create_checklist_link", { slug, level: "view", tab: "campaigns" });
    assert.equal(talkpushTab.json?.url, `${ORIGIN}/view/${viewToken}/welcome`);
    assert.match(JSON.stringify(talkpushTab.json?.notes), /filled in by Talkpush/);

    // an unknown tab is an error that lists the real ones
    const badTab = await call(client, "create_checklist_link", { slug, level: "view", tab: "nope" });
    assert.equal(badTab.isError, true);
    assert.match(badTab.text, /not a tab/);

    // a view link takes no name or expiry
    const viewName = await call(client, "create_checklist_link", { slug, level: "view", name: "Pat" });
    assert.equal(viewName.isError, true);

    // edit, original shared link
    const e1 = await call(client, "create_checklist_link", { slug, level: "edit", tab: "sites" });
    assert.equal(e1.isError, false, e1.text);
    assert.equal(e1.json?.url, `${ORIGIN}/editor/${checklist.editorToken}/sites`);
    assert.equal(e1.json?.kind, "original shared link");
    const noExpiry = await call(client, "create_checklist_link", { slug, level: "edit", expires_at: "2099-01-01" });
    assert.equal(noExpiry.isError, true, "the original link cannot expire");

    // edit, named
    const n1 = await call(client, "create_checklist_link", { slug, level: "edit", name: "Pat Client", tab: "users" });
    assert.equal(n1.isError, false, n1.text);
    assert.match(String(n1.json?.url), new RegExp(`^${ORIGIN}/editor/cel_[A-Za-z0-9_-]+/users$`));
    const stored = await prisma.checklistEditLink.findUniqueOrThrow({ where: { id: n1.json?.linkId } });
    assert.equal(stored.name, "Pat Client");
    assert.equal(stored.createdByLabel, "Claude for tester@talkpush.com");
    const dup = await call(client, "create_checklist_link", { slug, level: "edit", name: "pat client" });
    assert.equal(dup.isError, true);
    assert.match(dup.text, /already an active link/);
    const past = await call(client, "create_checklist_link", { slug, level: "edit", name: "Late Lee", expires_at: "2001-01-01" });
    assert.equal(past.isError, true);
    assert.match(past.text, /future/);

    // list
    const list = await call(client, "list_checklist_links", { slug });
    assert.equal(list.json?.viewLink.on, true);
    assert.equal(list.json?.originalEditLink.url, `${ORIGIN}/editor/${checklist.editorToken}/welcome`);
    assert.equal(list.json?.namedEditLinks.length, 1);
    assert.equal(list.json?.namedEditLinks[0].status, "active");

    // new address: view and named edit
    const nv = await call(client, "change_checklist_link", { slug, link: "view", action: "new_address" });
    assert.equal(nv.isError, false, nv.text);
    const newViewToken = (await prisma.checklist.findUniqueOrThrow({ where: { id: checklist.id } })).viewToken;
    assert.ok(newViewToken && newViewToken !== viewToken, "the old view address is replaced");
    assert.equal(nv.json?.url, `${ORIGIN}/view/${newViewToken}/welcome`);
    const ne = await call(client, "change_checklist_link", { slug, link: n1.json?.linkId, action: "new_address" });
    assert.equal(ne.isError, false, ne.text);
    assert.notEqual(ne.json?.url, n1.json?.url.replace("/users", "/welcome"));

    // turn off: named edit (kept in the list as turned off, no address shown), then view
    const off = await call(client, "change_checklist_link", { slug, link: n1.json?.linkId, action: "turn_off" });
    assert.equal(off.isError, false, off.text);
    const after = await call(client, "list_checklist_links", { slug });
    assert.equal(after.json?.namedEditLinks[0].status, "turned off");
    assert.equal(after.json?.namedEditLinks[0].url, null);
    const offView = await call(client, "change_checklist_link", { slug, link: "view", action: "turn_off" });
    assert.equal(offView.isError, false, offView.text);
    assert.equal((await prisma.checklist.findUniqueOrThrow({ where: { id: checklist.id } })).viewToken, null);
    const renewOff = await call(client, "change_checklist_link", { slug, link: "view", action: "new_address" });
    assert.equal(renewOff.isError, true, "a new address for a link that is off is refused, not a way to turn it on");

    // ids and slugs that do not exist
    const badLink = await call(client, "change_checklist_link", { slug, link: "nope", action: "turn_off" });
    assert.equal(badLink.isError, true);
    assert.match(badLink.text, /list_checklist_links/);
    const badSlug = await call(client, "create_checklist_link", { slug: "no-such-checklist", level: "view" });
    assert.equal(badSlug.isError, true);
    assert.match(badSlug.text, /list_checklists/);
  } finally {
    await prisma.checklist.delete({ where: { id: checklist.id } });
    await prisma.$disconnect();
  }
});
