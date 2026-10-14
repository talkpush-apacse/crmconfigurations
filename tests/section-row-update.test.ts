import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  applyRowPatches,
  EDITABLE_ROW_FIELDS,
  EDITABLE_SECTIONS,
  MAX_ROWS_PER_CALL,
  RowUpdateError,
} from "../src/lib/mcp/section-row-update";
import { CHECKLIST_READ_TOOLS } from "../src/lib/mcp/checklist-read-tools";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

const sites = (): Json[] => [
  { id: "s1", siteName: "BGC Tower 1", internalName: "BGC1", interviewHours: "9am-5pm", comments: "keep me" },
  { id: "s2", siteName: "Makati", internalName: "MKT", interviewHours: "10am-6pm", comments: "" },
  { id: "s3", siteName: "Cebu", internalName: "CEB", interviewHours: "9am-5pm", comments: "", deletedAt: "2026-01-01T00:00:00.000Z" },
];

test("a patch changes only the named fields of the named rows and keeps order and every other row", () => {
  const before = sites();
  const { rows, changes } = applyRowPatches("sites", before, [{ id: "s2", interviewHours: "8am-4pm" }]);
  assert.deepEqual(rows.map((r) => r.id), ["s1", "s2", "s3"]);
  assert.deepEqual(rows[1], { ...before[1], interviewHours: "8am-4pm" });
  assert.deepEqual(rows[0], before[0], "an untouched row is identical");
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0].changes, [{ field: "interviewHours", from: "10am-6pm", to: "8am-4pm" }]);
  assert.equal(changes[0].label, "Makati");
});

test("many rows in one call, each with its own fields", () => {
  const { rows, changes } = applyRowPatches("sites", sites(), [
    { id: "s1", interviewHours: "7am-3pm", comments: "" },
    { id: "s2", interviewHours: "7am-3pm" },
  ]);
  assert.equal(rows[0].interviewHours, "7am-3pm");
  assert.equal(rows[0].comments, "", "an empty string is a real change, not 'leave alone'");
  assert.equal(rows[1].interviewHours, "7am-3pm");
  assert.equal(changes.filter((c) => !c.unchanged).length, 2);
});

test("sending the value a row already has is reported as unchanged", () => {
  const { rows, changes } = applyRowPatches("sites", sites(), [{ id: "s1", interviewHours: "9am-5pm" }]);
  assert.equal(changes[0].unchanged, true);
  assert.deepEqual(changes[0].changes, []);
  assert.deepEqual(rows[0], sites()[0]);
});

test("nothing is applied if any row is wrong, and every problem is listed", () => {
  const before = sites();
  const snapshot = JSON.stringify(before);
  try {
    applyRowPatches("sites", before, [
      { id: "s1", interviewHours: "ok" },
      { id: "nope", interviewHours: "x" },
      { id: "s2", hours: "x" },
      { id: "s1", interviewHours: "again" },
    ]);
    assert.fail("should have thrown");
  } catch (err) {
    assert.ok(err instanceof RowUpdateError);
    assert.equal(err.problems.length, 3, err.message);
    assert.match(err.message, /no row with id "nope"/);
    assert.match(err.message, /"hours" is not an editable field/);
    assert.match(err.message, /appears more than once/);
  }
  assert.equal(JSON.stringify(before), snapshot, "the saved rows were not touched");
});

test("id and deletedAt can never be edited; a deleted row cannot be edited", () => {
  assert.throws(() => applyRowPatches("sites", sites(), [{ id: "s1", deletedAt: null }]), /not an editable field/);
  assert.throws(() => applyRowPatches("sites", sites(), [{ id: "s3", interviewHours: "x" }]), /was deleted/);
  for (const section of EDITABLE_SECTIONS) {
    const fields = Object.keys(EDITABLE_ROW_FIELDS[section]);
    assert.ok(!fields.includes("id") && !fields.includes("deletedAt"), section);
  }
});

test("the client's own sign-off fields are not editable by Claude", () => {
  assert.ok(!("approved" in EDITABLE_ROW_FIELDS.prescreening));
  assert.ok(!("clientComments" in EDITABLE_ROW_FIELDS.prescreening));
  assert.ok(!("notApplicable" in EDITABLE_ROW_FIELDS.messaging));
});

test("values must have the right type: text, true/false, or a list of text", () => {
  const msg = [{ id: "m1", name: "Invite", emailActive: false }];
  assert.throws(() => applyRowPatches("messaging", msg, [{ id: "m1", emailActive: "yes" }]), /true or false/);
  assert.equal(applyRowPatches("messaging", msg, [{ id: "m1", emailActive: true }]).rows[0].emailActive, true);
  const camps = [{ id: "c1", nameInternal: "Manila", assignedRecruiters: ["a"] }];
  assert.throws(() => applyRowPatches("campaigns", camps, [{ id: "c1", assignedRecruiters: "a" }]), /list of text/);
  assert.deepEqual(applyRowPatches("campaigns", camps, [{ id: "c1", assignedRecruiters: ["a", "b"] }]).rows[0].assignedRecruiters, ["a", "b"]);
});

test("empty requests, missing ids, no fields, and oversize batches are refused", () => {
  assert.throws(() => applyRowPatches("sites", sites(), []), /at least one row/);
  assert.throws(() => applyRowPatches("sites", sites(), [{ id: "  " }]), /no `id`/);
  assert.throws(() => applyRowPatches("sites", sites(), [{ id: "s1" }]), /names no fields/);
  const many = Array.from({ length: MAX_ROWS_PER_CALL + 1 }, (_, i) => ({ id: `x${i}`, comments: "a" }));
  assert.throws(() => applyRowPatches("sites", sites(), many), /Too many rows/);
});

