import test from "node:test";
import assert from "node:assert/strict";
import { dueKind, initials } from "../src/lib/tracker/row-display";

const TODAY = "2026-10-17";

test("dueKind: open items are over, soon (within 7 days) or ok", () => {
  assert.equal(dueKind({ status: "in_progress", dueDate: "2026-10-16" }, TODAY), "over");
  assert.equal(dueKind({ status: "not_started", dueDate: "2026-10-17" }, TODAY), "soon");
  assert.equal(dueKind({ status: "blocked", dueDate: "2026-10-24" }, TODAY), "soon");
  assert.equal(dueKind({ status: "waiting_on_client", dueDate: "2026-10-25" }, TODAY), "ok");
});

test("dueKind: no date is none, finished items are closed even when the date has passed", () => {
  assert.equal(dueKind({ status: "not_started", dueDate: null }, TODAY), "none");
  assert.equal(dueKind({ status: "done", dueDate: "2026-09-01" }, TODAY), "closed");
  assert.equal(dueKind({ status: "dropped", dueDate: "2026-10-18" }, TODAY), "closed");
});

test("initials: first and last word, ignoring bracketed notes and punctuation", () => {
  assert.equal(initials("Ana Reyes (demo)"), "AR");
  assert.equal(initials("Demo Solutions Engineer"), "DE");
  assert.equal(initials("cher"), "C");
  assert.equal(initials("  jean-luc  picard "), "JP");
  assert.equal(initials("Émile Zola"), "ÉZ");
  assert.equal(initials(null), "");
  assert.equal(initials("(demo)"), "");
});
