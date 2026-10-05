import test from "node:test";
import assert from "node:assert/strict";
import { buildHeadline, buildSnapshot, type SnapshotInput, type SnapshotItem } from "../src/lib/tracker/snapshot";
import { computeHealth } from "../src/lib/tracker/health";
import { matchByName } from "../src/lib/tracker/match";

const TODAY = "2026-10-10";

const item = (over: Partial<SnapshotItem> & { id: string; title: string }): SnapshotItem => ({
  status: "in_progress",
  dueDate: null,
  completedAt: null,
  isMilestone: false,
  archived: false,
  ownerName: "Ana",
  ownerSide: "client",
  phaseId: "p1",
  blockerReason: null,
  waitingOn: null,
  visibility: "client_visible",
  ...over,
});

function snapshot(items: SnapshotItem[], projectOver: Partial<SnapshotInput["project"]> = {}) {
  const project: SnapshotInput["project"] = {
    id: "proj",
    title: "Go-live",
    accountName: "Acme",
    status: "active",
    startDate: "2026-09-01",
    targetDate: "2026-12-01",
    originalTargetDate: "2026-11-15",
    goLiveDate: null,
    rescheduleCount: 1,
    owner: { name: "Jolo" },
    sponsor: null,
    ...projectOver,
  };
  const health = computeHealth(
    { status: project.status, targetDate: project.targetDate, healthOverride: null, healthOverrideNote: null },
    items,
    TODAY
  );
  return buildSnapshot({
    project,
    health,
    items,
    phases: [
      { id: "p1", name: "Configuration" },
      { id: "p2", name: "UAT" },
    ],
    today: TODAY,
  });
}

test("the headline never hides a single blocked or overdue item", () => {
  const s = snapshot([item({ id: "a", title: "A", status: "blocked", blockerReason: "IT window", ownerSide: "talkpush" })]);
  assert.equal(s.health.level, "at_risk"); // one blocked item is enough to make a project at risk
  assert.match(s.headline, /1 item is blocked/);
  assert.doesNotMatch(s.headline, /nothing is overdue or blocked/);
});

test("on track with an exception leads with the exception and keeps the target", () => {
  // A blocked item now makes health At risk, so the On track wording is reached with a manual On track setting.
  assert.equal(
    buildHeadline({ level: "on_track", firstReason: null, targetDate: "2026-12-01", projectStatus: "active", waitingOnClientCount: 0, clientOwnedOpenCount: 0, blockedCount: 1 }),
    "On track for 1 Dec 2026, but 1 item is blocked."
  );
  // The computed case: At risk, reason first, and the blocker's free-text reason stays out of the headline.
  const s = snapshot([item({ id: "a", title: "A", status: "blocked", blockerReason: "IT window", ownerSide: "talkpush" })]);
  assert.match(s.headline, /^At risk\. 1 item is blocked\. Target 1 Dec 2026\./);
  assert.doesNotMatch(s.headline, /IT window/, "the blocker reason stays out of the headline");
});

test("on track but behind plan says so, with every exception in one sentence", () => {
  // An item due today and not done: not overdue yet, but one item behind the plan line.
  const due = snapshot([item({ id: "a", title: "A", dueDate: TODAY, ownerSide: "talkpush" })]);
  assert.equal(due.health.level, "on_track");
  assert.equal(due.headline, "On track for 1 Dec 2026, but the project is 1 item behind plan.");

  assert.equal(
    buildHeadline({ level: "on_track", firstReason: null, targetDate: "2026-11-10", projectStatus: "active", waitingOnClientCount: 4, clientOwnedOpenCount: 4, blockedCount: 1, overdueCount: 0, behindPlanBy: 1 }),
    "On track for 10 Nov 2026, but 1 item is blocked and the project is 1 item behind plan. 4 open items need the client."
  );
  // At risk keeps its reason-first wording.
  assert.match(
    buildHeadline({ level: "at_risk", firstReason: "2 items are blocked.", targetDate: "2026-11-10", projectStatus: "active", waitingOnClientCount: 0, clientOwnedOpenCount: 0, blockedCount: 2, behindPlanBy: 3 }),
    /^At risk\. 2 items are blocked\. Target 10 Nov 2026\.$/
  );
});

