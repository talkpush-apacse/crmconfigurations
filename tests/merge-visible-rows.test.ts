import test from "node:test";
import assert from "node:assert/strict";
import { mergeVisibleRows } from "../src/lib/duplicate-row";

type Row = { id: string; name?: string; deletedAt?: string | null };
const ids = (rows: Row[]) => rows.map((r) => r.id);

test("a reordered visible list is saved in its new order", () => {
  const all: Row[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(ids(mergeVisibleRows(all, [{ id: "c" }, { id: "b" }, { id: "a" }])), ["c", "b", "a"]);
});

test("soft-deleted rows stay in their own slots when the others are reordered", () => {
  const all: Row[] = [{ id: "a" }, { id: "x", deletedAt: "2026-01-01" }, { id: "b" }, { id: "c" }];
  const merged = mergeVisibleRows(all, [{ id: "c" }, { id: "b" }, { id: "a" }]);
  assert.deepEqual(ids(merged), ["c", "x", "b", "a"]);
  assert.equal(merged[1].deletedAt, "2026-01-01");
});

test("an in-place edit keeps the row where it was and takes the new values", () => {
  const all: Row[] = [{ id: "a", name: "old" }, { id: "b" }];
  const merged = mergeVisibleRows(all, [{ id: "a", name: "new" }, { id: "b" }]);
  assert.deepEqual(ids(merged), ["a", "b"]);
  assert.equal(merged[0].name, "new");
});

test("rows the paste created are appended after the existing ones", () => {
  const all: Row[] = [{ id: "a" }, { id: "x", deletedAt: "2026-01-01" }];
  const merged = mergeVisibleRows(all, [{ id: "a", name: "A" }, { id: "n1" }, { id: "n2" }]);
  assert.deepEqual(ids(merged), ["a", "x", "n1", "n2"]);
});

test("a visible list missing a row leaves that row where it was", () => {
  const all: Row[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(ids(mergeVisibleRows(all, [{ id: "c" }, { id: "a" }])), ["c", "b", "a"]);
});

test("duplicate ids fall back to keeping rows in place instead of losing any", () => {
  const all: Row[] = [{ id: "a" }, { id: "a" }, { id: "b" }];
  const merged = mergeVisibleRows(all, [{ id: "b" }, { id: "a" }, { id: "a" }]);
  assert.equal(merged.length, 3);
});
