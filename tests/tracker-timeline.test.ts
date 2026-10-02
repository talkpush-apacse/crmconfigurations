import test from "node:test";
import assert from "node:assert/strict";
import { conflictMessage, draftConflicts, findDependencyConflicts, itemSpan, type ScheduleItem } from "../src/lib/tracker/schedule";
import { buildTimeline, PX_PER_DAY, type ItemRow, type TimelineInput, type TimelineItem } from "../src/lib/tracker/timeline-layout";

const item = (over: Partial<TimelineItem> & { id: string }): TimelineItem => ({
  title: over.id.toUpperCase(),
  status: "in_progress",
  startDate: null,
  dueDate: null,
  isMilestone: false,
  blockedByItemIds: [],
  phaseId: "p1",
  ownerName: null,
  sortOrder: 0,
  ...over,
});

test("an item's span uses its dates, a single date counts as one day, none means unscheduled", () => {
  assert.deepEqual(itemSpan({ startDate: "2026-10-01", dueDate: "2026-10-05" }), { start: "2026-10-01", end: "2026-10-05" });
  assert.deepEqual(itemSpan({ startDate: null, dueDate: "2026-10-05" }), { start: "2026-10-05", end: "2026-10-05" });
  assert.deepEqual(itemSpan({ startDate: "2026-10-05", dueDate: null }), { start: "2026-10-05", end: "2026-10-05" });
  assert.equal(itemSpan({ startDate: null, dueDate: null }), null);
  assert.deepEqual(itemSpan({ startDate: "2026-10-09", dueDate: "2026-10-01" }), { start: "2026-10-01", end: "2026-10-09" });
});

test("a dependency conflicts when the waiting item starts before its blocker is due", () => {
  const items: ScheduleItem[] = [
    { id: "a", title: "Whitelist domain", status: "in_progress", startDate: "2026-10-01", dueDate: "2026-10-20", isMilestone: false, blockedByItemIds: [] },
    { id: "b", title: "Build sync", status: "not_started", startDate: "2026-10-15", dueDate: "2026-10-30", isMilestone: false, blockedByItemIds: ["a"] },
    { id: "c", title: "UAT", status: "not_started", startDate: "2026-10-20", dueDate: "2026-11-05", isMilestone: false, blockedByItemIds: ["a"] },
  ];
  const conflicts = findDependencyConflicts(items);
  assert.deepEqual(conflicts.map((c) => c.itemId), ["b"]); // c starts the same day a is due: allowed
  assert.equal(conflictMessage(conflicts[0]), '"Whitelist domain" is due 20 Oct 2026, but "Build sync" is planned to start 15 Oct 2026.');
});

test("finished or dropped items never cause a conflict, and undated ones are skipped", () => {
  const base = { startDate: "2026-10-15", dueDate: "2026-10-30", isMilestone: false };
  const items: ScheduleItem[] = [
    { id: "a", title: "A", status: "done", startDate: "2026-10-01", dueDate: "2026-10-20", isMilestone: false, blockedByItemIds: [] },
    { id: "b", title: "B", status: "not_started", ...base, blockedByItemIds: ["a"] },
    { id: "d", title: "D", status: "dropped", startDate: "2026-10-01", dueDate: "2026-10-25", isMilestone: false, blockedByItemIds: [] },
    { id: "e", title: "E", status: "not_started", ...base, blockedByItemIds: ["d"] },
    { id: "f", title: "F", status: "not_started", startDate: null, dueDate: null, isMilestone: false, blockedByItemIds: ["b"] },
  ];
  assert.deepEqual(findDependencyConflicts(items), []);
});

test("conflicts can be checked for an item still being edited", () => {
  const others: ScheduleItem[] = [{ id: "a", title: "Blocker", status: "in_progress", startDate: null, dueDate: "2026-10-20", isMilestone: false, blockedByItemIds: [] }];
  const c = draftConflicts({ title: "Draft", status: "not_started", startDate: "2026-10-10", dueDate: "2026-10-25" }, ["a"], others);
  assert.equal(c.length, 1);
  assert.equal(draftConflicts({ title: "Draft", status: "not_started", startDate: "2026-10-21", dueDate: "2026-10-25" }, ["a"], others).length, 0);
  assert.equal(draftConflicts({ title: "Draft", status: "not_started", startDate: null, dueDate: null }, ["a"], others).length, 0);
});

