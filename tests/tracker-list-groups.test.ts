import test from "node:test";
import assert from "node:assert/strict";
import { NO_PHASE_KEY, closedLabel, groupByPhase, shouldFold, type GroupRow } from "../src/lib/tracker/list-groups";

const TODAY = "2026-10-17";
const phases = [
  { id: "p1", name: "Scoping" },
  { id: "p2", name: "Configuration" },
];
const row = (id: string, phaseId: string | null, o: Partial<GroupRow> = {}): GroupRow => ({ id, title: id, status: "not_started", dueDate: null, phaseId, ...o });
const ids = (rows: GroupRow[]) => rows.map((r) => r.id);

test("groups follow the phase order, with No phase last, and empty groups are left out", () => {
  const rows = [row("c", "p2"), row("n", null), row("a", "p1")];
  const groups = groupByPhase(rows, { phases, allItems: rows, today: TODAY, fold: true });
  assert.deepEqual(groups.map((g) => g.key), ["p1", "p2", NO_PHASE_KEY]);
  assert.deepEqual(groups.map((g) => g.name), ["Scoping", "Configuration", "No phase"]);
  assert.equal(groupByPhase([row("a", "p1")], { phases, allItems: rows, today: TODAY, fold: true }).length, 1);
});

test("exceptions come first in a phase, the rest keep their order", () => {
  const rows = [
    row("plain1", "p1"),
    row("soon", "p1", { dueDate: "2026-10-20" }),
    row("plain2", "p1"),
    row("late", "p1", { dueDate: "2026-10-10", status: "in_progress" }),
    row("block", "p1", { status: "blocked" }),
    row("wait", "p1", { status: "waiting_on_client" }),
  ];
  const [g] = groupByPhase(rows, { phases, allItems: rows, today: TODAY, fold: true });
  assert.deepEqual(ids(g.open), ["block", "late", "wait", "soon", "plain1", "plain2"]);
});

test("done and dropped items fold into the closed list when folding is on", () => {
  const rows = [row("a", "p1", { status: "done" }), row("b", "p1"), row("c", "p1", { status: "dropped" })];
  const [folded] = groupByPhase(rows, { phases, allItems: rows, today: TODAY, fold: true });
  assert.deepEqual(ids(folded.open), ["b"]);
  assert.deepEqual(ids(folded.closed), ["a", "c"]);
  const [flat] = groupByPhase(rows, { phases, allItems: rows, today: TODAY, fold: false });
  assert.deepEqual(ids(flat.open), ["a", "b", "c"]);
  assert.deepEqual(flat.closed, []);
});

test("n/total counts the whole phase, not just what the filters leave on screen, and skips dropped and archived", () => {
  const all = [
    row("a", "p1", { status: "done" }),
    row("b", "p1", { status: "done" }),
    row("c", "p1"),
    row("d", "p1", { status: "dropped" }),
    row("e", "p1", { status: "done", archived: true }),
  ];
  const [g] = groupByPhase([all[2]], { phases, allItems: all, today: TODAY, fold: true });
  assert.equal(g.done, 2);
  assert.equal(g.total, 3);
});

test("an item in an unknown phase lands in No phase", () => {
  const rows = [row("x", "gone")];
  assert.deepEqual(groupByPhase(rows, { phases, allItems: rows, today: TODAY, fold: true }).map((g) => g.key), [NO_PHASE_KEY]);
});

test("shouldFold: off for a Done or Dropped filter and while searching", () => {
  assert.equal(shouldFold({ statusFilter: "__all", query: "" }), true);
  assert.equal(shouldFold({ statusFilter: "__open", query: "" }), true);
  assert.equal(shouldFold({ statusFilter: "done", query: "" }), false);
  assert.equal(shouldFold({ statusFilter: "dropped", query: "" }), false);
  assert.equal(shouldFold({ statusFilter: "__all", query: "  sign " }), false);
});

test("closedLabel: done, or closed when any were dropped", () => {
  assert.equal(closedLabel([{ status: "done" }, { status: "done" }]), "2 done");
  assert.equal(closedLabel([{ status: "done" }, { status: "dropped" }]), "2 closed");
});
