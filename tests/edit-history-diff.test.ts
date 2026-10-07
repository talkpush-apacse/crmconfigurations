import test from "node:test";
import assert from "node:assert/strict";
import { diffChecklistFields, humanise, isSensitiveKey, systemEvent, wholeDocumentEvent } from "../src/lib/edit-history/diff";
import { MAX_VALUE_CHARS } from "../src/lib/edit-history/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const run = (before: any, after: any, fields: string[]) => diffChecklistFields({ before, after, fields });

test("nothing changed means no events, and empty-to-empty is not a change", () => {
  assert.deepEqual(run({ companyInfo: { companyName: "Acme" } }, { companyInfo: { companyName: "Acme" } }, ["companyInfo"]), []);
  assert.deepEqual(run({ companyInfo: null }, { companyInfo: { companyName: "", fbPageId: "  " } }, ["companyInfo"]), []);
  assert.deepEqual(run({ users: [] }, { users: null }, ["users"]), []);
});

test("a cell edit in a row tab names the row and the column", () => {
  const before = { users: [{ id: "u1", name: "Jane Cruz", email: "j@x.com" }, { id: "u2", name: "Bo", email: "b@x.com" }] };
  const after = { users: [{ id: "u1", name: "Jane Cruz", email: "jane@x.com" }, { id: "u2", name: "Bo", email: "b@x.com" }] };
  const [e, ...rest] = run(before, after, ["users"]);
  assert.equal(rest.length, 0);
  assert.equal(e.tabKey, "users");
  assert.equal(e.tabLabel, "User List");
  assert.equal(e.rowId, "u1");
  assert.equal(e.rowLabel, "Jane Cruz");
  assert.equal(e.fieldKey, "email");
  assert.equal(e.fieldLabel, "Email");
  assert.equal(e.changeType, "edited");
  assert.equal(e.before, "j@x.com");
  assert.equal(e.after, "jane@x.com");
  assert.equal(e.subject, "users|u1|email|edited");
});

test("plain-object tabs record one line per changed field", () => {
  const e = run({ companyInfo: { companyName: "Acme", companyAddress: "1 Rd" } }, { companyInfo: { companyName: "Acme Inc", companyAddress: "1 Rd" } }, ["companyInfo"]);
  assert.equal(e.length, 1);
  assert.equal(e[0].fieldKey, "companyName");
  assert.equal(e[0].fieldLabel, "Companyname".length ? humanise("companyName") : "");
  assert.equal(e[0].rowId, null);
});

test("added, deleted, soft-deleted and restored rows are not logged as cell edits", () => {
  const rows = (...r: any[]) => ({ sites: r });
  const added = run(rows({ id: "a", name: "HQ" }), rows({ id: "a", name: "HQ" }, { id: "b", name: "Branch" }), ["sites"]);
  assert.deepEqual(added.map((e) => [e.changeType, e.rowLabel]), [["added", "Branch"]]);

  const removed = run(rows({ id: "a", name: "HQ" }, { id: "b", name: "Branch" }), rows({ id: "a", name: "HQ" }), ["sites"]);
  assert.deepEqual(removed.map((e) => [e.changeType, e.rowLabel]), [["deleted", "Branch"]]);

  const soft = run(rows({ id: "a", name: "HQ" }), rows({ id: "a", name: "HQ renamed", deletedAt: "2026-10-07T00:00:00Z" }), ["sites"]);
  assert.deepEqual(soft.map((e) => [e.changeType, e.rowLabel]), [["deleted", "HQ"]]);

  const restored = run(rows({ id: "a", name: "HQ", deletedAt: "2026-10-07T00:00:00Z" }), rows({ id: "a", name: "HQ", deletedAt: null }), ["sites"]);
  assert.deepEqual(restored.map((e) => [e.changeType, e.rowLabel]), [["restored", "HQ"]]);
});

test("moving a row is one 'reordered' line; adding a row is not also a reorder", () => {
  const a = { id: "1", name: "A" }, b = { id: "2", name: "B" }, c = { id: "3", name: "C" };
  const moved = run({ sites: [a, b, c] }, { sites: [c, a, b] }, ["sites"]);
  assert.deepEqual(moved.map((e) => e.changeType), ["reordered"]);
  const addedFirst = run({ sites: [a, b] }, { sites: [{ id: "9", name: "New" }, a, b] }, ["sites"]);
  assert.deepEqual(addedFirst.map((e) => e.changeType), ["added"]);
});

