import test from "node:test";
import assert from "node:assert/strict";
import { assignLanes, laneSummaries, moveLane, renameLane, setLaneExternal, setStepLane, stripLanes } from "../src/lib/workflow/process-map/lane-edit";
import { applyLayout } from "../src/lib/workflow/process-map/layout";
import { layoutDiagram } from "../src/lib/workflow/process-map/diagram-layout";
import { buildScene } from "../src/lib/workflow/process-map/scene";
import { lintLayout } from "../src/lib/workflow/process-map/lint";
import { computeDecimalNumbers } from "../src/lib/workflow/numbering-decimal";
import { usesLanes } from "../src/lib/workflow/process-map/lane-mode";
import { integrationMap } from "./fixtures/lanes-fixtures";
import { pilotLike } from "./fixtures/process-map-fixtures";

/* eslint-disable @typescript-eslint/no-explicit-any */
const nums = (nodes: any[], edges: any[]) => [...computeDecimalNumbers(nodes, edges).stepNumbers.entries()].sort();
const findings = (nodes: any[], edges: any[]) => {
  const laid = applyLayout(nodes, edges, layoutDiagram(nodes, edges));
  return lintLayout(buildScene(laid.nodes, laid.edges, { clientName: "C", workflowName: "W", versionLabel: "v1", date: "2026-10-04", author: "T" })).filter((f) => f.severity === "high" || f.severity === "medium");
};

test("lane list: lanes in drawn order with how many steps each holds and which are another system; empty for a single row", () => {
  const { nodes, edges } = integrationMap();
  const lanes = laneSummaries(nodes, edges);
  assert.deepEqual(lanes.map((l) => l.name), ["Candidate", "Talkpush automation", "Assessment platform", "Recruiter", "HRIS"]);
  assert.deepEqual(lanes.filter((l) => l.external).map((l) => l.name), ["Assessment platform", "HRIS"]);
  assert.ok(lanes.every((l) => l.steps > 0));
  assert.deepEqual(laneSummaries(pilotLike().nodes, pilotLike().edges), []);
});

test("switching: a single-row diagram gets lanes from each step's role, and going back removes every trace", () => {
  const { nodes, edges } = pilotLike();
  assert.equal(usesLanes(nodes), false);
  const on = assignLanes(nodes);
  assert.ok(on.touched > 0);
  assert.equal(usesLanes(on.nodes), true);
  assert.deepEqual(nums(on.nodes, edges), nums(nodes, edges), "turning lanes on does not renumber");
  const names = laneSummaries(on.nodes, edges).map((l) => l.name);
  assert.ok(names.includes("Talkpush automation"), "automated steps share one lane");
  assert.deepEqual(findings(on.nodes, edges), []);
  const off = stripLanes(on.nodes);
  assert.equal(usesLanes(off.nodes), false);
  assert.equal(JSON.stringify(off.nodes.map((n: any) => n.data)), JSON.stringify(nodes.map((n: any) => n.data)), "back to exactly the steps it started with");
  assert.equal(assignLanes(on.nodes).touched, 0, "steps that already have a lane keep it");
});

test("switching: outside-system names given when switching are marked", () => {
  const { nodes } = integrationMap();
  const stripped = stripLanes(nodes).nodes;
  const back = assignLanes(stripped, ["Talkpush automation"]);
  assert.ok(back.nodes.some((n: any) => n.data.laneKind === "external"), "the named lane is an outside system");
});

test("rename: every step in the lane moves to the new name, a name another lane has merges them, numbers never change", () => {
  const { nodes, edges } = integrationMap();
  const renamed = renameLane(nodes, "Recruiter", "Hiring team");
  const names = laneSummaries(renamed, edges).map((l) => l.name);
  assert.ok(names.includes("Hiring team") && !names.includes("Recruiter"));
  assert.deepEqual(nums(renamed, edges), nums(nodes, edges));
  assert.deepEqual(findings(renamed, edges), []);
  const merged = laneSummaries(renameLane(nodes, "Recruiter", "talkpush AUTOMATION"), edges);
  assert.equal(merged.filter((l) => l.name.toLowerCase() === "talkpush automation").length, 1, "merged into one lane");
  assert.equal(renameLane(nodes, "Recruiter", "   ").length, nodes.length, "an empty name changes nothing");
  assert.equal(JSON.stringify(renameLane(nodes, "Recruiter", "  ")), JSON.stringify(nodes));
});

test("another system: a whole lane is marked and unmarked, and the lane list and drawing follow", () => {
  const { nodes, edges } = integrationMap();
  const on = setLaneExternal(nodes, "Recruiter", true);
  assert.equal(laneSummaries(on, edges).find((l) => l.name === "Recruiter")!.external, true);
  const off = setLaneExternal(on, "Recruiter", false);
  assert.equal(laneSummaries(off, edges).find((l) => l.name === "Recruiter")!.external, false);
  assert.deepEqual(findings(on, edges), []);
});

test("reorder: a lane moves up or down by one, the ends stay put, and numbers never change", () => {
  const { nodes, edges } = integrationMap();
  const up = moveLane(nodes, edges, "Recruiter", -1);
  const order = laneSummaries(up, edges).map((l) => l.name);
  assert.deepEqual(order, ["Candidate", "Talkpush automation", "Recruiter", "Assessment platform", "HRIS"]);
  assert.deepEqual(nums(up, edges), nums(nodes, edges));
  assert.deepEqual(findings(up, edges), []);
  assert.equal(JSON.stringify(moveLane(nodes, edges, "Candidate", -1)), JSON.stringify(nodes), "the top lane cannot go up");
  assert.equal(JSON.stringify(moveLane(nodes, edges, "HRIS", 1)), JSON.stringify(nodes), "the bottom lane cannot go down");
  const twice = moveLane(up, edges, "Recruiter", 1);
  assert.deepEqual(laneSummaries(twice, edges).map((l) => l.name), ["Candidate", "Talkpush automation", "Assessment platform", "Recruiter", "HRIS"], "and back again");
});

test("step lane: a step moves to an existing lane (taking its outside-system flag) or a new one (named like the rest)", () => {
  const { nodes, edges } = integrationMap();
  const toHris = setStepLane(nodes, "s12", "HRIS");
  const s12 = toHris.find((n: any) => n.id === "s12");
  assert.equal(s12.data.lane, "HRIS");
  assert.equal(s12.data.laneKind, "external", "joining an outside system's lane makes the step part of it");
  const toNew = setStepLane(nodes, "s12", "Legal");
  assert.deepEqual(laneSummaries(toNew, edges).map((l) => l.name).includes("Legal"), true);
  assert.equal(setStepLane(nodes, "s12", "Talkpush").find((n: any) => n.id === "s12").data.lane, "Talkpush automation");
  const out = setStepLane(nodes, "s7", "Recruiter");
  assert.equal(out.find((n: any) => n.id === "s7").data.laneKind, "", "leaving an outside system clears the flag on that step");
  assert.deepEqual(findings(toNew, edges), []);
});
