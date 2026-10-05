import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  daysBetween,
  describeDue,
  isDateOnly,
  overdueDays,
  parseDateOnly,
  toDateOnly,
  todayDateOnly,
} from "../src/lib/tracker/dates";
import { planStatusChange } from "../src/lib/tracker/status";
import { unmetDependencies, validateDependencySet, wouldCreateCycle } from "../src/lib/tracker/dependencies";
import { computeHealth, type HealthItem, type HealthProject } from "../src/lib/tracker/health";
import { summarizeProject } from "../src/lib/tracker/summary";
import {
  toClientItem,
  toClientItems,
  toClientProject,
  toClientRemarks,
  type RawItem,
} from "../src/lib/tracker/visibility";
import { itemCreateSchema, projectCreateSchema, remarkCreateSchema } from "../src/lib/tracker/validations";

// ---------- dates ----------

test("date helpers round-trip calendar days without time-zone drift", () => {
  assert.equal(isDateOnly("2026-11-14"), true);
  assert.equal(isDateOnly("2026-02-30"), false);
  assert.equal(isDateOnly("14/11/2026"), false);
  assert.equal(toDateOnly(parseDateOnly("2026-11-14")), "2026-11-14");
  assert.equal(parseDateOnly(""), null);
  assert.throws(() => parseDateOnly("nope"));
  assert.equal(daysBetween("2026-11-01", "2026-11-14"), 13);
  assert.equal(daysBetween("2026-11-14", "2026-11-01"), -13);
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
});

test("today is computed in the configured time zone", () => {
  const instant = new Date("2026-10-01T20:00:00Z");
  assert.equal(todayDateOnly(instant, "UTC"), "2026-10-01");
  assert.equal(todayDateOnly(instant, "Asia/Manila"), "2026-10-02");
});

test("overdue wording is written out", () => {
  assert.equal(overdueDays("2026-10-01", "2026-10-04"), 3);
  assert.equal(overdueDays("2026-10-10", "2026-10-04"), 0);
  assert.equal(describeDue("2026-10-01", "2026-10-04"), "3 days overdue");
  assert.equal(describeDue("2026-10-03", "2026-10-04"), "1 day overdue");
  assert.equal(describeDue("2026-10-04", "2026-10-04"), "Due today");
  assert.equal(describeDue("2026-10-05", "2026-10-04"), "Due in 1 day");
  assert.equal(describeDue(null, "2026-10-04"), null);
});

// ---------- status ----------

const idle = { status: "not_started", blockerReason: null, completedAt: null };

test("blocked requires a reason, and the reason clears when unblocked", () => {
  const noReason = planStatusChange(idle, "blocked");
  assert.equal(noReason.ok, false);

  const blocked = planStatusChange(idle, "blocked", { blockerReason: "  Waiting for IT whitelisting " });
  assert.ok(blocked.ok);
  if (blocked.ok) {
    assert.equal(blocked.patch.blockerReason, "Waiting for IT whitelisting");
    const back = planStatusChange(blocked.patch, "in_progress");
    assert.ok(back.ok);
    if (back.ok) assert.equal(back.patch.blockerReason, null);
  }
});

test("done stamps completedAt once and leaving done clears it", () => {
  const now = new Date("2026-10-02T00:00:00Z");
  const done = planStatusChange(idle, "done", {}, now);
  assert.ok(done.ok);
  if (done.ok) {
    assert.equal(done.patch.completedAt?.toISOString(), now.toISOString());
    const again = planStatusChange(done.patch, "done", {}, new Date("2026-12-01T00:00:00Z"));
    assert.ok(again.ok);
    if (again.ok) {
      assert.equal(again.changed, false);
      assert.equal(again.patch.completedAt?.toISOString(), now.toISOString());
    }
    const reopened = planStatusChange(done.patch, "in_progress");
    assert.ok(reopened.ok);
    if (reopened.ok) assert.equal(reopened.patch.completedAt, null);
  }
});

test("unknown statuses are rejected", () => {
  assert.equal(planStatusChange(idle, "finished").ok, false);
});

// ---------- dependencies ----------

