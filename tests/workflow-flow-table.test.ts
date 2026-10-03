import test from "node:test";
import assert from "node:assert/strict";
import { deriveFlowTable, flowTableCsv } from "../src/lib/workflow/process-map/flow-table";
import { myPalLike, pilotLike } from "./fixtures/process-map-fixtures";

test("flow table: columns are Step, Actor, Action, Action Type, Branch / Condition", () => {
  const { nodes, edges } = pilotLike();
  const t = deriveFlowTable(nodes, edges);
  assert.deepEqual(t.columns, ["Step", "Actor", "Action", "Action Type", "Branch / Condition"]);
});

test("flow table: rows follow the diagram's numbering, with circled numerals on the main path", () => {
  const { nodes, edges } = pilotLike();
  const t = deriveFlowTable(nodes, edges);
  assert.deepEqual(t.rows.map((r) => r.step), ["1", "2", "3", "4", "4.1", "5", "6", "6.1", "7"]);
  assert.equal(t.rows[0].stepDisplay, "①");
  assert.equal(t.rows.find((r) => r.step === "4.1")!.stepDisplay, "4.1");
});

test("flow table: actor words, action types, and what each branch starts with", () => {
  const { nodes, edges } = pilotLike();
  const t = deriveFlowTable(nodes, edges);
  const row = (id: string) => t.rows.find((r) => r.nodeId === id)!;
  assert.equal(row("t1").actor, "Talkpush");
  assert.equal(row("t1").actionType, "Message");
  assert.equal(row("t2").actor, "Candidate");
  assert.equal(row("t2").actionType, "Candidate");
  assert.equal(row("t6").actor, "Recruiter");
  assert.equal(row("t6").actionType, "", "a genuinely manual step has no action type");
  assert.equal(row("t4").actionType, "", "a decision has no action type");
  assert.equal(row("t5").branch, "4.1 · No", "the first step of a branch says what starts it");
  assert.equal(row("t8").actionType, "Move");
});

test("flow table: roles outside the standard four are listed so they are noticed, not rejected", () => {
  const { nodes, edges } = myPalLike();
  const t = deriveFlowTable(nodes, edges);
  assert.ok(t.unusualActors.some((u) => u.actor === "REPORTER" || u.actor === "HANDLER"));
  assert.ok(t.rows.length > 20);
});

test("flow table: CSV opens in Excel and quotes commas", () => {
  const { nodes, edges } = pilotLike();
  nodes.find((n) => n.id === "t1")!.data.label = 'Send link, then "remind"';
  const csv = flowTableCsv(deriveFlowTable(nodes, edges));
  assert.ok(csv.startsWith("﻿Step,Actor,Action,Action Type,Branch / Condition\r\n"));
  assert.ok(csv.includes('"Send link, then ""remind"""'));
  assert.equal(csv.trim().split("\r\n").length, 10);
});
