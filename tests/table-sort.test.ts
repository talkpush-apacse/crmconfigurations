import test from "node:test";
import assert from "node:assert/strict";
import { sortRowsByColumn, restoreRowOrder } from "../src/lib/table-sort";

type Row = { id: string; name?: string; ticked?: boolean };

const names = (rows: Row[]) => rows.map((r) => r.name);

test("sorts A to Z and Z to A, ignoring case", () => {
  const rows: Row[] = [
    { id: "1", name: "cebu" },
    { id: "2", name: "Alabang" },
    { id: "3", name: "Makati" },
  ];
  assert.deepEqual(names(sortRowsByColumn(rows, { key: "name" }, "asc")), ["Alabang", "cebu", "Makati"]);
  assert.deepEqual(names(sortRowsByColumn(rows, { key: "name" }, "desc")), ["Makati", "cebu", "Alabang"]);
});

test("numbers sort as numbers, not as text", () => {
  const rows: Row[] = [
    { id: "1", name: "26" },
    { id: "2", name: "3" },
    { id: "3", name: "10" },
  ];
  assert.deepEqual(names(sortRowsByColumn(rows, { key: "name" }, "asc")), ["3", "10", "26"]);
  assert.deepEqual(names(sortRowsByColumn(rows, { key: "name" }, "desc")), ["26", "10", "3"]);
});

test("blank cells stay at the bottom in both directions", () => {
  const rows: Row[] = [
    { id: "1", name: "" },
    { id: "2", name: "B" },
    { id: "3" },
    { id: "4", name: "A" },
    { id: "5", name: "   " },
  ];
  assert.deepEqual(sortRowsByColumn(rows, { key: "name" }, "asc").map((r) => r.id), ["4", "2", "1", "3", "5"]);
  assert.deepEqual(sortRowsByColumn(rows, { key: "name" }, "desc").map((r) => r.id), ["2", "4", "1", "3", "5"]);
});

test("ties keep their existing order", () => {
  const rows: Row[] = [
    { id: "1", name: "Same" },
    { id: "2", name: "same" },
    { id: "3", name: "Same" },
  ];
  assert.deepEqual(sortRowsByColumn(rows, { key: "name" }, "desc").map((r) => r.id), ["1", "2", "3"]);
});

test("ticked boxes sort after unticked ones", () => {
  const rows: Row[] = [
    { id: "1", ticked: true },
    { id: "2", ticked: false },
    { id: "3", ticked: true },
  ];
  assert.deepEqual(sortRowsByColumn(rows, { key: "ticked" }, "asc").map((r) => r.id), ["2", "1", "3"]);
  assert.deepEqual(sortRowsByColumn(rows, { key: "ticked" }, "desc").map((r) => r.id), ["1", "3", "2"]);
});

test("does not change the array it is given", () => {
  const rows: Row[] = [{ id: "1", name: "b" }, { id: "2", name: "a" }];
  sortRowsByColumn(rows, { key: "name" }, "asc");
  assert.deepEqual(rows.map((r) => r.id), ["1", "2"]);
});

test("undo restores the old order but keeps later edits and new rows", () => {
  const before: Row[] = [
    { id: "1", name: "B" },
    { id: "2", name: "A" },
    { id: "3", name: "C" },
  ];
  const order = before.map((r) => r.id);
  const sorted = sortRowsByColumn(before, { key: "name" }, "asc");
  // Edited row 2 and added row 4 after sorting.
  const later: Row[] = [...sorted.map((r) => (r.id === "2" ? { ...r, name: "A edited" } : r)), { id: "4", name: "New" }];
  const restored = restoreRowOrder(later, order);
  assert.deepEqual(restored.map((r) => r.id), ["1", "2", "3", "4"]);
  assert.equal(restored[1].name, "A edited");
});

test("undo copes with a row that was deleted after sorting", () => {
  const restored = restoreRowOrder<Row>([{ id: "3" }, { id: "1" }], ["1", "2", "3"]);
  assert.deepEqual(restored.map((r) => r.id), ["1", "3"]);
});
