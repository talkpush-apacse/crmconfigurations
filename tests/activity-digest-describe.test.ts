import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_GROUPS_PER_AREA,
  MAX_ITEMS_PER_GROUP,
  describeTrackerChange,
  describeWorkflowChange,
  friendlyActor,
  isDigestWorkflowAction,
  scrubSecrets,
  summariseArea,
} from "../src/lib/activity-digest/describe";
import type { DigestEntry } from "../src/lib/activity-digest/types";

const ME = "jolo.yu@talkpush.com";
const at = (minutes: number) => new Date(Date.UTC(2026, 9, 7, 1, minutes));

function entry(over: Partial<DigestEntry> = {}): DigestEntry {
  return { area: "tracker", groupId: "p1", groupTitle: "Concentrix PH, Implementation", groupPath: "/admin/tracker/projects/p1", at: at(0), actor: "roy.santos@talkpush.com", text: 'moved "Set up SSO" from In progress to Done', ...over };
}

test("names: you, a staff email turned into a name, and other labels left alone", () => {
  assert.equal(friendlyActor("jolo.yu@talkpush.com", ME), "You");
  assert.equal(friendlyActor("  JOLO.YU@talkpush.com ", ME), "You");
  assert.equal(friendlyActor("aristotle.ocampo@talkpush.com", ME), "Aristotle Ocampo");
  assert.equal(friendlyActor("Claude (MCP)", ME), "Claude (MCP)");
  assert.equal(friendlyActor("Maria Santos", ME), "Maria Santos");
  assert.equal(friendlyActor(null, ME), "");
});

test("tracker changes read as plain sentences", () => {
  assert.equal(
    describeTrackerChange({ action: "item.status_changed", before: { title: "Set up SSO", status: "in_progress" }, after: { status: "done" } }).text,
    'moved "Set up SSO" from In progress to Done'
  );
  assert.equal(describeTrackerChange({ action: "item.created", before: null, after: { title: "Review questions", status: "not_started" } }).text, 'added "Review questions"');
  assert.match(describeTrackerChange({ action: "file.added", before: null, after: { fileName: "Contract.pdf", kind: "contract" } }).text, /Contract\.pdf/);
  assert.equal(
    describeTrackerChange({ action: "project.plan_applied", before: null, after: { created: 3, restored: 0, archived: 2, kept: 9 } }).text,
    "applied the standard plan (3 added, 2 archived)"
  );
});

test("a remark shows a short quote of what was said", () => {
  const long = "x".repeat(300);
  const t = describeTrackerChange({ action: "remark.added", before: null, after: { itemId: "i1", visibility: "internal" }, entityTitle: "Go-live", remarkBody: long }).text;
  assert.match(t, /team-only remark on "Go-live": "x+\.\.\."$/);
  assert.ok(t.length < 200);
});

test("workflow: only real changes are listed; opens, sign-ins and reads are not", () => {
  for (const a of ["canvas.edited", "version.published", "suggestion.created", "member.invited", "link.disabled", "access.settings_changed", "access.requested", "mcp.add_node", "mcp.set_diagram_style"]) {
    assert.equal(isDigestWorkflowAction(a), true, a);
  }
  for (const a of ["link.opened", "guest.identified", "suggestion.withdrawn", "suggestion.stale", "comment.created", "something.new"]) {
    assert.equal(isDigestWorkflowAction(a), false, a);
  }
  assert.equal(describeWorkflowChange("version.published", {}).text, "published a version");
  assert.equal(describeWorkflowChange("mcp.add_node", {}).collapseKey, "mcp");
});

test("many diagram edits by one person become one line with a count", () => {
  const entries = Array.from({ length: 14 }, (_, i) => entry({ area: "workflow", groupId: "w1", groupTitle: "Hiring flow", at: at(i), text: "edited the diagram", collapseKey: "canvas.edited" }));
  const s = summariseArea("workflow", entries, ME);
  assert.equal(s.total, 14);
  assert.deepEqual(s.groups[0].items, ["Roy Santos edited the diagram 14 times"]);
});

test("Claude's tool changes collapse, and a single one reads naturally", () => {
  const many = Array.from({ length: 12 }, (_, i) => entry({ area: "workflow", groupId: "w1", actor: "Claude (MCP)", at: at(i), text: "made a change", collapseKey: "mcp" }));
  assert.deepEqual(summariseArea("workflow", many, ME).groups[0].items, ["Claude (MCP) made 12 changes"]);
  assert.deepEqual(summariseArea("workflow", many.slice(0, 1), ME).groups[0].items, ["Claude (MCP) made a change"]);
});