test("AI Call: scalar fields and nested faq rows are both itemised", () => {
  const before = { aiCallFaqs: { agentName: "Mia", interviewQuestions: "Q1", faqs: [{ id: "f1", faq: "Hours?", example: "", faqResponse: "9-5" }] } };
  const after = { aiCallFaqs: { agentName: "Mia", interviewQuestions: "Q1\nQ2", faqs: [{ id: "f1", faq: "Hours?", example: "", faqResponse: "9-6" }] } };
  const ev = run(before, after, ["aiCallFaqs"]);
  assert.equal(ev.length, 2);
  const scalar = ev.find((e) => e.fieldKey === "interviewQuestions")!;
  assert.equal(scalar.tabLabel, "AI Call");
  assert.equal(scalar.after, "Q1\nQ2");
  const faq = ev.find((e) => e.rowId === "f1")!;
  assert.equal(faq.rowLabel, "Hours?");
  assert.equal(faq.fieldKey, "faqs.faqResponse");
  assert.equal(faq.fieldLabel, "Faq response");
});

test("a list of plain strings records what was added and removed", () => {
  const ev = run({ rejectionReasons: ["No show", "Too far"] }, { rejectionReasons: ["No show", "Salary"] }, ["rejectionReasons"]);
  assert.deepEqual(ev.map((e) => [e.changeType, e.rowLabel]).sort(), [["added", "Salary"], ["deleted", "Too far"]]);
  const reorder = run({ rejectionReasons: ["a", "b"] }, { rejectionReasons: ["b", "a"] }, ["rejectionReasons"]);
  assert.deepEqual(reorder.map((e) => e.changeType), ["reordered"]);
});

test("passwords and secrets never reach the history", () => {
  const ev = run(
    { adminSettings: { tecolocoPassword: "old-secret", tecolocoUsername: "bob" } },
    { adminSettings: { tecolocoPassword: "new-secret", tecolocoUsername: "bob" } },
    ["adminSettings", "users"]
  );
  assert.equal(ev.length, 1);
  assert.equal(ev[0].changeType, "setup");
  assert.equal(JSON.stringify(ev).includes("secret"), false);
  assert.equal(ev[0].before, undefined);

  const cell = run(
    { users: [{ id: "u", name: "Bo", apiKey: "k1" }] },
    { users: [{ id: "u", name: "Bo", apiKey: "k2" }] },
    ["users"]
  );
  assert.equal(cell.length, 1);
  assert.equal(cell[0].truncated, true);
  assert.equal(JSON.stringify(cell).includes("k1"), false);
  assert.equal(JSON.stringify(cell).includes("k2"), false);

  const added = run({ users: [] }, { users: [{ id: "u", name: "Bo", password: "hunter2" }] }, ["users"]);
  assert.equal(JSON.stringify(added).includes("hunter2"), false);
  assert.equal(isSensitiveKey("elevenLabsWebhookSecret"), true);
  assert.equal(isSensitiveKey("companyName"), false);
});

test("custom table tab: labels come from the tab's own columns, in the tab's order", () => {
  const tab = (rows: any[], extra: any = {}) => ({
    id: "t1", slug: "call-scripts", label: "AI Call Scripts", icon: "FileText", fields: [], mode: "table",
    columns: [
      { key: "zeta_name", label: "Script name", type: "text" },
      { key: "alpha_script", label: "Call Script", type: "textarea" },
    ],
    rows, ...extra,
  });
  const before = { customTabs: [tab([{ id: "r1", alpha_script: "Hello", zeta_name: "Scheduling" }])] };
  const after = { customTabs: [tab([{ id: "r1", alpha_script: "Hello there", zeta_name: "Scheduling" }])] };
  const ev = run(before, after, ["customTabs"]);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].tabKey, "custom-call-scripts");
  assert.equal(ev[0].tabLabel, "AI Call Scripts");
  assert.equal(ev[0].rowLabel, "Scheduling");
  assert.equal(ev[0].fieldLabel, "Call Script");
  assert.equal(ev[0].before, "Hello");
  assert.equal(ev[0].after, "Hello there");
});