test("a clean project says so plainly", () => {
  const s = snapshot([item({ id: "a", title: "A", ownerSide: "talkpush", dueDate: "2026-11-20" })]);
  assert.match(s.headline, /^On track\. Target 1 Dec 2026, and nothing is overdue or blocked\.$/);
});

test("bad news leads, and the client's open items are named", () => {
  const s = snapshot([
    item({ id: "a", title: "A", status: "blocked", blockerReason: "x" }),
    item({ id: "b", title: "B", status: "blocked", blockerReason: "y" }),
    item({ id: "c", title: "C", status: "waiting_on_client", waitingOn: "Legal" }),
  ]);
  assert.equal(s.health.level, "at_risk");
  assert.match(s.headline, /^At risk\. 2 items are blocked\./);
  assert.match(s.headline, /3 open items need the client\.$/);
});

test("headline for a completed project", () => {
  assert.equal(snapshot([], { status: "completed" }).headline, "This project is complete.");
  assert.equal(
    buildHeadline({ level: "on_track", firstReason: null, targetDate: null, projectStatus: "active", waitingOnClientCount: 0, clientOwnedOpenCount: 0 }),
    "On track. No target date set, and nothing is overdue or blocked."
  );
});

test("needs-attention groups and owner sides are right", () => {
  const s = snapshot([
    item({ id: "late", title: "Late", dueDate: "2026-10-05", ownerSide: "talkpush", ownerName: "Jolo" }),
    item({ id: "soon", title: "Soon", status: "not_started", dueDate: "2026-10-14", ownerSide: "vendor", ownerName: "Cleo" }),
    item({ id: "far", title: "Far", dueDate: "2026-12-01", ownerSide: null, ownerName: null }),
    item({ id: "done", title: "Done", status: "done", dueDate: "2026-09-01" }),
    item({ id: "gone", title: "Gone", archived: true, status: "blocked" }),
    item({ id: "ms", title: "UAT sign-off", isMilestone: true, dueDate: "2026-11-01", ownerSide: "client" }),
  ]);
  assert.deepEqual(s.needsAttention.overdue.map((i) => i.id), ["late"]);
  assert.equal(s.needsAttention.overdue[0].dueNote, "5 days overdue");
  assert.deepEqual(s.needsAttention.dueSoon.map((i) => i.id), ["soon"]);
  assert.equal(s.openItemsByOwnerSide.talkpush.count, 1);
  assert.equal(s.openItemsByOwnerSide.vendor.count, 1);
  assert.equal(s.openItemsByOwnerSide.unassigned.count, 1);
  assert.equal(s.openItemsByOwnerSide.client.count, 1);
  assert.equal(s.progress.total, 5);
  assert.equal(s.progress.done, 1);
  assert.equal(s.progress.percentDone, 20);
  assert.equal(s.nextMilestone?.title, "UAT sign-off");
  assert.equal(s.progress.daysToTarget, 52);
});

test("phase rollup counts only live, countable items", () => {
  const s = snapshot([
    item({ id: "a", title: "A", status: "done", phaseId: "p1" }),
    item({ id: "b", title: "B", phaseId: "p1" }),
    item({ id: "c", title: "C", phaseId: "p2", status: "dropped" }),
    item({ id: "d", title: "D", phaseId: "p2", status: "not_started" }),
  ]);
  assert.deepEqual(s.phases, [
    { name: "Configuration", total: 2, done: 1, open: 1 },
    { name: "UAT", total: 1, done: 0, open: 1 },
  ]);
});

test("name matching: exact wins, a unique partial is accepted, ambiguity is reported", () => {
  const rows = [{ n: "UAT sign-off" }, { n: "UAT scripts" }, { n: "Go-live" }];
  const get = (r: { n: string }) => r.n;
  assert.deepEqual(matchByName(rows, "go-live", get), { kind: "one", value: rows[2] });
  assert.deepEqual(matchByName(rows, "  UAT   SIGN-OFF ", get), { kind: "one", value: rows[0] });
  assert.deepEqual(matchByName(rows, "sign", get), { kind: "one", value: rows[0] });
  assert.equal(matchByName(rows, "uat", get).kind, "many");
  assert.equal(matchByName(rows, "training", get).kind, "none");
  assert.equal(matchByName(rows, "   ", get).kind, "none");
  const twins = [{ n: "Test" }, { n: "test" }];
  assert.equal(matchByName(twins, "test", get).kind, "many");
});