const input = (items: TimelineItem[], over: Partial<TimelineInput> = {}): TimelineInput => ({
  items,
  phases: [
    { id: "p1", name: "Configuration", sortOrder: 0, startDate: "2026-10-01", endDate: "2026-10-31" },
    { id: "p2", name: "UAT", sortOrder: 1, startDate: null, endDate: null },
  ],
  project: { startDate: "2026-10-01", targetDate: "2026-12-01", goLiveDate: "2026-11-25" },
  today: "2026-10-10",
  ...over,
});

test("the visible range starts on a Monday, ends on a Sunday and covers everything", () => {
  const t = buildTimeline(input([item({ id: "a", startDate: "2026-10-05", dueDate: "2026-10-09" })]))!;
  assert.equal(new Date(`${t.rangeStart}T00:00:00Z`).getUTCDay(), 1);
  assert.equal(new Date(`${t.rangeEnd}T00:00:00Z`).getUTCDay(), 0);
  assert.ok(t.rangeStart <= "2026-09-24" && t.rangeEnd >= "2026-12-08");
  assert.equal(t.days % 7, 0);
  assert.equal(t.markers.today, Math.round((Date.parse("2026-10-10") - Date.parse(t.rangeStart)) / 86_400_000));
  assert.notEqual(t.markers.target, null);
  assert.notEqual(t.markers.goLive, null);
});

test("rows follow phase order, then sort order; unscheduled and dropped items are not rows", () => {
  const t = buildTimeline(
    input([
      item({ id: "b", sortOrder: 2, dueDate: "2026-10-12" }),
      item({ id: "a", sortOrder: 1, startDate: "2026-10-03", dueDate: "2026-10-08" }),
      item({ id: "u", phaseId: "p2", startDate: null, dueDate: null }),
      item({ id: "x", phaseId: "p2", dueDate: "2026-11-02", status: "dropped" }),
      item({ id: "n", phaseId: null, dueDate: "2026-10-20" }),
      item({ id: "w", phaseId: "p2", dueDate: "2026-11-10", sortOrder: 0 }),
    ])
  )!;
  assert.deepEqual(
    t.rows.map((r) => (r.kind === "phase" ? `phase:${r.id}` : r.id)),
    ["phase:p1", "a", "b", "phase:p2", "w", "phase:__none", "n"]
  );
  assert.deepEqual(t.unscheduled.map((i) => i.id), ["u"]);
  const a = t.rows.find((r) => r.kind === "item" && r.id === "a") as ItemRow;
  assert.equal(a.endDay - a.startDay, 5); // 3 Oct to 8 Oct inclusive is 6 days, so 5 apart
});

test("arrows go from blocker to waiting item, and conflicts are flagged", () => {
  const t = buildTimeline(
    input([
      item({ id: "a", startDate: "2026-10-01", dueDate: "2026-10-20", sortOrder: 0 }),
      item({ id: "b", startDate: "2026-10-15", dueDate: "2026-10-30", sortOrder: 1, blockedByItemIds: ["a"] }),
      item({ id: "c", startDate: "2026-10-21", dueDate: "2026-10-31", sortOrder: 2, blockedByItemIds: ["a"] }),
      item({ id: "d", startDate: null, dueDate: null, sortOrder: 3 }),
      item({ id: "e", startDate: "2026-10-25", dueDate: "2026-10-28", sortOrder: 4, blockedByItemIds: ["d"] }),
    ])
  )!;
  assert.deepEqual(t.arrows, [
    { fromId: "a", toId: "b", conflict: true },
    { fromId: "a", toId: "c", conflict: false },
  ]);
  assert.equal(t.undatedDependencies, 1); // e waits for d, which has no dates
  assert.equal((t.rows.find((r) => r.kind === "item" && r.id === "b") as ItemRow).conflict, true);
  assert.equal((t.rows.find((r) => r.kind === "item" && r.id === "c") as ItemRow).conflict, false);
});

test("month and week headers tile the whole range", () => {
  const t = buildTimeline(input([item({ id: "a", startDate: "2026-10-05", dueDate: "2026-10-09" })]))!;
  assert.equal(t.months.reduce((n, m) => n + m.days, 0), t.days);
  assert.equal(t.months[0].startDay, 0);
  assert.equal(t.weeks.length, t.days / 7);
  assert.ok(PX_PER_DAY.weeks > PX_PER_DAY.months);
});

test("no dates anywhere means no timeline", () => {
  assert.equal(buildTimeline({ items: [item({ id: "a" })], phases: [], project: { startDate: null, targetDate: null, goLiveDate: null }, today: "2026-10-10" }), null);
});