test("the same line twice is merged, different people stay separate, and your own changes say You", () => {
  const e = [entry({ at: at(1) }), entry({ at: at(2) }), entry({ at: at(3), actor: ME, text: 'added "Review questions"' }), entry({ at: at(4), actor: "maria@acme.com", text: 'added "Review questions"' })];
  const items = summariseArea("tracker", e, ME).groups[0].items;
  // newest first: Maria (4), You (3), then Roy's two merged lines (last at 2)
  assert.deepEqual(items, [
    'Maria added "Review questions"',
    'You added "Review questions"',
    'Roy Santos moved "Set up SSO" from In progress to Done (2 times)',
  ]);
});

test("an entry with no known person reads as a plain sentence", () => {
  const items = summariseArea("checklist", [entry({ area: "checklist", actor: null, text: "created the checklist" })], ME).groups[0].items;
  assert.deepEqual(items, ["Created the checklist"]);
});

test("caps: five lines per group with an 'and more' count, ten groups per area, totals stay true", () => {
  const six = Array.from({ length: 8 }, (_, i) => entry({ at: at(i), text: `did thing number ${i}` }));
  const g = summariseArea("tracker", six, ME).groups[0];
  assert.equal(g.items.length, MAX_ITEMS_PER_GROUP);
  assert.equal(g.more, 3);

  const manyProjects = Array.from({ length: 14 }, (_, i) => entry({ groupId: `p${i}`, groupTitle: `Project ${String(i).padStart(2, "0")}` }));
  const s = summariseArea("tracker", manyProjects, ME);
  assert.equal(s.groups.length, MAX_GROUPS_PER_AREA);
  assert.equal(s.hiddenGroups, 4);
  assert.equal(s.total, 14);
});

test("when a group is long, the newest changes are shown and the oldest fold into 'and more'", () => {
  const e = Array.from({ length: 7 }, (_, i) => entry({ at: at(i), text: `did thing ${i}` }));
  const g = summariseArea("tracker", e, ME).groups[0];
  assert.deepEqual(g.items, ["Roy Santos did thing 6", "Roy Santos did thing 5", "Roy Santos did thing 4", "Roy Santos did thing 3", "Roy Santos did thing 2"]);
  assert.equal(g.more, 2);
});

test("busiest group first, then alphabetical", () => {
  const e = [entry({ groupId: "a", groupTitle: "Zeta" }), entry({ groupId: "b", groupTitle: "Alpha" }), entry({ groupId: "b", groupTitle: "Alpha", at: at(5), text: "x" }), entry({ groupId: "c", groupTitle: "Beta" })];
  assert.deepEqual(summariseArea("tracker", e, ME).groups.map((g) => g.title), ["Alpha", "Beta", "Zeta"]);
});

test("links and token-looking strings never reach the output", () => {
  assert.equal(scrubSecrets("see https://crm.example.com/share/abc123 now"), "see [link removed] now");
  assert.equal(scrubSecrets('created a link ("Client view https://x.test/s/zz")'), 'created a link ("Client view [link removed]")');
  assert.equal(scrubSecrets("key sk_live_51Hh8aBcDeFgHiJkLmNoPq2 end"), "key [removed] end");
  assert.equal(scrubSecrets("Review the prescreening questions"), "Review the prescreening questions");
  const e = entry({ text: 'added "Docs https://secret.example.com/t/9f8e7d6c5b4a3210fedcba98" and 0123456789abcdef0123456789abcdef' });
  const items = summariseArea("tracker", [e], ME).groups[0].items.join(" ");
  assert.doesNotMatch(items, /https?:/);
  assert.doesNotMatch(items, /secret\.example|0123456789abcdef/);
});

test("raw before/after data is never printed: a changed list of links shows only the field name", () => {
  const t = describeTrackerChange({
    action: "item.updated",
    entityTitle: "Kickoff",
    before: { title: "Kickoff", links: ["https://old.example.com/x"] },
    after: { links: ["https://new.example.com/y?token=abcdef0123456789abcdef0123"] },
  }).text;
  assert.doesNotMatch(t, /https?:|token=/);
});

test("no sentence is longer than the cap, and none contains an em dash we wrote", () => {
  const e = entry({ text: "did " + "a very long thing ".repeat(40) });
  const items = summariseArea("tracker", [e], ME).groups[0].items;
  assert.ok(items[0].length <= 223);
  for (const t of ["canvas.edited", "version.published", "access.requested"]) assert.ok(!describeWorkflowChange(t, {}).text.includes("—"));
});
