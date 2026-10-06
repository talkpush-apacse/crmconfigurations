import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_ACTIVITY_ACTIONS, toClientActivity, visibleSinceByItem, type ActivityRow, type ClientActivityContext } from "../src/lib/tracker/client-activity";

/** The activity trail a client may see: an allow-list, so nothing internal can reach it. */

const SECRET_EMAIL = "jolo.yu@talkpush.com";
const SECRET_BLOCKER = "SECRET_BLOCKER_REASON";
const SECRET_JIRA = "https://talkpush.atlassian.net/browse/TP-11000";
const SECRET_NOTE = "SECRET_INTERNAL_NOTE";

let n = 0;
const row = (over: Partial<ActivityRow> & { action: string }): ActivityRow => ({
  id: `r${++n}`,
  entityType: "item",
  entityId: "a",
  before: null,
  after: null,
  actorLabel: SECRET_EMAIL,
  via: "web",
  createdAt: new Date(Date.UTC(2026, 9, 6, 10, 0, n)),
  ...over,
});

const ctx = (extra: Partial<ClientActivityContext> = {}): ClientActivityContext => ({
  visibleItems: new Map([
    ["a", "Provide DNS records"],
    ["b", "Approve templates"],
  ]),
  sharedRemarks: new Map([["m1", { body: "Sent to our IT team today" }]]),
  ...extra,
});

const all = (rows: ActivityRow[], c = ctx()) => toClientActivity(rows, c);

test("staff are always 'Talkpush team' and never an email; a client is shown by name", () => {
  const out = all([
    row({ action: "item.status_changed", before: { title: "Provide DNS records", status: "in_progress" }, after: { status: "done" } }),
    row({ action: "item.status_changed", actorLabel: "client:Ana Reyes", via: "client", before: { title: "Provide DNS records", status: "done" }, after: { status: "in_progress" } }),
    row({ action: "item.status_changed", actorLabel: "Claude (Jolo)", via: "mcp", before: { status: "not_started" }, after: { status: "in_progress" } }),
  ]);
  assert.deepEqual(out.map((e) => [e.who, e.side]), [["Talkpush team", "talkpush"], ["Ana Reyes", "client"], ["Talkpush team", "talkpush"]]);
  assert.equal(JSON.stringify(out).includes(SECRET_EMAIL), false);
  assert.equal(JSON.stringify(out).includes("Claude"), false);
});

test("only approved actions show; links, files, downloads, metrics and phases never do", () => {
  const forbidden = ["share.created", "share.contributor_created", "share.revoked", "export.downloaded", "file.added", "file.removed", "metric.updated", "metric.created", "metric.reading_recorded", "phase.created", "phase.updated", "item.reviewed", "project.created"];
  const out = all(forbidden.map((action) => row({ action, entityType: "project", entityId: "p", after: { label: "Brian", fileName: "contract.pdf", audience: "client", targetDate: undefined } })));
  assert.equal(out.length, 0);
  assert.ok(!(CLIENT_ACTIVITY_ACTIONS as readonly string[]).some((a) => forbidden.includes(a)));
});

test("an item the client cannot see never appears", () => {
  const out = all([
    row({ entityId: "hidden", action: "item.status_changed", before: { title: "SECRET item", status: "not_started" }, after: { status: "done" } }),
    row({ entityId: "hidden", action: "item.created", after: { title: "SECRET item" } }),
    row({ entityType: "remark", entityId: "m9", action: "remark.added", after: { itemId: "hidden", visibility: "shared" } }),
  ]);
  assert.equal(out.length, 0);
});

