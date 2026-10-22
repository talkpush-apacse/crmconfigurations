import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/**
 * Choosing which tabs a checklist shows (update_checklist_tabs). The first tests need no database. The last one runs only
 * against a LOCAL database (WORKFLOW_TEST_DATABASE_URL pointing at localhost), the same rule as tests/checklist-create-mcp.test.ts.
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

// ---------------------------------------------------------------------------
// The rules (no database)
// ---------------------------------------------------------------------------

const ALL = [
  "welcome", "company-info", "users", "campaigns", "sites", "prescreening", "messaging", "sources", "folders", "documents",
  "attributes", "facebook-whatsapp", "instagram", "ai-call-faqs", "rejection-reasons", "agency-portal", "labels",
  "admin-settings", "autoflows", "integrations",
];
const STATE = { isCustom: false, enabledTabs: null, tabOrder: null, tabFilledBy: null, customTabs: null };
const CUSTOM = [{ id: "t1", slug: "messenger-chatbot", label: "Messenger Chatbot" }] as never;

test("a checklist with no stored tab list has every standard tab on; turning all but Welcome off lists what went", async () => {
  const { planTabSettings } = await import("../src/lib/checklists/tab-settings");
  const plan = planTabSettings(STATE, { enabledTabs: ["welcome"] });
  assert.equal(plan.unchanged, false);
  assert.deepEqual(plan.changed, { enabledTabs: true, tabOrder: false, tabFilledBy: false });
  assert.deepEqual(plan.report.tabsOnBefore, ALL);
  assert.deepEqual(plan.report.tabsOnNow, ["welcome"]);
  assert.deepEqual(plan.report.turnedOff, ALL.slice(1));
  assert.deepEqual(plan.report.turnedOn, []);
  assert.deepEqual(plan.next.enabledTabs, ["welcome"]);
});

test("the same input twice changes nothing, whatever order the tabs are listed in", async () => {
  const { planTabSettings } = await import("../src/lib/checklists/tab-settings");
  const first = planTabSettings(STATE, { enabledTabs: ["users", "welcome", "sites"] });
  assert.deepEqual(first.next.enabledTabs, ["welcome", "users", "sites"], "stored in the website's own tab order");
  const second = planTabSettings({ ...STATE, enabledTabs: first.next.enabledTabs }, { enabledTabs: ["sites", "users", "welcome", "users"] });
  assert.equal(second.unchanged, true);
  assert.deepEqual(second.report.turnedOn, []);
  assert.deepEqual(second.report.turnedOff, []);
  // Asking for every tab on a checklist that has no stored list is not a change either.
  assert.equal(planTabSettings(STATE, { enabledTabs: ALL }).unchanged, true);
});

test("an unknown tab name is refused and the message lists the valid names", async () => {
  const { planTabSettings, TabSettingsError } = await import("../src/lib/checklists/tab-settings");
  assert.throws(
    () => planTabSettings(STATE, { enabledTabs: ["welcome", "messenger"] }),
    (err: unknown) => {
      assert.ok(err instanceof TabSettingsError);
      assert.match(err.message, /"messenger" is not a tab name/);
      assert.match(err.message, /Nothing was changed/);
      for (const slug of ALL) assert.ok(err.message.includes(slug), `lists ${slug}`);
      return true;
    }
  );
  assert.throws(() => planTabSettings({ ...STATE, customTabs: CUSTOM }, { enabledTabs: ["custom-messenger-chatbot"] }), /Custom tabs are not turned on or off here/);
  assert.throws(() => planTabSettings(STATE, { enabledTabs: ["welcome"], tabOrder: ["nope"] }), /tab names for the order: welcome/);
  assert.throws(() => planTabSettings(STATE, { enabledTabs: ["welcome"], filledBy: { nope: "client" } }), /tab names for filled_by/);
});

test("Welcome can be turned off, with a warning; the checklist must keep at least one tab", async () => {
  const { planTabSettings } = await import("../src/lib/checklists/tab-settings");
  const off = planTabSettings(STATE, { enabledTabs: ["users"] });
  assert.ok(off.report.warnings.some((w) => /Welcome is now off/.test(w)));
  assert.throws(() => planTabSettings(STATE, { enabledTabs: [] }), /no tabs at all/);
  // A custom tab counts as a tab, so Welcome plus nothing else is fine once there is one.
  const customOnly = planTabSettings({ ...STATE, customTabs: CUSTOM }, { enabledTabs: [] });
  assert.deepEqual(customOnly.report.tabsOnNow, []);
  assert.deepEqual(customOnly.report.customTabs, ["custom-messenger-chatbot"]);
});

test("a client link that would show nothing gets a warning", async () => {
  const { planTabSettings } = await import("../src/lib/checklists/tab-settings");
  // campaigns and folders are filled in by Talkpush, so the client does not see them.
  const plan = planTabSettings(STATE, { enabledTabs: ["campaigns", "folders"] });
  assert.ok(plan.report.warnings.some((w) => /client link would show no tabs/.test(w)));
  assert.equal(planTabSettings(STATE, { enabledTabs: ["welcome", "campaigns"] }).report.warnings.some((w) => /no tabs/.test(w)), false);
});

test("order and filled-by: only what is named changes, custom tabs can be named, repeats change nothing", async () => {
  const { planTabSettings } = await import("../src/lib/checklists/tab-settings");
  const state = { ...STATE, customTabs: CUSTOM };
  const plan = planTabSettings(state, {
    enabledTabs: ["welcome", "messaging"],
    tabOrder: ["custom-messenger-chatbot", "welcome"],
    filledBy: { messaging: "talkpush", "custom-messenger-chatbot": "client" },
  });
  assert.deepEqual(plan.next.tabOrder.slice(0, 3), ["custom-messenger-chatbot", "welcome", "company-info"]);
  assert.equal(plan.next.tabOrder.length, ALL.length + 1);
  assert.deepEqual(plan.report.filledByChanges, [{ tab: "messaging", from: "client", to: "talkpush" }], "custom tab is already 'client', so that is not a change");
  assert.deepEqual(plan.next.tabFilledBy, { messaging: "talkpush" });

  const again = planTabSettings(
    { ...state, enabledTabs: plan.next.enabledTabs, tabOrder: plan.next.tabOrder, tabFilledBy: plan.next.tabFilledBy },
    { enabledTabs: ["messaging", "welcome"], tabOrder: ["custom-messenger-chatbot", "welcome"], filledBy: { messaging: "talkpush" } }
  );
  assert.equal(again.unchanged, true);
});

test("a custom-form checklist has no standard tabs to change", async () => {
  const { planTabSettings } = await import("../src/lib/checklists/tab-settings");
  assert.throws(() => planTabSettings({ ...STATE, isCustom: true, enabledTabs: [] }, { enabledTabs: ["welcome"] }), /custom-form checklist/);
});

test("update_checklist_tabs: offered to an editor, hidden from a read-only login, described honestly", async () => {
  const { CHECKLIST_READ_TOOLS } = await import("../src/lib/mcp/checklist-read-tools");
  assert.ok(!CHECKLIST_READ_TOOLS.has("update_checklist_tabs"), "it changes data, so it must stay off the read-only list");

  const editor = (await (await connect(await serverFor(false))).listTools()).tools;
  const tool = editor.find((t) => t.name === "update_checklist_tabs");
  assert.ok(tool, "offered to an editor");
  const props = Object.keys((tool!.inputSchema as { properties: Record<string, unknown> }).properties).sort();
  assert.deepEqual(props, ["enabled_tabs", "filled_by", "slug", "tab_order"]);
  assert.deepEqual((tool!.inputSchema as { required?: string[] }).required?.sort(), ["enabled_tabs", "slug"]);
  for (const phrase of ["FULL list", "only hides it", "Safe to repeat", "never turned off here", "Welcome can be turned off", "valid names"]) {
    assert.ok(tool!.description!.includes(phrase), `the description says: ${phrase}`);
  }
  const create = editor.find((t) => t.name === "create_checklist")!;
  assert.ok(create.description!.includes("update_checklist_tabs"), "create_checklist no longer implies the tab list is fixed");

  const readOnly = (await (await connect(await serverFor(true))).listTools()).tools.map((t) => t.name);
  assert.ok(!readOnly.includes("update_checklist_tabs"), "hidden from a read-only login");
});

// ---------------------------------------------------------------------------
// The tool against a real (local) database
// ---------------------------------------------------------------------------

test("update_checklist_tabs (local DB): the acceptance run", { skip }, async () => {
  const { prisma } = await import("../src/lib/db");
  const { flushEditHistory } = await import("../src/lib/edit-history/record");
  const { getEnabledTabs, excludeTalkpushTabs } = await import("../src/lib/tab-config");
  const client = await connect(await serverFor(false));
  const slug = `tabs-test-${stamp}`;
  const row = () => prisma.checklist.findUniqueOrThrow({ where: { slug } });
  const SETUP = ["enabledTabs", "tabOrder", "tabFilledBy", "version", "fieldVersions", "updatedAt", "customTabs", "customData"];
  const withoutSetup = (r: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => !SETUP.includes(k))));

  try {
    const created = await call(client, "create_checklist", { client_name: `Tabs Test ${stamp}` });
    assert.equal(created.json!.slug, slug, created.text);
    const start = await row();
    assert.equal(start.tabOrder, null);

    // 1. Only Welcome. Nothing else about the checklist changes.
    const first = await call(client, "update_checklist_tabs", { slug, enabled_tabs: ["welcome"] });
    assert.equal(first.isError, false, first.text);
    assert.equal(first.json!.result, "updated");
    assert.deepEqual(first.json!.tabsOnNow, ["welcome"]);
    assert.equal(first.json!.tabsOnBefore.length, 20);
    assert.equal(first.json!.turnedOff.length, 19);
    const afterFirst = await row();
    assert.deepEqual(afterFirst.enabledTabs, ["welcome"]);
    assert.equal(afterFirst.version, start.version + 1);
    assert.equal((afterFirst.fieldVersions as Record<string, number>).enabledTabs, afterFirst.version);
    assert.equal(withoutSetup(afterFirst as never), withoutSetup(start as never), "no tab's content was touched");
    const got = await call(client, "get_checklist", { slug });
    assert.deepEqual(got.json!.enabledTabs, ["welcome"]);

    // The sidebar for an editor link and a client link shows only Welcome.
    assert.deepEqual(getEnabledTabs(afterFirst.enabledTabs as string[], false, null, null).map((t) => t.slug), ["welcome"]);

    // 2. A custom tab still appears and is fillable.
    const added = await call(client, "add_custom_tab", { slug, tab_name: "Messenger Chatbot", columns: [{ label: "Question", type: "text" }] });
    assert.equal(added.isError, false, added.text);
    const afterAdd = await row();
    assert.deepEqual(afterAdd.enabledTabs, ["welcome"]);
    const sidebar = getEnabledTabs(afterAdd.enabledTabs as string[], false, afterAdd.tabOrder as string[] | null, afterAdd.customTabs as never, afterAdd.tabFilledBy as never);
    assert.deepEqual(sidebar.map((t) => t.slug), ["welcome", "custom-messenger-chatbot"]);
    assert.deepEqual(excludeTalkpushTabs(sidebar).map((t) => t.slug), ["welcome", "custom-messenger-chatbot"], "the client sees both");
    const tabId = (afterAdd.customTabs as unknown as { id: string }[])[0].id;
    const rows = await call(client, "edit_custom_tab_rows", { slug, tab_id: tabId, mode: "append", rows: [{ question: "Hello?" }] });
    assert.equal(rows.isError, false, rows.text);
    // Updating the tabs does not touch the custom tab unless it is named.
    const customBefore = JSON.stringify((await row()).customTabs);
    const customDataBefore = JSON.stringify((await row()).customData);

    // 3. Messaging back on: the default templates are still there.
    const back = await call(client, "update_checklist_tabs", { slug, enabled_tabs: ["welcome", "messaging"] });
    assert.equal(back.isError, false, back.text);
    assert.deepEqual(back.json!.turnedOn, ["messaging"]);
    const afterBack = await row();
    assert.deepEqual(afterBack.enabledTabs, ["welcome", "messaging"]);
    assert.deepEqual(afterBack.messaging, start.messaging, "the messaging templates were kept");
    assert.equal(JSON.stringify(afterBack.customTabs), customBefore);
    assert.equal(JSON.stringify(afterBack.customData), customDataBefore);

    // 4. An unknown name: the error lists the valid names and nothing changes.
    const versionBefore = (await row()).version;
    const bad = await call(client, "update_checklist_tabs", { slug, enabled_tabs: ["welcome", "messenger"] });
    assert.equal(bad.isError, true);
    assert.match(bad.text, /"messenger" is not a tab name/);
    for (const s of ALL) assert.ok(bad.text.includes(s), `lists ${s}`);
    assert.equal((await row()).version, versionBefore);

    // 5. The same input twice: the second changes nothing, not even the version.
    const settled = await row();
    const twice = await call(client, "update_checklist_tabs", { slug, enabled_tabs: ["messaging", "welcome"] });
    assert.equal(twice.isError, false, twice.text);
    assert.equal(twice.json!.result, "no_change");
    assert.equal(twice.json!.version, undefined);
    const afterTwice = await row();
    assert.equal(afterTwice.version, settled.version);
    assert.equal(afterTwice.updatedAt.getTime(), settled.updatedAt.getTime());

    // 6. Order and who fills a tab in, on a standard and a custom tab.
    const arranged = await call(client, "update_checklist_tabs", {
      slug,
      enabled_tabs: ["welcome", "messaging"],
      tab_order: ["welcome", "custom-messenger-chatbot", "messaging"],
      filled_by: { messaging: "talkpush", "custom-messenger-chatbot": "talkpush" },
    });
    assert.equal(arranged.isError, false, arranged.text);
    assert.equal(arranged.json!.result, "updated");
    const afterArranged = await row();
    assert.deepEqual((afterArranged.tabFilledBy as Record<string, string>).messaging, "talkpush");
    assert.deepEqual((afterArranged.tabFilledBy as Record<string, string>)["custom-messenger-chatbot"], "talkpush");
    assert.deepEqual((afterArranged.tabOrder as string[]).slice(0, 3), ["welcome", "custom-messenger-chatbot", "messaging"]);
    const clientTabs = excludeTalkpushTabs(
      getEnabledTabs(afterArranged.enabledTabs as string[], false, afterArranged.tabOrder as string[], afterArranged.customTabs as never, afterArranged.tabFilledBy as never)
    );
    assert.deepEqual(clientTabs.map((t) => t.slug), ["welcome"], "a client link now shows only Welcome");
    assert.equal(afterArranged.messaging !== null, true);

    // 7. Every change is in the History as Claude.
    await flushEditHistory();
    const events = await prisma.checklistEditEvent.findMany({ where: { checklistId: afterArranged.id }, orderBy: { createdAt: "asc" } });
    const summaries = events.filter((e) => e.actorType === "mcp").map((e) => e.summary);
    assert.ok(summaries.includes("Changed which tabs are turned on"), summaries.join(" | "));
    assert.ok(summaries.includes("Changed the order of the tabs"));
    assert.ok(summaries.includes("Changed who fills in which tab"));
    assert.equal(events.some((e) => e.tabKey === "enabledTabs" && e.actorName === "Claude (MCP)"), true);

    // 8. Archived checklists are not edited; a bad slug is a plain message.
    await prisma.checklist.update({ where: { slug }, data: { archivedAt: new Date("2026-01-01T00:00:00Z") } });
    const archived = await call(client, "update_checklist_tabs", { slug, enabled_tabs: ["welcome"] });
    assert.equal(archived.isError, true);
    assert.match(archived.text, /is archived, so nothing was changed/);
    const missing = await call(client, "update_checklist_tabs", { slug: `no-such-${stamp}`, enabled_tabs: ["welcome"] });
    assert.equal(missing.isError, true);
    assert.match(missing.text, /No checklist with the slug/);
  } finally {
    await prisma.checklist.deleteMany({ where: { slug } });
    await prisma.$disconnect();
  }
});
