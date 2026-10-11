import test from "node:test";
import assert from "node:assert/strict";
import { MERGE_AT, entriesFromChecklistEvents, type ChecklistEventRow } from "../src/lib/activity-digest/checklist-events";
import { summariseArea } from "../src/lib/activity-digest/describe";
import { buildActivityDigestEmail } from "../src/lib/activity-digest/digest-email";
import { parseSlotDate } from "../src/lib/activity-digest/window";

const ME = "jolo.yu@talkpush.com";
const CL = { id: "c1", clientName: "Example Harbor" };
let n = 0;
function row(over: Partial<ChecklistEventRow> = {}): ChecklistEventRow {
  n += 1;
  return { actorType: "admin", actorName: "roy.santos@talkpush.com", tabKey: "sites", tabLabel: "Sites", changeType: "added", summary: 'Added "Pilot site"', updatedAt: new Date(Date.UTC(2026, 9, 7, 1, n)), checklist: CL, ...over };
}
const lines = (rows: ChecklistEventRow[]) => summariseArea("checklist", entriesFromChecklistEvents(rows), ME).groups.flatMap((g) => g.items);

test("a staff change reads as a sentence with the person's name and the tab", () => {
  assert.deepEqual(lines([row()]), ['Roy Santos added "Pilot site" in Sites']);
});

test("who did it: staff by name, Claude, a named client link, and the two unnamed shared links", () => {
  const out = lines([
    row({ summary: "Changed Email (value not recorded)", tabLabel: "Users", tabKey: "users", actorType: "mcp", actorName: "Claude (MCP)" }),
    row({ summary: "Changed Phone (value not recorded)", tabLabel: "Users", tabKey: "users2", actorType: "link", actorName: "Jane Cruz (TP)" }),
    row({ summary: "Changed Fax (value not recorded)", tabLabel: "Users", tabKey: "users3", actorType: "legacy_link", actorName: "Original shared link (unnamed)" }),
    row({ summary: "Changed Pager (value not recorded)", tabLabel: "Users", tabKey: "users4", actorType: "slug", actorName: "Client form link (unnamed)" }),
  ]);
  assert.ok(out.includes("Claude (MCP) changed Email (value not recorded) in Users"));
  assert.ok(out.includes("Jane Cruz (TP) changed Phone (value not recorded) in Users"));
  assert.ok(out.includes("Someone using the shared link changed Fax (value not recorded) in Users"));
  assert.ok(out.includes("Someone using the client form link changed Pager (value not recorded) in Users"));
});

test("your own changes say You", () => {
  assert.deepEqual(lines([row({ actorName: ME })]), ['You added "Pilot site" in Sites']);
});

test("'checked' lines (a save that looked and changed nothing) are never changes", () => {
  assert.deepEqual(lines([row({ changeType: "checked", summary: "No change" })]), []);
  assert.equal(summariseArea("checklist", entriesFromChecklistEvents([row({ changeType: "checked", summary: "No change" })]), ME).total, 0);
});

test("three or more changes by one person in one tab become one line, and the count stays true", () => {
  const many = Array.from({ length: MERGE_AT + 2 }, (_, i) => row({ summary: `Added "Site ${i}"` }));
  const s = summariseArea("checklist", entriesFromChecklistEvents(many), ME);
  assert.deepEqual(s.groups[0].items, ["Roy Santos made 5 changes in Sites"]);
  assert.equal(s.total, 5);
});

test("two changes stay as two detailed lines, newest first", () => {
  const out = lines([row({ summary: 'Added "A"' }), row({ summary: 'Added "B"' })]);
  assert.deepEqual(out, ['Roy Santos added "B" in Sites', 'Roy Santos added "A" in Sites']);
});

test("different people or different tabs are not merged together", () => {
  const rows = [
    ...Array.from({ length: 3 }, () => row({ actorName: "a@talkpush.com" })),
    ...Array.from({ length: 3 }, () => row({ actorName: "b@talkpush.com" })),
    ...Array.from({ length: 3 }, () => row({ tabKey: "users", tabLabel: "Users" })),
  ];
  const out = lines(rows).sort();
  assert.deepEqual(out, ["A made 3 changes in Sites", "B made 3 changes in Sites", "Roy Santos made 3 changes in Users"]);
});

test("a whole-checklist line does not say 'in Whole checklist', and a summary that already names the tab is not repeated", () => {
  assert.deepEqual(lines([row({ tabKey: "document", tabLabel: "Whole checklist", changeType: "system", summary: "Saved the whole checklist at once (12 sections; changes are not itemised)" })]), [
    "Roy Santos saved the whole checklist at once (12 sections; changes are not itemised)",
  ]);
  assert.deepEqual(lines([row({ summary: 'Created the tab "Sites"' })]), ['Roy Santos created the tab "Sites"']);
});

test("summaries that start with a capitalised word or acronym are left readable", () => {
  assert.deepEqual(lines([row({ summary: "AI call script changed", tabKey: "x", tabLabel: "Scripts" })]), ["Roy Santos AI call script changed in Scripts"]);
});

test("changes are grouped per checklist and link to its staff page, with the checklist name", () => {
  const rows = [row(), row({ checklist: { id: "c2", clientName: "Acme PH" } })];
  const s = summariseArea("checklist", entriesFromChecklistEvents(rows), ME);
  assert.deepEqual(s.groups.map((g) => g.title).sort(), ["Acme PH", "Example Harbor"]);
  assert.ok(s.groups.every((g) => g.path.startsWith("/admin/checklists/")));
});

test("links and token-looking text in a summary never reach the email", () => {
  const rows = [row({ summary: 'Added "https://secret.example.com/t/abcdef0123456789abcdef0123"' })];
  const email = buildActivityDigestEmail({ areas: [summariseArea("checklist", entriesFromChecklistEvents(rows), ME)], failedAreas: [], notes: [], slot: parseSlotDate("2026-10-08"), appBaseUrl: "https://crmconfig.talkpush.com" });
  assert.doesNotMatch(email.text, /secret\.example|abcdef0123456789/);
  assert.match(email.text, /\[link removed\]/);
});

test("the digest no longer carries the old 'checklist edits are not included yet' note", () => {
  const email = buildActivityDigestEmail({ areas: [summariseArea("checklist", entriesFromChecklistEvents([row()]), ME)], failedAreas: [], notes: [], slot: parseSlotDate("2026-10-08"), appBaseUrl: "" });
  assert.doesNotMatch(email.text, /not included yet/);
  assert.match(email.text, /Checklists: 1 change/);
});