test("only the allowed fields of a change are described", () => {
  const out = all([
    row({
      action: "item.updated",
      before: { title: "Provide DNS records", blockerReason: SECRET_BLOCKER, links: [SECRET_JIRA], visibility: "client_visible" },
      after: { blockerReason: SECRET_BLOCKER, links: [SECRET_JIRA], externalDependency: "SECRET_DEP", waitingOn: "SECRET_WAIT", type: "risk", sortOrder: 3 },
    }),
  ]);
  assert.equal(out.length, 0, "a change to team-only fields alone is not shown at all");

  const mixed = all([
    row({
      action: "item.updated",
      before: { title: "Provide DNS records", dueDate: "2026-10-08", blockerReason: SECRET_BLOCKER },
      after: { dueDate: "2026-10-10", priority: "high", blockerReason: null, links: [SECRET_JIRA] },
    }),
  ]);
  assert.equal(mixed.length, 1);
  assert.equal(mixed[0].text, 'set the priority of "Provide DNS records" to High, and moved the due date of "Provide DNS records" from 8 Oct 2026 to 10 Oct 2026');
  const json = JSON.stringify(mixed);
  for (const secret of [SECRET_BLOCKER, SECRET_JIRA, SECRET_EMAIL]) assert.equal(json.includes(secret), false, secret);
});

test("status, rename, description, owner and what it waits for are described without values that could leak", () => {
  const [e] = all([
    row({
      action: "item.status_changed",
      before: { title: "Provide DNS records", status: "blocked", description: "OLD TEXT" },
      after: { status: "done", title: "DNS records", description: "NEW TEXT", ownerPersonId: "p-secret-id", blockedByItemIds: ["x", "y"] },
    }),
  ]);
  assert.match(e.text, /^moved "Provide DNS records" from Blocked to Done, and renamed "Provide DNS records" to "DNS records", and edited the description/);
  assert.match(e.text, /changed the owner of/);
  assert.match(e.text, /changed what .* is waiting for/);
  for (const hidden of ["OLD TEXT", "NEW TEXT", "p-secret-id"]) assert.equal(e.text.includes(hidden), false, hidden);
});

test("team-only remarks never show; a shared comment shows what was written", () => {
  const out = all([
    row({ entityType: "remark", entityId: "m1", action: "remark.added", actorLabel: "client:Ben Cruz", via: "client", after: { itemId: "a", visibility: "shared" } }),
    row({ entityType: "remark", entityId: "m2", action: "remark.added", after: { itemId: "a", visibility: "internal" } }),
  ], ctx({ sharedRemarks: new Map([["m1", { body: "Sent to our IT team today" }], ["m2", { body: SECRET_NOTE }]]) }));
  assert.equal(out.length, 1);
  assert.equal(out[0].who, "Ben Cruz");
  assert.equal(out[0].quote, "Sent to our IT team today");
  assert.equal(JSON.stringify(out).includes(SECRET_NOTE), false);
});

test("what happened while an item was team-only is never shown, even after it becomes visible", () => {
  const rows = [
    row({ action: "item.created", after: { title: "Provide DNS records" }, createdAt: new Date("2026-10-01T09:00:00Z") }),
    row({ action: "item.status_changed", before: { status: "not_started" }, after: { status: "blocked" }, createdAt: new Date("2026-10-02T09:00:00Z") }),
    row({ action: "item.updated", before: { visibility: "internal" }, after: { visibility: "client_visible" }, createdAt: new Date("2026-10-03T09:00:00Z") }),
    row({ action: "item.status_changed", before: { status: "blocked" }, after: { status: "in_progress" }, createdAt: new Date("2026-10-04T09:00:00Z") }),
  ];
  assert.equal(visibleSinceByItem(rows).get("a"), new Date("2026-10-03T09:00:00Z").getTime());
  const out = toClientActivity(rows, ctx());
  assert.equal(out.length, 1);
  assert.match(out[0].text, /from Blocked to In progress/);
});

test("a change to the target date shows, other project changes do not, and the limit applies", () => {
  const rows = [
    row({ entityType: "project", entityId: "p", action: "project.updated", before: { targetDate: "2026-11-10" }, after: { targetDate: "2026-11-20" } }),
    row({ entityType: "project", entityId: "p", action: "project.updated", before: { title: "SECRET old" }, after: { title: "SECRET new", healthOverrideNote: SECRET_NOTE } }),
  ];
  const out = toClientActivity(rows, ctx());
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "moved the project target date from 10 Nov 2026 to 20 Nov 2026");
  const many = Array.from({ length: 30 }, (_, i) => row({ action: "item.created", after: { title: `T${i}` } }));
  assert.equal(toClientActivity(many, ctx(), 5).length, 5);
});