test("dependency loops are detected, including indirect ones", () => {
  const edges = [
    { itemId: "b", blockedByItemId: "a" },
    { itemId: "c", blockedByItemId: "b" },
  ];
  assert.equal(wouldCreateCycle(edges, "a", "a"), true);
  assert.equal(wouldCreateCycle(edges, "a", "c"), true);
  assert.equal(wouldCreateCycle(edges, "a", "b"), true);
  assert.equal(wouldCreateCycle(edges, "c", "a"), false);
  assert.equal(wouldCreateCycle(edges, "d", "c"), false);
});

test("replacing a dependency list validates every entry", () => {
  const known = new Set(["a", "b", "c"]);
  const ok = validateDependencySet([{ itemId: "b", blockedByItemId: "a" }], "c", ["b", "b", "a"], known);
  assert.ok(ok.ok);
  if (ok.ok) assert.deepEqual(ok.blockedBy.sort(), ["a", "b"]);

  const loop = validateDependencySet([{ itemId: "b", blockedByItemId: "a" }], "a", ["b"], known);
  assert.equal(loop.ok, false);

  const outside = validateDependencySet([], "a", ["zzz"], known);
  assert.equal(outside.ok, false);
});

test("only unfinished blockers count as unmet", () => {
  const edges = [
    { itemId: "x", blockedByItemId: "a" },
    { itemId: "x", blockedByItemId: "b" },
    { itemId: "x", blockedByItemId: "c" },
  ];
  const status = new Map([
    ["a", "done"],
    ["b", "in_progress"],
    ["c", "dropped"],
  ]);
  assert.deepEqual(unmetDependencies("x", edges, status), ["b"]);
});

// ---------- health ----------

const TODAY = "2026-10-10";
const project: HealthProject = { status: "active", targetDate: "2026-12-01", healthOverride: null, healthOverrideNote: null };
const item = (over: Partial<HealthItem>): HealthItem => ({
  status: "in_progress",
  dueDate: null,
  isMilestone: false,
  archived: false,
  title: "Item",
  ...over,
});

test("health is on track when nothing is wrong", () => {
  const h = computeHealth(project, [item({ dueDate: "2026-11-01" })], TODAY);
  assert.equal(h.level, "on_track");
  assert.deepEqual(h.reasons, []);
});

test("a milestone more than 5 days overdue is off track; exactly 5 is not", () => {
  const six = computeHealth(project, [item({ isMilestone: true, dueDate: "2026-10-04", title: "UAT sign-off" })], TODAY);
  assert.equal(six.level, "off_track");
  assert.match(six.reasons[0], /UAT sign-off.*6 days overdue/);

  const five = computeHealth(project, [item({ isMilestone: true, dueDate: "2026-10-05" })], TODAY);
  assert.equal(five.level, "at_risk"); // overdue, but not past the milestone threshold
});

test("one blocked item is enough to make a project at risk", () => {
  const one = computeHealth(project, [item({ status: "blocked" })], TODAY);
  assert.equal(one.level, "at_risk");
  assert.deepEqual(one.reasons, ["1 item is blocked."]);
  const two = computeHealth(project, [item({ status: "blocked" }), item({ status: "blocked" })], TODAY);
  assert.equal(two.level, "at_risk");
  assert.deepEqual(two.reasons, ["2 items are blocked."]);
  const none = computeHealth(project, [item({ status: "in_progress" })], TODAY);
  assert.equal(none.level, "on_track");
});

test("an item due within 7 days and not started is at risk", () => {
  const h = computeHealth(project, [item({ status: "not_started", dueDate: "2026-10-15" })], TODAY);
  assert.equal(h.level, "at_risk");
  const far = computeHealth(project, [item({ status: "not_started", dueDate: "2026-10-20" })], TODAY);
  assert.equal(far.level, "on_track");
});

test("done, dropped and archived items never hurt health", () => {
  const h = computeHealth(
    project,
    [
      item({ status: "done", isMilestone: true, dueDate: "2026-09-01" }),
      item({ status: "dropped", dueDate: "2026-09-01" }),
      item({ archived: true, status: "blocked" }),
      item({ archived: true, status: "blocked" }),
    ],
    TODAY
  );
  assert.equal(h.level, "on_track");
});

test("the project target date passing by more than 5 days is off track unless completed", () => {
  const late = { ...project, targetDate: "2026-10-01" };
  assert.equal(computeHealth(late, [], TODAY).level, "off_track");
  assert.equal(computeHealth({ ...late, status: "completed" }, [], TODAY).level, "on_track");
});

