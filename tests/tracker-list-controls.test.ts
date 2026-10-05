import test from "node:test";
import assert from "node:assert/strict";
import { ariaSort, matchesDue, nextSort, sortFromValue, sortRows, sortToValue, type ListRow } from "../src/lib/tracker/list-controls";

// 2026-10-07 is a Wednesday, so "this week" ends on Sunday 2026-10-11.
const TODAY = "2026-10-07";

type Row = ListRow & { id: string };
const row = (id: string, o: Partial<Row> = {}): Row => ({
  id,
  title: id,
  status: "not_started",
  ownerName: null,
  phaseId: null,
  dueDate: null,
  sortOrder: 0,
  ...o,
});
const ids = (rows: Row[]) => rows.map((r) => r.id);
const phases = new Map([
  ["scoping", 0],
  ["config", 1],
  ["uat", 2],
]);

test("due filter: overdue only counts open items", () => {
  assert.equal(matchesDue(row("a", { dueDate: "2026-10-06" }), "overdue", TODAY), true);
  assert.equal(matchesDue(row("a", { dueDate: "2026-10-06", status: "done" }), "overdue", TODAY), false);
  assert.equal(matchesDue(row("a", { dueDate: "2026-10-07" }), "overdue", TODAY), false, "due today is not overdue");
  assert.equal(matchesDue(row("a"), "overdue", TODAY), false);
});

test("due filter: this week runs from today to Sunday, next 7 days from today to +7", () => {
  const due = (d: string) => row("a", { dueDate: d });
  assert.equal(matchesDue(due("2026-10-07"), "this_week", TODAY), true);
  assert.equal(matchesDue(due("2026-10-11"), "this_week", TODAY), true);
  assert.equal(matchesDue(due("2026-10-12"), "this_week", TODAY), false);
  assert.equal(matchesDue(due("2026-10-06"), "this_week", TODAY), false);
  assert.equal(matchesDue(due("2026-10-14"), "next_7", TODAY), true);
  assert.equal(matchesDue(due("2026-10-15"), "next_7", TODAY), false);
  assert.equal(matchesDue(due("2026-10-06"), "next_7", TODAY), false);
  assert.equal(matchesDue(row("a"), "this_week", TODAY), false);
});

test("due filter: this week on a Sunday is just that day; none and any", () => {
  assert.equal(matchesDue(row("a", { dueDate: "2026-10-11" }), "this_week", "2026-10-11"), true);
  assert.equal(matchesDue(row("a", { dueDate: "2026-10-12" }), "this_week", "2026-10-11"), false);
  assert.equal(matchesDue(row("a"), "none", TODAY), true);
  assert.equal(matchesDue(row("a", { dueDate: "2026-10-12" }), "none", TODAY), false);
  assert.equal(matchesDue(row("a", { dueDate: "2026-01-01" }), "any", TODAY), true);
});

test("default order is phase by phase, then the order items were added", () => {
  const rows = [row("c", { phaseId: "uat", sortOrder: 0 }), row("none", { sortOrder: 0 }), row("b", { phaseId: "scoping", sortOrder: 2 }), row("a", { phaseId: "scoping", sortOrder: 1 })];
  assert.deepEqual(ids(sortRows(rows, null, phases)), ["a", "b", "c", "none"]);
});

test("item sorts A to Z and Z to A, ignoring case and reading numbers as numbers", () => {
  const rows = [row("x", { title: "banana" }), row("y", { title: "Apple" }), row("z", { title: "step 10" }), row("w", { title: "step 2" })];
  assert.deepEqual(rows.length, 4);
  assert.deepEqual(sortRows(rows, { key: "item", dir: "asc" }, phases).map((r) => r.title), ["Apple", "banana", "step 2", "step 10"]);
  assert.deepEqual(sortRows(rows, { key: "item", dir: "desc" }, phases).map((r) => r.title), ["step 10", "step 2", "banana", "Apple"]);
});

test("status sorts in project order, not alphabetically", () => {
  const rows = [row("d", { status: "done" }), row("n", { status: "not_started" }), row("w", { status: "waiting_on_client" }), row("p", { status: "in_progress" })];
  assert.deepEqual(ids(sortRows(rows, { key: "status", dir: "asc" }, phases)), ["n", "p", "w", "d"]);
  assert.deepEqual(ids(sortRows(rows, { key: "status", dir: "desc" }, phases)), ["d", "w", "p", "n"]);
});

test("owner and due put empty values last in both directions", () => {
  const rows = [row("none"), row("zed", { ownerName: "Zed", dueDate: "2026-11-01" }), row("amy", { ownerName: "amy", dueDate: "2026-10-01" })];
  assert.deepEqual(ids(sortRows(rows, { key: "owner", dir: "asc" }, phases)), ["amy", "zed", "none"]);
  assert.deepEqual(ids(sortRows(rows, { key: "owner", dir: "desc" }, phases)), ["zed", "amy", "none"]);
  assert.deepEqual(ids(sortRows(rows, { key: "due", dir: "asc" }, phases)), ["amy", "zed", "none"]);
  assert.deepEqual(ids(sortRows(rows, { key: "due", dir: "desc" }, phases)), ["zed", "amy", "none"]);
});

test("phase sorts in the project's phase order, no phase last", () => {
  const rows = [row("none"), row("u", { phaseId: "uat" }), row("s", { phaseId: "scoping" }), row("c", { phaseId: "config" })];
  assert.deepEqual(ids(sortRows(rows, { key: "phase", dir: "asc" }, phases)), ["s", "c", "u", "none"]);
  assert.deepEqual(ids(sortRows(rows, { key: "phase", dir: "desc" }, phases)), ["u", "c", "s", "none"]);
});

test("ties keep the default order, and sorting never changes the input", () => {
  const rows = [row("b", { status: "done", sortOrder: 2 }), row("a", { status: "done", sortOrder: 1 })];
  const copy = [...rows];
  assert.deepEqual(ids(sortRows(rows, { key: "status", dir: "desc" }, phases)), ["a", "b"]);
  assert.deepEqual(rows, copy);
});

test("clicking a header cycles ascending, descending, default; another header starts over", () => {
  let s = nextSort(null, "due");
  assert.deepEqual(s, { key: "due", dir: "asc" });
  s = nextSort(s, "due");
  assert.deepEqual(s, { key: "due", dir: "desc" });
  assert.equal(nextSort(s, "due"), null);
  assert.deepEqual(nextSort(s, "owner"), { key: "owner", dir: "asc" });
  assert.equal(ariaSort({ key: "due", dir: "desc" }, "due"), "descending");
  assert.equal(ariaSort({ key: "due", dir: "desc" }, "owner"), "none");
});

test("phone sort menu values round-trip and bad values mean the default order", () => {
  assert.equal(sortToValue({ key: "owner", dir: "desc" }), "owner:desc");
  assert.deepEqual(sortFromValue("owner:desc"), { key: "owner", dir: "desc" });
  assert.equal(sortFromValue("default"), null);
  assert.equal(sortFromValue("bogus:asc"), null);
  assert.equal(sortToValue(null), "default");
});
