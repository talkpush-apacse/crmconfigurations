import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PHASES,
  ITEM_TYPES,
  PLAN_AUDIENCES,
  PRIORITIES,
} from "../src/lib/tracker/constants";
import { STANDARD_ITEMS, STANDARD_TEMPLATE } from "../src/lib/tracker/plan-template-seed";
import {
  audienceFields,
  defaultOwnerPersonId,
  describeTiming,
  firstWorkday,
  phaseDates,
  planDates,
  workdayDate,
} from "../src/lib/tracker/plan-schedule";
import { diffPlan, filterLoopEdges, planEdges, templateGraphProblems, type ExistingPlanItem } from "../src/lib/tracker/plan-selection";
import { findDependencyConflicts, type ScheduleItem } from "../src/lib/tracker/schedule";

// ---------------------------------------------------------------- the standard plan itself

test("the standard plan has unique keys and every dependency points at a real item", () => {
  const keys = STANDARD_ITEMS.map((i) => i.key);
  assert.equal(new Set(keys).size, keys.length, "duplicate keys");
  assert.deepEqual(templateGraphProblems(STANDARD_ITEMS), []);
});

test("every standard item uses valid phases, types, priorities and audiences, with a sane time window", () => {
  for (const i of STANDARD_ITEMS) {
    assert.ok((DEFAULT_PHASES as readonly string[]).includes(i.phaseName), `${i.key}: unknown phase ${i.phaseName}`);
    assert.ok((ITEM_TYPES as readonly string[]).includes(i.type), `${i.key}: bad type`);
    assert.ok((PRIORITIES as readonly string[]).includes(i.priority), `${i.key}: bad priority`);
    assert.ok((PLAN_AUDIENCES as readonly string[]).includes(i.audience), `${i.key}: bad audience`);
    assert.ok(i.startDay >= 1 && i.endDay >= i.startDay && i.endDay <= 45, `${i.key}: window ${i.startDay}-${i.endDay}`);
    assert.ok(i.title.length > 0 && i.title.length <= 200, `${i.key}: title length`);
  }
});

test("every phase has a week window and the plan covers the 9-week timeline", () => {
  for (const phase of new Set(STANDARD_ITEMS.map((i) => i.phaseName))) {
    assert.ok(STANDARD_TEMPLATE.phaseWeeks[phase], `no weeks for ${phase}`);
  }
  const last = Math.max(...STANDARD_ITEMS.map((i) => i.endDay));
  assert.equal(last, 45, "the plan should end with hypercare in week 9");
});

test("the standard plan has no dependency conflicts, whatever weekday the project starts", () => {
  for (const start of ["2026-10-05", "2026-10-07", "2026-10-10"]) {
    const items: ScheduleItem[] = STANDARD_ITEMS.map((i) => {
      const dates = planDates(start, i.startDay, i.endDay);
      return {
        id: i.key,
        title: i.title,
        status: "not_started",
        startDate: dates.startDate,
        dueDate: dates.dueDate,
        isMilestone: i.isMilestone,
        blockedByItemIds: i.dependsOnKeys,
      };
    });
    const conflicts = findDependencyConflicts(items);
    assert.deepEqual(
      conflicts.map((c) => `${c.itemId} starts ${c.itemStart} before ${c.blockerId} is due ${c.blockerEnd}`),
      [],
      `conflicts for a project starting ${start}`
    );
  }
});

test("a dependency never points from an earlier phase to a later one", () => {
  const order = new Map(DEFAULT_PHASES.map((p, i) => [p as string, i]));
  const byKey = new Map(STANDARD_ITEMS.map((i) => [i.key, i]));
  for (const i of STANDARD_ITEMS) {
    for (const dep of i.dependsOnKeys) {
      const blocker = byKey.get(dep)!;
      // Hypercare's custom dashboard starts early on purpose but has no dependencies, so this stays true.
      assert.ok(order.get(blocker.phaseName)! <= order.get(i.phaseName)!, `${i.key} (${i.phaseName}) waits on ${dep} (${blocker.phaseName})`);
    }
  }
});