test("an override wins but the calculated level and reasons stay visible", () => {
  const h = computeHealth(
    { ...project, healthOverride: "on_track", healthOverrideNote: "Client agreed new date" },
    [item({ status: "blocked" }), item({ status: "blocked" })],
    TODAY
  );
  assert.equal(h.level, "on_track");
  assert.equal(h.calculatedLevel, "at_risk");
  assert.equal(h.overridden, true);
  assert.equal(h.overrideNote, "Client agreed new date");
  assert.equal(h.reasons.length, 1);
});

// ---------- summary ----------

test("summary counts and percent ignore dropped and archived items", () => {
  const s = summarizeProject(
    project,
    [
      { ...item({ status: "done" }), title: "a" },
      { ...item({ status: "done" }), title: "b" },
      { ...item({ status: "in_progress", dueDate: "2026-10-05" }), title: "c" },
      { ...item({ status: "waiting_on_client" }), title: "d" },
      { ...item({ status: "dropped" }), title: "e" },
      { ...item({ status: "blocked", archived: true }), title: "f" },
      { ...item({ status: "not_started", isMilestone: true, dueDate: "2026-11-20" }), title: "Go-live" },
    ],
    TODAY
  );
  assert.equal(s.total, 5);
  assert.equal(s.done, 2);
  assert.equal(s.percentDone, 40);
  assert.equal(s.open, 3);
  assert.equal(s.overdue, 1);
  assert.equal(s.waitingOnClient, 1);
  assert.equal(s.blocked, 0);
  assert.equal(s.daysToTarget, 52);
  assert.deepEqual(s.nextMilestone, { title: "Go-live", dueDate: "2026-11-20" });
});

// ---------- client-safe filter ----------

const rawItem = (over: Partial<RawItem> = {}): RawItem => ({
  id: "i1",
  title: "Configure autoflows",
  description: "desc",
  type: "config",
  priority: "high",
  status: "in_progress",
  visibility: "client_visible",
  isMilestone: false,
  phaseId: "p1",
  ownerName: "Ana",
  ownerSide: "client",
  startDate: null,
  dueDate: "2026-11-01",
  completedAt: null,
  waitingOn: null,
  archived: false,
  blockerReason: "INTERNAL: client IT is slow",
  externalDependency: "INTERNAL vendor",
  links: [{ label: "Jira", url: "https://example.com" }],
  checklistTabSlug: "autoflows",
  createdVia: "mcp",
  ...over,
});

test("client items expose only allow-listed fields", () => {
  const out = toClientItem(rawItem()) as unknown as Record<string, unknown>;
  for (const secret of ["blockerReason", "externalDependency", "links", "checklistTabSlug", "createdVia", "visibility", "archived"]) {
    assert.equal(secret in out, false, `${secret} must not reach clients`);
  }
  assert.equal(out.title, "Configure autoflows");
  assert.equal(JSON.stringify(out).includes("INTERNAL"), false);
});

test("internal and archived items never reach clients", () => {
  const items = [
    rawItem({ id: "a" }),
    rawItem({ id: "b", visibility: "internal" }),
    rawItem({ id: "c", archived: true }),
  ];
  assert.deepEqual(toClientItems(items).map((i) => i.id), ["a"]);
});

test("only shared remarks on visible items reach clients", () => {
  const remarks = [
    { id: "r1", itemId: "a", body: "ok", visibility: "shared", authorLabel: "Jolo", createdAt: "2026-10-01T00:00:00Z", internalNote: "x" },
    { id: "r2", itemId: "a", body: "secret", visibility: "internal", authorLabel: "Jolo", createdAt: "2026-10-01T00:00:00Z" },
    { id: "r3", itemId: "b", body: "on hidden item", visibility: "shared", authorLabel: "Jolo", createdAt: "2026-10-01T00:00:00Z" },
  ];
  const out = toClientRemarks(remarks, new Set(["a"]));
  assert.deepEqual(out.map((r) => r.id), ["r1"]);
  assert.equal("visibility" in out[0], false);
  assert.equal("internalNote" in out[0], false);
  assert.equal(out[0].author, "Talkpush team");
  assert.equal(JSON.stringify(out).includes("Jolo"), false, "the staff member's name or email must not reach clients");
});

