import test from "node:test";
import assert from "node:assert/strict";
import { chooseLayout, graphFromFlowTable, type FlowRowInput } from "../src/lib/workflow/flow-table-import";
import { deriveFlowTable, flowTableCsv } from "../src/lib/workflow/process-map/flow-table";
import { runGapCheck } from "../src/lib/workflow/gap-check";
import { processMapFields } from "../src/lib/workflow/helpers";
import { integrationMap } from "./fixtures/lanes-fixtures";
import { pilotLike } from "./fixtures/process-map-fixtures";

/* eslint-disable @typescript-eslint/no-explicit-any */
const R = (step: string, actor: string, action: string, extra: Partial<FlowRowInput> = {}): FlowRowInput => ({ step, actor, action, ...extra });
const TWO = [R("1", "Candidate", "Applies"), R("2", "Talkpush", "Prescreens"), R("3", "Talkpush", "Done", { kind: "end", endKind: "success" })];
const THREE = [R("1", "Candidate", "Applies"), R("2", "Talkpush", "Prescreens"), R("3", "Recruiter", "Reviews")];

test("layout choice: 3 or more actors, an outside system, or stages give lanes; otherwise the classic single row", () => {
  assert.equal(chooseLayout(TWO).layout, "spine");
  assert.match(chooseLayout(TWO).reason, /Single row.*2 actors.*no outside system.*no stages/);
  const three = chooseLayout(THREE);
  assert.equal(three.layout, "lanes");
  assert.match(three.reason, /3 different actors \(Candidate, Talkpush, Recruiter\)/);
  const withHris = [...TWO.slice(0, 2), R("3", "HRIS", "Creates the record")];
  assert.equal(chooseLayout(withHris, { externalLanes: ["HRIS"] }).layout, "lanes", "an outside system alone is enough");
  const unused = chooseLayout(TWO, { externalLanes: ["HRIS"] });
  assert.equal(unused.layout, "spine", "an outside system nobody acts in is not drawn");
  assert.deepEqual(unused.unusedExternal, ["HRIS"], "and it is reported");
  assert.equal(chooseLayout([R("1", "Candidate", "Applies", { stage: "Apply" }), R("2", "Talkpush", "Does it")]).layout, "lanes", "stages alone are enough");
  assert.equal(chooseLayout(TWO.slice(0, 1)).layout, "spine", "one actor stays a single row");
});

test("layout choice: asked for explicitly it wins, and end and jump rows are not counted as actors", () => {
  const forcedSpine = chooseLayout(THREE, { layout: "spine" });
  assert.equal(forcedSpine.layout, "spine");
  assert.match(forcedSpine.reason, /You asked for the single-row layout/);
  assert.equal(chooseLayout(TWO.slice(0, 1), { layout: "lanes" }).layout, "lanes");
  const withEnds = [R("1", "Candidate", "Applies"), R("2", "Talkpush", "Does it"), R("3", "Vendor", "Rejected", { kind: "end" }), R("4", "Other", "Go", { kind: "jump" })];
  assert.equal(chooseLayout(withEnds).layout, "spine");
});

test("layout choice: lane names unify by spelling, and a lane named like the system a Send Data row talks to is an outside system", () => {
  const rows = [R("1", "Candidate", "Applies"), R("2", "talkpush", "Sends details", { actionType: "Send Data", system: "HRIS" }), R("3", "Talkpush", "Receives", { actionType: "Get Data" }), R("4", "Recruiter", "x", { lane: "HRIS" })];
  const c = chooseLayout(rows);
  assert.deepEqual(c.lanes, ["Candidate", "talkpush", "HRIS"], "talkpush and Talkpush are one lane, first spelling kept");
  assert.deepEqual(c.externalLanes, ["HRIS"]);
  assert.equal(c.layout, "lanes");
});