test("custom tabs: created, renamed, deleted and setup changes are single lines", () => {
  const t = (over: any = {}) => ({ id: "t1", slug: "x", label: "X", icon: "i", fields: [], mode: "table", columns: [{ key: "a", label: "A", type: "text" }], rows: [], ...over });
  assert.deepEqual(run({ customTabs: [] }, { customTabs: [t()] }, ["customTabs"]).map((e) => e.changeType), ["added"]);
  assert.deepEqual(run({ customTabs: [t()] }, { customTabs: [] }, ["customTabs"]).map((e) => e.changeType), ["deleted"]);
  const renamed = run({ customTabs: [t()] }, { customTabs: [t({ label: "Y" })] }, ["customTabs"]);
  assert.equal(renamed[0].changeType, "setup");
  assert.match(renamed[0].summary, /Renamed the tab "X" to "Y"/);
  const setup = run({ customTabs: [t()] }, { customTabs: [t({ columns: [{ key: "a", label: "A", type: "text" }, { key: "b", label: "B", type: "text" }] })] }, ["customTabs"]);
  assert.deepEqual(setup.map((e) => e.changeType), ["setup"]);
  // Only the rows moved or changed: the tab setup is untouched.
  const onlyRows = run({ customTabs: [t()] }, { customTabs: [t({ rows: [{ id: "r", a: "v" }] })] }, ["customTabs"]);
  assert.deepEqual(onlyRows.map((e) => e.changeType), ["added"]);
});

test("form values in customData are labelled from the tab's fields", () => {
  const tabs = [{ id: "t9", slug: "intake", label: "Intake", icon: "i", fields: [{ id: "f1", key: "headcount", label: "Expected headcount", type: "number", required: false }] }];
  const before = { customTabs: tabs, customData: { t9: { values: { headcount: 10 }, updatedAt: "x" } } };
  const after = { customData: { t9: { values: { headcount: 25 }, updatedAt: "y" } } };
  const ev = run(before, after, ["customData"]);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].tabLabel, "Intake");
  assert.equal(ev[0].fieldLabel, "Expected headcount");
  assert.equal(ev[0].before, 10);
  assert.equal(ev[0].after, 25);
});

test("an uploaded file keeps its name only, never its address", () => {
  const ev = run({ customData: {} }, { customData: { logo: { url: "https://store/secret/path.png", name: "logo.png", uploadedAt: "x" } } }, ["customData"]);
  assert.equal(ev.length, 1);
  assert.deepEqual(ev[0].after, { name: "logo.png" });
  assert.equal(JSON.stringify(ev).includes("https://"), false);
});

test("a big paste or CSV import collapses into one 'replaced' line", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, name: `Person ${i}`, email: `p${i}@x.com` }));
  const ev = run({ users: [] }, { users: many }, ["users"]);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].changeType, "replaced");
  assert.match(ev[0].summary, /40 items in User List/);
});

test("long text is cut at the limit and flagged", () => {
  const long = "x".repeat(MAX_VALUE_CHARS + 500);
  const ev = run({ aiCallFaqs: { interviewQuestions: "" } }, { aiCallFaqs: { interviewQuestions: long } }, ["aiCallFaqs"]);
  assert.equal((ev[0].after as string).length, MAX_VALUE_CHARS);
  assert.equal(ev[0].truncated, true);
  // A 4 KB call script is kept whole.
  const script = "y".repeat(4000);
  const ok = run({ aiCallFaqs: { interviewQuestions: "" } }, { aiCallFaqs: { interviewQuestions: script } }, ["aiCallFaqs"]);
  assert.equal(ok[0].after, script);
  assert.equal(ok[0].truncated, false);
});

test("attachments and setup fields are one line without values", () => {
  const files = run({ tabUploadMeta: {} }, { tabUploadMeta: { users: { uploadedFiles: [{ name: "a.xlsx", url: "https://s/a" }], isSkipped: false } } }, ["tabUploadMeta"]);
  assert.equal(files.length, 1);
  assert.equal(files[0].changeType, "file");
  assert.equal(files[0].tabKey, "users");
  assert.equal(JSON.stringify(files).includes("a.xlsx"), false);
  const setup = run({ enabledTabs: ["users"] }, { enabledTabs: ["users", "sites"] }, ["enabledTabs"]);
  assert.equal(setup[0].changeType, "setup");
  assert.equal(setup[0].after, undefined);
});

test("only the fields named in this save are looked at", () => {
  const ev = run({ users: [{ id: "a", name: "A" }], sites: [] }, { users: [{ id: "a", name: "B" }], sites: [{ id: "s", name: "S" }] }, ["sites"]);
  assert.deepEqual(ev.map((e) => e.tabKey), ["sites"]);
});

test("coarse helpers", () => {
  const w = wholeDocumentEvent(12);
  assert.equal(w.changeType, "replaced");
  assert.match(w.summary, /12 sections/);
  const s = systemEvent("Restored a snapshot");
  assert.equal(s.changeType, "system");
});