test("items the client can see never name internal teams, tickets or tooling", () => {
  const banned = /\b(ticket|jira|product support|cd team|integration team|analytics team|mcp|claude|internal)\b/i;
  for (const i of STANDARD_ITEMS) {
    if (i.audience === "internal") continue;
    const text = `${i.title} ${i.description ?? ""}`;
    assert.ok(!banned.test(text), `${i.key} would show internal wording to the client: ${text}`);
  }
});

test("the plan has the milestones the health rules rely on", () => {
  const milestones = STANDARD_ITEMS.filter((i) => i.isMilestone).map((i) => i.key);
  for (const key of ["scoping-workflow-signoff", "uat-signoff", "golive-cutover", "hypercare-exit"]) {
    assert.ok(milestones.includes(key), `${key} should be a milestone`);
  }
});

test("Admin Settings and the Talkpush-only steps are internal; the client's own steps are client-owned", () => {
  const by = Object.fromEntries(STANDARD_ITEMS.map((i) => [i.key, i]));
  assert.equal(by["config-admin-settings"].audience, "internal");
  assert.equal(by["scoping-tenant-request"].audience, "internal");
  assert.equal(by["config-internal-testing"].audience, "internal");
  assert.equal(by["channel-email"].audience, "client");
  assert.equal(by["channel-fb-pages"].audience, "client");
  assert.equal(by["scoping-infosec"].audience, "client");
});

// ---------------------------------------------------------------- working-day dates

test("working days skip weekends and start on the first weekday", () => {
  // 2026-10-05 is a Monday.
  assert.equal(workdayDate("2026-10-05", 1), "2026-10-05");
  assert.equal(workdayDate("2026-10-05", 5), "2026-10-09"); // Friday
  assert.equal(workdayDate("2026-10-05", 6), "2026-10-12"); // next Monday
  assert.equal(workdayDate("2026-10-05", 45), "2026-12-04"); // end of week 9
  // A Saturday start rolls to Monday.
  assert.equal(firstWorkday("2026-10-10"), "2026-10-12");
  assert.equal(workdayDate("2026-10-10", 1), "2026-10-12");
  // A Wednesday start: day 3 is Friday, day 4 is the following Monday.
  assert.equal(workdayDate("2026-10-07", 3), "2026-10-09");
  assert.equal(workdayDate("2026-10-07", 4), "2026-10-12");
});

test("item dates come from the project start; no start date means no dates", () => {
  assert.deepEqual(planDates("2026-10-05", 11, 12), { startDate: "2026-10-19", dueDate: "2026-10-20" });
  assert.deepEqual(planDates(null, 11, 12), { startDate: null, dueDate: null });
  assert.deepEqual(planDates("2026-10-05", null, null), { startDate: null, dueDate: null });
  assert.deepEqual(planDates("2026-10-05", 5, null), { startDate: "2026-10-09", dueDate: "2026-10-09" });
});

test("phase dates follow the week ranges", () => {
  assert.deepEqual(phaseDates("2026-10-05", [1, 2]), { startDate: "2026-10-05", endDate: "2026-10-16" });
  assert.deepEqual(phaseDates("2026-10-05", [3, 4]), { startDate: "2026-10-19", endDate: "2026-10-30" });
  assert.deepEqual(phaseDates(null, [1, 2]), { startDate: null, endDate: null });
});

test("timing is described in weeks", () => {
  assert.equal(describeTiming(1, 2), "Week 1");
  assert.equal(describeTiming(11, 20), "Weeks 3 to 4");
  assert.equal(describeTiming(null, null), "No timing set");
});

// ---------------------------------------------------------------- audience and owner

test("audience decides visibility and owner side", () => {
  assert.deepEqual(audienceFields("internal"), { visibility: "internal", ownerSide: "talkpush" });
  assert.deepEqual(audienceFields("shared"), { visibility: "client_visible", ownerSide: "talkpush" });
  assert.deepEqual(audienceFields("client"), { visibility: "client_visible", ownerSide: "client" });
});