test("client projects drop internal fields", () => {
  const out = toClientProject({
    id: "p",
    title: "Go-live",
    objective: null,
    status: "active",
    startDate: null,
    targetDate: "2026-12-01",
    originalTargetDate: "2026-11-01",
    goLiveDate: null,
    rescheduleCount: 1,
    accountName: "Acme",
    healthOverrideNote: "INTERNAL",
    checklistId: "c1",
    ownerPersonId: "x",
  }) as unknown as Record<string, unknown>;
  for (const secret of ["healthOverrideNote", "checklistId", "ownerPersonId"]) assert.equal(secret in out, false);
});

// ---------- input validation ----------

test("create schemas apply defaults and reject bad input", () => {
  const i = itemCreateSchema.parse({ title: "  Do the thing  " });
  assert.equal(i.title, "Do the thing");
  assert.equal(i.status, "not_started");
  assert.equal(i.visibility, "client_visible");
  assert.equal(i.priority, "medium");

  assert.equal(itemCreateSchema.safeParse({ title: "" }).success, false);
  assert.equal(itemCreateSchema.safeParse({ title: "x", status: "finished" }).success, false);
  assert.equal(itemCreateSchema.safeParse({ title: "x", dueDate: "2026-02-31" }).success, false);
  assert.equal(itemCreateSchema.parse({ title: "x", dueDate: "" }).dueDate, null);

  const r = remarkCreateSchema.parse({ body: "hello" });
  assert.equal(r.visibility, "internal");

  assert.equal(projectCreateSchema.safeParse({ title: "P" }).success, false);
});

import { itemUpdateSchema, phaseUpdateSchema, projectUpdateSchema } from "../src/lib/tracker/validations";

test("update schemas leave unsent fields alone (a status change must not wipe owner or phase)", () => {
  assert.deepEqual(itemUpdateSchema.parse({ status: "done" }), { status: "done" });
  assert.deepEqual(itemUpdateSchema.parse({ title: "New title" }), { title: "New title" });
  assert.deepEqual(projectUpdateSchema.parse({ title: "New" }), { title: "New" });
  assert.deepEqual(phaseUpdateSchema.parse({ name: "UAT" }), { name: "UAT" });
  for (const key of ["ownerPersonId", "phaseId", "sponsorPersonId", "dueDate", "startDate", "description", "blockerReason"]) {
    assert.equal(key in itemUpdateSchema.parse({ status: "done" }), false, `item.${key} must stay absent`);
  }
  for (const key of ["ownerPersonId", "sponsorPersonId", "targetDate", "objective", "healthOverride"]) {
    assert.equal(key in projectUpdateSchema.parse({ title: "x" }), false, `project.${key} must stay absent`);
  }
});

test("update schemas still clear a field when it is sent as null or empty", () => {
  const item = itemUpdateSchema.parse({ ownerPersonId: null, phaseId: null, dueDate: "", description: "" });
  assert.equal(item.ownerPersonId, null);
  assert.equal(item.phaseId, null);
  assert.equal(item.dueDate, null);
  assert.equal(item.description, null);
  const project = projectUpdateSchema.parse({ sponsorPersonId: null, targetDate: null, healthOverride: null });
  assert.equal(project.sponsorPersonId, null);
  assert.equal(project.targetDate, null);
  assert.equal(project.healthOverride, null);
});

import { shareLinkCreateSchema } from "../src/lib/tracker/validations";

test("share links expire after 90 days unless told otherwise", () => {
  assert.equal(shareLinkCreateSchema.parse({}).expiresInDays, 90);
  assert.equal(shareLinkCreateSchema.parse({ expiresInDays: 30 }).expiresInDays, 30);
  assert.equal(shareLinkCreateSchema.parse({ expiresInDays: null }).expiresInDays, null);
  assert.equal(shareLinkCreateSchema.safeParse({ expiresInDays: 0 }).success, false);
  assert.equal(shareLinkCreateSchema.safeParse({ expiresInDays: 4000 }).success, false);
  assert.equal(shareLinkCreateSchema.safeParse({ kind: "contributor" }).success, false);
});