import { describeActivity } from "../src/lib/tracker/activity-text";

test("activity rows read as plain sentences", () => {
  assert.equal(describeActivity({ action: "project.created", entityTitle: null, before: null, after: { title: "x" } }), "created the project");
  assert.equal(
    describeActivity({
      action: "item.status_changed",
      entityTitle: "UAT sign-off",
      before: { title: "UAT sign-off", status: "in_progress" },
      after: { status: "blocked", blockerReason: "IT window" },
    }),
    'moved "UAT sign-off" from In progress to Blocked (IT window)'
  );
  assert.equal(
    describeActivity({ action: "project.updated", entityTitle: null, before: { targetDate: "2026-11-15" }, after: { targetDate: "2026-12-01" } }),
    "moved the target date from 15 Nov 2026 to 1 Dec 2026"
  );
  assert.equal(describeActivity({ action: "item.updated", entityTitle: "Go-live", before: {}, after: { archived: true } }), 'archived "Go-live"');
  assert.equal(
    describeActivity({ action: "item.updated", entityTitle: "Go-live", before: {}, after: { dueDate: "2026-11-30", ownerPersonId: "x" } }),
    'changed "Go-live": due date, owner'
  );
  assert.equal(describeActivity({ action: "remark.added", entityTitle: "Go-live", before: null, after: { visibility: "shared" } }), 'added a shared remark on "Go-live"');
  assert.equal(describeActivity({ action: "something.new", entityTitle: null, before: null, after: null }), "something new");
});

import { computeGlobalOrder, dropAnchor, moveWithin } from "../src/lib/tracker/board-order";

test("kanban order: moving within a column", () => {
  const global = ["a", "b", "c", "d", "e"]; // a,c,e are in the column; b,d are other statuses
  const column = ["a", "c", "e"];
  // drag "a" down onto "c": lands after c
  let anchor = dropAnchor(column, "a", "c");
  assert.deepEqual(anchor, { beforeId: null, afterId: "c" });
  assert.deepEqual(computeGlobalOrder(global, "a", anchor), ["b", "c", "a", "d", "e"]);
  // drag "e" up onto "a": lands before a
  anchor = dropAnchor(column, "e", "a");
  assert.deepEqual(anchor, { beforeId: "a", afterId: null });
  assert.deepEqual(computeGlobalOrder(global, "e", anchor), ["e", "a", "b", "c", "d"]);
  assert.deepEqual(moveWithin([1, 2, 3], 0, 2), [2, 3, 1]);
});

test("kanban order: dropping into another column", () => {
  const global = ["a", "b", "c", "d"];
  const target = ["b", "d"]; // active "a" is not in this column
  // onto b: before b (a was first, b second: a goes right before b, i.e. stays put)
  assert.deepEqual(computeGlobalOrder(global, "a", dropAnchor(target, "a", "b")), ["a", "b", "c", "d"]);
  // onto d: before d
  assert.deepEqual(computeGlobalOrder(global, "a", dropAnchor(target, "a", "d")), ["b", "c", "a", "d"]);
  // onto the column body: after the last card (d)
  assert.deepEqual(computeGlobalOrder(global, "a", dropAnchor(target, "a", null)), ["b", "c", "d", "a"]);
});

test("kanban order: an empty column keeps the item where it was", () => {
  assert.deepEqual(computeGlobalOrder(["a", "b", "c"], "b", dropAnchor([], "b", null)), ["a", "b", "c"]);
});

test("kanban order: dropping on itself or an unknown card changes nothing", () => {
  const global = ["a", "b", "c"];
  assert.deepEqual(computeGlobalOrder(global, "b", dropAnchor(["a", "b", "c"], "b", "b")), global);
  assert.deepEqual(computeGlobalOrder(global, "b", { beforeId: "zzz", afterId: null }), global);
});