test("every field Claude can add on a section is editable, and each section is a real checklist field", () => {
  // The add_* tools set these; "anything you could add you can fix".
  const mustEdit: Record<string, string[]> = {
    sites: ["siteName", "internalName", "lobsOrAccounts", "interviewHours", "interviewType", "fullAddress", "documentsToRing", "googleMapsLink", "comments"],
    users: ["name", "accessType", "email", "phone", "jobTitle", "site", "reportsTo", "stage", "comments"],
    campaigns: ["nameInternal", "jobTitleExternal", "site", "jobDescription", "googleMapsLink", "zoomLink", "comments"],
    documents: ["documentName", "applicableCandidates", "required", "blankTemplateLink", "applicableCampaigns", "accessPermissions", "folder", "comments"],
    labels: ["name", "color"],
  };
  for (const [section, fields] of Object.entries(mustEdit)) {
    const editable = Object.keys(EDITABLE_ROW_FIELDS[section as keyof typeof EDITABLE_ROW_FIELDS]);
    for (const f of fields) assert.ok(editable.includes(f), `${section}.${f}`);
  }
});

test("update_section_rows is registered and is NOT offered to a read-only login", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../src/lib/mcp-server.ts", import.meta.url), "utf8");
  assert.match(source, /server\.tool\(\s*"update_section_rows"/);
  assert.ok(!CHECKLIST_READ_TOOLS.has("update_section_rows"), "it changes data, so it must stay off the read-only list");
});

// ---- through the real tool and a real LOCAL database ----
const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-section-row-update-tests-0123456789";
  const req = Module.createRequire(__filename);
  const resolved = req.resolve("server-only");
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: {} } as never;
}
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

test("update_section_rows (local DB): edits in place, no duplicates, all-or-nothing, version bump, history, read-only", { skip }, async () => {
  const { prisma } = await import("../src/lib/db");
  const { createMcpServer } = await import("../src/lib/mcp-server");
  const record = await import("../src/lib/edit-history/record");
  const stamp = Date.now().toString(36);
  const row = await prisma.checklist.create({
    data: { slug: `urows-${stamp}`, clientName: `Update Rows Test ${stamp}`, sites: sites() },
  });
  try {
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "1" });
    await Promise.all([createMcpServer().connect(b as never), client.connect(a)]);
    const call = async (args: Json) =>
      (await client.callTool({ name: "update_section_rows", arguments: args })) as { isError?: boolean; content: { text: string }[] };

    // Edits two rows in place.
    const ok = await call({
      slug: row.slug, section: "sites",
      rows: [{ id: "s1", interviewHours: "7am-3pm" }, { id: "s2", interviewHours: "7am-3pm" }],
    });
    assert.ok(!ok.isError, ok.content[0].text);
    assert.match(ok.content[0].text, /interviewHours: 9am-5pm -> 7am-3pm/);
    let saved = await prisma.checklist.findUniqueOrThrow({ where: { id: row.id } });
    const list = saved.sites as Json[];
    assert.equal(list.length, 3, "no duplicates were created");
    assert.equal(list[0].interviewHours, "7am-3pm");
    assert.equal(list[0].comments, "keep me", "unnamed fields are untouched");
    assert.equal(saved.version, 1);
    assert.equal((saved.fieldVersions as Json).sites, 1);

    // Recorded in the history as Claude.
    await record.flushEditHistory();
    const events = await prisma.checklistEditEvent.findMany({ where: { checklistId: row.id, actorType: "mcp" } });
    assert.ok(events.length >= 1, "history has Claude's change");
    assert.ok(events.every((e) => e.actorName === "Claude (MCP)"));

    // Same values again: nothing written, version stays.
    const same = await call({ slug: row.slug, section: "sites", rows: [{ id: "s1", interviewHours: "7am-3pm" }] });
    assert.ok(!same.isError);
    assert.match(same.content[0].text, /Nothing to change/);
    saved = await prisma.checklist.findUniqueOrThrow({ where: { id: row.id } });
    assert.equal(saved.version, 1);

    // One bad row: nothing at all is saved.
    const bad = await call({
      slug: row.slug, section: "sites",
      rows: [{ id: "s1", interviewHours: "SHOULD NOT SAVE" }, { id: "missing", interviewHours: "x" }],
    });
    assert.equal(bad.isError, true);
    assert.match(bad.content[0].text, /no row with id "missing"/);
    saved = await prisma.checklist.findUniqueOrThrow({ where: { id: row.id } });
    assert.equal((saved.sites as Json[])[0].interviewHours, "7am-3pm");
    assert.equal(saved.version, 1);

    // Unknown checklist.
    const none = await call({ slug: `nope-${stamp}`, section: "sites", rows: [{ id: "s1", comments: "x" }] });
    assert.equal(none.isError, true);
    assert.match(none.content[0].text, /not found/);

    // A read-only connection is not offered the tool.
    const [c, d] = InMemoryTransport.createLinkedPair();
    const ro = new Client({ name: "ro", version: "1" });
    await Promise.all([createMcpServer({ readOnly: true }).connect(d as never), ro.connect(c)]);
    const names = (await ro.listTools()).tools.map((t) => t.name);
    assert.ok(!names.includes("update_section_rows"));
    assert.ok(names.includes("get_section"));
  } finally {
    await new Promise((r) => setTimeout(r, 300));
    await prisma.checklist.deleteMany({ where: { id: row.id } });
    await prisma.$disconnect();
  }
});
