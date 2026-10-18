import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/**
 * Starting a client's checklist through the Claude connector (create_checklist). The first part needs no database.
 * The second part runs only against a LOCAL database (WORKFLOW_TEST_DATABASE_URL pointing at localhost), the same rule
 * as tests/checklist-share-mcp.test.ts.
 */

const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  const req = Module.createRequire(__filename);
  const resolved = req.resolve("server-only");
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: {} } as never;
} else {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
}
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

const ORIGIN = "https://hub.example.test";
const stamp = Date.now().toString(36);

type ServerLike = { connect: (t: never) => Promise<void> };
async function connect(server: ServerLike) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1" });
  await Promise.all([server.connect(serverSide as never), client.connect(clientSide)]);
  return client;
}

async function serverFor(readOnly: boolean) {
  const { createCombinedMcpServer } = await import("../src/lib/mcp/combined");
  return createCombinedMcpServer(ORIGIN, { actor: { label: "Claude for tester@talkpush.com", via: "mcp" }, readOnly, origin: ORIGIN }) as unknown as ServerLike;
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

test("create_checklist: offered to an editor, hidden from a read-only connection, described honestly", async () => {
  const { CHECKLIST_READ_TOOLS } = await import("../src/lib/mcp/checklist-read-tools");
  assert.ok(!CHECKLIST_READ_TOOLS.has("create_checklist"), "it changes data, so it must stay off the read-only list");

  const editor = (await (await connect(await serverFor(false))).listTools()).tools;
  const tool = editor.find((t) => t.name === "create_checklist");
  assert.ok(tool, "offered to an editor");
  const props = Object.keys((tool!.inputSchema as { properties: Record<string, unknown> }).properties).sort();
  assert.deepEqual(props, ["account", "client_name", "slug"]);
  assert.deepEqual((tool!.inputSchema as { required?: string[] }).required, ["client_name"]);
  for (const phrase of ["Safe to repeat", "ARCHIVED", "does NOT generate the configurator items", "does NOT create any client link", "starts private"]) {
    assert.ok(tool!.description!.includes(phrase), `the description says: ${phrase}`);
  }

  const readOnly = (await (await connect(await serverFor(true))).listTools()).tools.map((t) => t.name);
  assert.ok(!readOnly.includes("create_checklist"), "hidden from a read-only login");
});

test("slug rules: plain-language reasons, and the website's name-to-address rule", async () => {
  const { slugFromName, slugProblem } = await import("../src/lib/checklists/create-checklist");
  assert.equal(slugFromName("TaskUs PH"), "taskus-ph");
  assert.equal(slugFromName("  ZZ Test Checklist DELETE ME "), "zz-test-checklist-delete-me");
  assert.equal(slugFromName("!!!"), "");
  assert.equal(slugProblem("taskus-ph"), null);
  assert.equal(slugProblem("a1"), null);
  assert.match(slugProblem("")!, /empty/);
  assert.match(slugProblem("TaskUs-PH")!, /capital letters.*try "taskus-ph"/);
  assert.match(slugProblem("task us")!, /spaces/);
  assert.match(slugProblem("task_us")!, /characters a web address cannot use/);
  assert.match(slugProblem("-task")!, /starts or ends with a hyphen/);
  assert.match(slugProblem("task--us")!, /two hyphens/);
  assert.match(slugProblem("a".repeat(81))!, /limit is 80/);
  assert.equal(slugProblem("a".repeat(80)), null);
});

test("create_checklist (local DB): create, repeat, archived, bad account, bad slug", { skip }, async () => {
  const { prisma } = await import("../src/lib/db");
  const { getAllSelectableTabSlugs } = await import("../src/lib/tab-config");
  const client = await connect(await serverFor(false));

  const acct = await prisma.trackerAccount.create({ data: { name: `Create Test Co ${stamp}`, slug: `create-test-co-${stamp}` } });
  const other = await prisma.trackerAccount.create({ data: { name: `Create Other Co ${stamp}`, slug: `create-other-co-${stamp}` } });
  const oldAcct = await prisma.trackerAccount.create({ data: { name: `Create Old Co ${stamp}`, slug: `create-old-co-${stamp}`, archived: true } });
  const name = `Create Test ${stamp}`;
  const slug = `create-test-${stamp}`;
  const count = () => prisma.checklist.count({ where: { slug: { startsWith: `create-` }, clientName: { contains: stamp } } });
  const listed = async (includeArchived = false) => {
    const r = await call(client, "list_checklists", { include_archived: includeArchived });
    return (r.json as unknown as { slug: string; archivedAt: string | null }[]).filter((c) => c.slug.includes(stamp));
  };

  try {
    // 1. Create it, filed under the account. It shows up in list_checklists, with no custom tabs.
    const first = await call(client, "create_checklist", { client_name: name, account: acct.name });
    assert.equal(first.isError, false, first.text);
    assert.deepEqual(first.json, {
      result: "created",
      slug,
      clientName: name,
      account: { id: acct.id, name: acct.name },
      note: first.json!.note,
    });
    assert.deepEqual((await listed()).map((c) => c.slug), [slug]);
    const tabs = await call(client, "list_custom_tabs", { slug });
    assert.equal(tabs.isError, false);
    assert.match(tabs.text, /has no custom tabs yet/);

    // It is private and empty: no client link, no configurator items, every standard tab on, default content in the sections.
    const row = await prisma.checklist.findUniqueOrThrow({ where: { slug } });
    assert.equal(row.viewToken, null);
    assert.equal(row.configuratorChecklist, null);
    assert.equal(row.archivedAt, null);
    assert.equal(row.accountId, acct.id);
    assert.equal(row.isCustom, false);
    assert.deepEqual(row.enabledTabs, getAllSelectableTabSlugs());
    assert.notEqual(row.companyInfo, null);
    assert.equal(await prisma.checklistSnapshot.count({ where: { checklistId: row.id } }), 0);

    // 2. Again with the same inputs: already existed, nothing new.
    const again = await call(client, "create_checklist", { client_name: name, account: acct.name });
    assert.equal(again.isError, false);
    assert.equal(again.json!.result, "already_existed");
    assert.equal(again.json!.slug, slug);
    assert.equal(again.json!.warnings, undefined);
    assert.equal((await listed()).length, 1);
    assert.equal((await prisma.checklist.findUniqueOrThrow({ where: { slug } })).updatedAt.getTime(), row.updatedAt.getTime(), "nothing was touched");

    // 2b. Same address, but a different account and name: reported, not changed.
    const differs = await call(client, "create_checklist", { client_name: `${name} Renamed`, account: other.name, slug });
    assert.equal(differs.json!.result, "already_existed");
    assert.equal(differs.json!.clientName, name);
    assert.deepEqual(differs.json!.account, { id: acct.id, name: acct.name });
    assert.equal(differs.json!.warnings.length, 2);
    assert.match(differs.json!.warnings[1], /filed under .*not .*Nothing was changed/);
    const afterDiffers = await prisma.checklist.findUniqueOrThrow({ where: { slug } });
    assert.equal(afterDiffers.accountId, acct.id);
    assert.equal(afterDiffers.clientName, name);

    // 3. A custom tab can be designed on it (preview only: nothing is written).
    const preview = await call(client, "preview_custom_tab", {
      slug,
      tab_name: "Pre-boarding Documents",
      columns: [{ label: "Document", type: "text" }],
    });
    assert.equal(preview.isError, false, preview.text);
    assert.match((await call(client, "list_custom_tabs", { slug })).text, /has no custom tabs yet/);

    // 4. A name that matches no account: plain message, nothing created.
    const mine = () => prisma.checklist.count({ where: { OR: [{ clientName: { contains: stamp } }, { clientName: "!!!" }] } });
    const before = await mine();
    const unknown = await call(client, "create_checklist", { client_name: `Create Nobody ${stamp}`, account: "No Such Account" });
    assert.equal(unknown.isError, true);
    assert.match(unknown.text, /No account is called "No Such Account"/);
    assert.equal(await mine(), before);
    const archivedAcct = await call(client, "create_checklist", { client_name: `Create Nobody ${stamp}`, account: oldAcct.name });
    assert.equal(archivedAcct.isError, true);
    assert.match(archivedAcct.text, /is archived, so nothing can be filed under it/);
    assert.equal(await mine(), before);

    // 5. A bad slug: reason given, nothing created.
    for (const bad of ["Bad Slug", "UPPER", "-x", "x-", "a--b", "x_y", "a".repeat(81)]) {
      const r = await call(client, "create_checklist", { client_name: `Create Nobody ${stamp}`, slug: bad });
      assert.equal(r.isError, true, `${bad} is refused`);
      assert.match(r.text, /slug/);
    }
    const noLetters = await call(client, "create_checklist", { client_name: "!!!" });
    assert.equal(noLetters.isError, true);
    assert.match(noLetters.text, /no letters or numbers/);
    assert.equal(await mine(), before);

    // 6. An archived checklist at that address: an error, and it is not restored.
    await prisma.checklist.update({ where: { slug }, data: { archivedAt: new Date("2026-01-01T00:00:00Z") } });
    const archived = await call(client, "create_checklist", { client_name: name, account: acct.name });
    assert.equal(archived.isError, true);
    assert.match(archived.text, /exists but is archived/);
    assert.match(archived.text, /not restored/);
    assert.equal((await prisma.checklist.findUniqueOrThrow({ where: { slug } })).archivedAt?.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(await mine(), before);

    // Without an account the checklist waits under "needs a company".
    const loose = await call(client, "create_checklist", { client_name: `Create Loose ${stamp}` });
    assert.equal(loose.json!.result, "created");
    assert.equal(loose.json!.account, null);
    assert.equal(await count(), 2);
  } finally {
    await prisma.checklist.deleteMany({ where: { clientName: { contains: stamp } } });
    await prisma.trackerAccount.deleteMany({ where: { id: { in: [acct.id, other.id, oldAcct.id] } } });
    await prisma.$disconnect();
  }
});
