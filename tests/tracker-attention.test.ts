import test from "node:test";
import assert from "node:assert/strict";
import { attentionIsUrgent, attentionItems, attentionKind, type AttentionRow } from "../src/lib/tracker/attention";
import { dateBar, statusCounts } from "../src/lib/tracker/project-strip";

const TODAY = "2026-10-17";
const row = (id: string, o: Partial<AttentionRow> = {}): AttentionRow => ({ id, title: id, status: "not_started", dueDate: null, ...o });

test("attentionKind: one reason per item, worst first", () => {
  assert.equal(attentionKind(row("a", { status: "blocked", dueDate: "2026-10-01" }), TODAY), "blocked");
  assert.equal(attentionKind(row("b", { status: "in_progress", dueDate: "2026-10-16" }), TODAY), "overdue");
  assert.equal(attentionKind(row("c", { status: "waiting_on_client", dueDate: "2026-10-16" }), TODAY), "overdue");
  assert.equal(attentionKind(row("d", { status: "waiting_on_client" }), TODAY), "waiting");
  assert.equal(attentionKind(row("e", { dueDate: "2026-10-17" }), TODAY), "due_soon");
  assert.equal(attentionKind(row("f", { dueDate: "2026-10-24" }), TODAY), "due_soon");
});

test("attentionKind: far-off, undated, closed and archived items are quiet", () => {
  assert.equal(attentionKind(row("a", { dueDate: "2026-10-25" }), TODAY), null);
  assert.equal(attentionKind(row("b"), TODAY), null);
  assert.equal(attentionKind(row("c", { status: "done", dueDate: "2026-10-01" }), TODAY), null);
  assert.equal(attentionKind(row("d", { status: "dropped", dueDate: "2026-10-01" }), TODAY), null);
  assert.equal(attentionKind(row("e", { status: "blocked", archived: true }), TODAY), null);
});

test("attentionItems: ordered blocked, overdue (most late first), waiting, due soon", () => {
  const list = attentionItems(
    [
      row("soon", { dueDate: "2026-10-20" }),
      row("wait", { status: "waiting_on_client" }),
      row("late1", { dueDate: "2026-10-16" }),
      row("late5", { dueDate: "2026-10-12" }),
      row("block", { status: "blocked" }),
      row("fine"),
    ],
    TODAY
  );
  assert.deepEqual(
    list.map((a) => a.item.id),
    ["block", "late5", "late1", "wait", "soon"]
  );
  assert.equal(list[1].lateDays, 5);
});

test("attentionIsUrgent: red only for blocked or overdue", () => {
  assert.equal(attentionIsUrgent([{ kind: "waiting" }, { kind: "due_soon" }]), false);
  assert.equal(attentionIsUrgent([{ kind: "waiting" }, { kind: "overdue" }]), true);
  assert.equal(attentionIsUrgent([{ kind: "blocked" }]), true);
  assert.equal(attentionIsUrgent([]), false);
});

test("statusCounts: leaves out dropped and archived items", () => {
  const c = statusCounts([
    { status: "done" },
    { status: "done" },
    { status: "in_progress" },
    { status: "blocked" },
    { status: "waiting_on_client" },
    { status: "not_started" },
    { status: "dropped" },
    { status: "done", archived: true },
  ]);
  assert.deepEqual(c, { done: 2, in_progress: 1, waiting_on_client: 1, blocked: 1, not_started: 1 });
});

test("dateBar: on time, the fill reaches today and nothing is red", () => {
  const bar = dateBar({ start: "2026-09-29", target: "2026-10-29", today: "2026-10-14", finished: false });
  assert.ok(bar);
  assert.equal(bar.overDays, 0);
  assert.equal(bar.overPct, 0);
  assert.equal(Math.round(bar.fillPct), 50);
  assert.equal(bar.targetPct, 100);
});

test("dateBar: past the target shows the overrun in days and a red stretch", () => {
  const bar = dateBar({ start: "2026-09-29", target: "2026-10-15", today: "2026-10-17", finished: false });
  assert.ok(bar);
  assert.equal(bar.overDays, 2);
  assert.ok(bar.overPct > 0);
  assert.equal(Math.round(bar.tickPct), 100);
  assert.ok(Math.abs(bar.fillPct + bar.overPct - bar.tickPct) < 0.001);
});

test("dateBar: a finished project is never marked late, and missing dates draw nothing", () => {
  assert.equal(dateBar({ start: "2026-09-29", target: "2026-10-15", today: "2026-10-17", finished: true })?.overDays, 0);
  assert.equal(dateBar({ start: null, target: "2026-10-15", today: TODAY, finished: false }), null);
  assert.equal(dateBar({ start: "2026-09-29", target: null, today: TODAY, finished: false }), null);
});