test("rows to steps: lanes carry lane, stage, outside-system flag and order; a single row carries none of them", () => {
  const rows = [
    R("1", "Candidate", "Applies", { stage: "1. Apply" }),
    R("2", "Talkpush", "Sends details", { actionType: "Send Data", system: "Assessment platform" }),
    R("3", "Assessment platform", "Scores", { external: true, stage: "2. Assessment" }),
    R("4", "Talkpush", "Done", { kind: "end", endKind: "success" }),
  ];
  const choice = chooseLayout(rows, { laneOrder: ["Candidate", "Talkpush", "Assessment platform"] });
  const { nodes } = graphFromFlowTable(rows, choice);
  assert.equal(nodes[0].lane, "Candidate");
  assert.equal(nodes[0].stage, "1. Apply");
  assert.equal(nodes[1].lane, "Talkpush");
  assert.equal(nodes[1].data.integrationSystem, "Assessment platform");
  assert.equal(nodes[2].laneKind, "external");
  assert.equal(nodes[2].laneRank, 2);
  assert.equal(nodes[3].lane, undefined, "an end shape takes the lane of the step before it");
  for (const key of ["lane", "stage", "laneKind", "laneRank"]) {
    assert.ok(graphFromFlowTable(rows, chooseLayout(rows, { layout: "spine" })).nodes.every((n: any) => n[key] === undefined), `spine: no ${key}`);
    assert.ok(graphFromFlowTable(rows).nodes.every((n: any) => n[key] === undefined), `no choice given: no ${key}`);
  }
});

test("step fields: lane, stage and the outside-system flag are accepted, trimmed, and cleared by empty text", () => {
  assert.deepEqual(processMapFields({ lane: "  HRIS ", stage: " 4. Hire ", external: true }), { lane: "HRIS", stage: "4. Hire", laneKind: "external" });
  assert.deepEqual(processMapFields({ lane: "", stage: "", external: false }), { lane: "", stage: "", laneKind: "" });
  assert.deepEqual(processMapFields({}), {});
});

test("flow table read back: a lanes map gets Stage and Lane columns (stage shown once per stage); a single-row map reads as before", () => {
  const { nodes, edges } = integrationMap();
  const t = deriveFlowTable(nodes, edges);
  assert.deepEqual(t.columns, ["Stage", "Step", "Lane", "Action", "Action Type", "Channel · When", "Branch / Condition"]);
  assert.deepEqual(t.unusualActors, [], "in lanes any text is a lane");
  assert.equal(t.rows.find((r) => r.nodeId === "s7")!.lane, "Assessment platform");
  assert.deepEqual(t.rows.filter((r) => r.stageStart).map((r) => r.stage), ["1. Apply and screen", "2. Assessment", "3. Interview and offer", "4. Hire"]);
  const csv = flowTableCsv(t).split("\r\n");
  assert.match(csv[0], /Stage,Step,Lane,Action,Action Type,Channel · When,Branch \/ Condition/);
  assert.equal(csv.filter((l) => /^(1\. Apply and screen|2\. Assessment|3\. Interview and offer|4\. Hire),/.test(l)).length, 4);
  const single = deriveFlowTable(pilotLike().nodes, pilotLike().edges);
  assert.deepEqual(single.columns.slice(0, 4), ["Step", "Actor", "Action", "Action Type"]);
  assert.ok(single.rows.every((r) => r.lane === "" && r.stage === "" && !r.stageStart));
});

test("gap check: an outside system that is sent information but returns nothing is asked about; one that returns is not", () => {
  const { nodes, edges } = integrationMap();
  const ask = (e: any[]) => runGapCheck(nodes, e).filter((f) => f.code === "external_lane_no_return");
  assert.equal(ask(edges).length, 0);
  const noReturn = ask(edges.filter((e: any) => e.id !== "m7"));
  assert.equal(noReturn.length, 1);
  assert.match(noReturn[0].message, /Assessment platform/);
  assert.equal(noReturn[0].tier, "nice");
  assert.equal(runGapCheck(pilotLike().nodes, pilotLike().edges).filter((f) => f.code === "external_lane_no_return").length, 0, "single-row maps never ask");
});