test("Talkpush-side items go to the project owner; client-side items stay unassigned", () => {
  assert.equal(defaultOwnerPersonId("internal", "p1"), "p1");
  assert.equal(defaultOwnerPersonId("shared", "p1"), "p1");
  assert.equal(defaultOwnerPersonId("client", "p1"), null);
  assert.equal(defaultOwnerPersonId("shared", null), null);
});

// ---------------------------------------------------------------- tick / untick

const ex = (key: string, over: Partial<ExistingPlanItem> = {}): ExistingPlanItem => ({
  id: `id-${key}`,
  templateItemKey: key,
  archived: false,
  status: "not_started",
  title: key.toUpperCase(),
  ...over,
});

test("ticking creates, restores or keeps; unticking archives", () => {
  const diff = diffPlan(["a", "b", "c", "d"], new Set(["a", "b", "c"]), [ex("b"), ex("c", { archived: true }), ex("d")]);
  assert.deepEqual(diff.create, ["a"]);
  assert.deepEqual(diff.keep, ["b"]);
  assert.deepEqual(diff.restore, ["c"]);
  assert.deepEqual(diff.archive.map((i) => i.templateItemKey), ["d"]);
  assert.deepEqual(diff.startedToArchive, []);
});

test("unticking an item that work has started on is flagged", () => {
  const diff = diffPlan(["a", "b"], new Set(["a"]), [ex("a"), ex("b", { status: "in_progress" })]);
  assert.deepEqual(diff.startedToArchive.map((i) => i.templateItemKey), ["b"]);
});

test("an unticked item that was never created is simply ignored", () => {
  const diff = diffPlan(["a", "b"], new Set(["a"]), []);
  assert.deepEqual(diff.create, ["a"]);
  assert.deepEqual(diff.archive, []);
});

test("new items are linked to the blockers that are in the plan; missing blockers are reported", () => {
  const template = [
    { key: "a", dependsOnKeys: [] },
    { key: "b", dependsOnKeys: ["a"] },
  ];
  const result = planEdges(template, new Set(["a", "b"]), new Set(["a", "b"]), new Set());
  assert.deepEqual(result.add, [{ itemKey: "b", blockedByKey: "a" }]);
  assert.deepEqual(result.dropped.map((d) => `${d.itemKey}>${d.blockedByKey}`), []);

  // "x" is a template item that is not ticked: the dependency is dropped and reported.
  const withX = [{ key: "a", dependsOnKeys: [] }, { key: "b", dependsOnKeys: ["a", "x"] }, { key: "x", dependsOnKeys: [] }];
  const second = planEdges(withX, new Set(["a", "b"]), new Set(["a", "b"]), new Set());
  assert.deepEqual(second.dropped.map((d) => `${d.itemKey}>${d.blockedByKey}`), ["b>x"]);
});

test("a kept item gets linked to a blocker that is new in this apply, but old links are not re-added", () => {
  const template = [
    { key: "a", dependsOnKeys: [] },
    { key: "b", dependsOnKeys: ["a"] },
    { key: "c", dependsOnKeys: ["b"] },
  ];
  // b and c were already in the project. a is newly ticked.
  const r = planEdges(template, new Set(["a", "b", "c"]), new Set(["a"]), new Set(["c>b"]));
  assert.deepEqual(r.add, [{ itemKey: "b", blockedByKey: "a" }]);
  // c>b existed and neither end is new, so it is not touched. A link removed by hand is not brought back.
  const removedByHand = planEdges(template, new Set(["a", "b", "c"]), new Set(["a"]), new Set());
  assert.deepEqual(removedByHand.add, [{ itemKey: "b", blockedByKey: "a" }]);
});

test("a link that would make two items wait on each other is left out", () => {
  const { ok, loops } = filterLoopEdges(
    [{ itemId: "a", blockedByItemId: "b" }],
    [{ itemId: "b", blockedByItemId: "a" }]
  );
  assert.deepEqual(ok, []);
  assert.equal(loops.length, 1);
});
