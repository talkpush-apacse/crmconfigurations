import test from "node:test";
import assert from "node:assert/strict";
import { computeLaneGrid, LANE } from "../src/lib/workflow/process-map/lanes";
import { usesLanes } from "../src/lib/workflow/process-map/lane-mode";
import { integrationMap, threeActorMap } from "./fixtures/lanes-fixtures";
import { pilotLike, myPalLike } from "./fixtures/process-map-fixtures";

/* eslint-disable @typescript-eslint/no-explicit-any */
test("lanes mode: only a diagram whose steps carry lanes is drawn as lanes", () => {
  assert.equal(usesLanes(integrationMap().nodes), true);
  assert.equal(usesLanes(pilotLike().nodes), false);
  assert.equal(usesLanes(myPalLike().nodes), false);
  // a lane on a note alone does not switch a diagram to lanes
  const n = pilotLike().nodes.map((x: any) => (x.type === "note" ? { ...x, data: { ...x.data, lane: "X" } } : x));
  assert.equal(usesLanes(n), false);
});

test("grid: lanes come from the steps in the order they first act, outside systems are marked, nothing is a fixed list", () => {
  const { nodes, edges } = integrationMap();
  const g = computeLaneGrid(nodes, edges);
  assert.deepEqual(g.laneOrder, ["Candidate", "Talkpush automation", "Assessment platform", "Recruiter", "HRIS"]);
  assert.deepEqual([...g.externalLanes].sort(), ["assessment platform", "hris"]);
  const t = computeLaneGrid(threeActorMap().nodes, threeActorMap().edges);
  assert.deepEqual(t.laneOrder, ["Candidate", "HR", "Talkpush"], "a client's own roles become lanes");
});

test("grid: stages are bands in order of first appearance, and a step without a stage continues the one before", () => {
  const { nodes, edges } = integrationMap();
  const g = computeLaneGrid(nodes, edges);
  assert.deepEqual(g.stages.map((s) => s.title), ["1. Apply and screen", "2. Assessment", "3. Interview and offer", "4. Hire"]);
  assert.equal(g.cell.get("d3")!.stage, 0, "no stage of its own: stays in stage 1");
  assert.equal(g.cell.get("s7")!.stage, 1);
  assert.equal(g.cell.get("t3")!.stage, 1);
  assert.equal(g.cell.get("c2")!.stage, 2);
  assert.equal(g.cell.get("f2")!.stage, 3);
});

test("grid: a lane appears in a stage only where someone acts", () => {
  const g = computeLaneGrid(integrationMap().nodes, integrationMap().edges);
  const names = (i: number) => g.stages[i].lanes.map((l) => l.name);
  assert.deepEqual(names(0), ["Candidate", "Talkpush automation"]);
  assert.deepEqual(names(1), ["Candidate", "Talkpush automation", "Assessment platform"]);
  assert.deepEqual(names(2), ["Candidate", "Talkpush automation", "Recruiter"]);
  assert.deepEqual(names(3), ["Talkpush automation", "Recruiter", "HRIS"], "one stable order across the map: Recruiter acts before the HRIS does");
  assert.equal(g.stages[1].lanes[2].external, true);
  assert.equal(g.stages[3].lanes[2].external, true);
});

test("grid: the main path moves right along the flow; a branch that stays in a lane drops below the fork; an entry sits left of its step", () => {
  const g = computeLaneGrid(integrationMap().nodes, integrationMap().edges);
  const c = (id: string) => g.cell.get(id)!;
  assert.ok(c("s1").col > c("e").col, "the entry channel is left of the first step");
  assert.equal(c("e").lane, "Candidate");
  assert.ok(c("s2").col > c("s1").col && c("d3").col > c("s2").col && c("s4").col > c("d3").col);
  assert.equal(c("r1").col, c("d3").col, "the No branch drops under the decision");
  assert.equal(c("r1").sub, c("d3").sub + 1);
  assert.ok(c("r2").col > c("r1").col && c("r2").sub === c("r1").sub, "and carries on along its own row");
  assert.ok(c("s7").col > c("s6").col, "a step in another lane goes right, not down");
  assert.notEqual(c("s6").lane, c("s7").lane);
});

test("grid: stage changes get a 'continues in' marker and a matching 'from' marker, shared per step", () => {
  const g = computeLaneGrid(integrationMap().nodes, integrationMap().edges);
  const out = g.markers.filter((m) => m.kind === "out");
  const inn = g.markers.filter((m) => m.kind === "in");
  assert.equal(out.length, 3);
  assert.equal(inn.length, 3);
  assert.deepEqual(out.map((m) => m.text).sort(), ["Continues in|2. Assessment", "Continues in|3. Interview…", "Continues in|4. Hire"]);
  assert.deepEqual([...g.crossings.keys()].sort(), ["m13", "m4", "m9"], "only connectors that change stage");
});

test("grid: no two things share a cell, and a diagram with no stages is one untitled band", () => {
  const g = computeLaneGrid(integrationMap().nodes, integrationMap().edges);
  const seen = new Set<string>();
  for (const [id, c] of g.cell) {
    const k = `${c.stage}|${c.lane}|${c.col}|${c.sub}`;
    assert.ok(!seen.has(k), `${id} shares a cell`);
    seen.add(k);
  }
  for (const m of g.markers) {
    const k = `${m.cell.stage}|${m.cell.lane}|${m.cell.col}|${m.cell.sub}`;
    assert.ok(!seen.has(k), `${m.id} shares a cell`);
    seen.add(k);
  }
  const t = computeLaneGrid(threeActorMap().nodes, threeActorMap().edges);
  assert.equal(t.hasTitles, false);
  assert.equal(t.stages.length, 1);
  assert.equal(t.markers.length, 0);
});

test("grid: a step with no lane of its own takes one from its role, and the grid is deterministic", () => {
  const { nodes, edges } = threeActorMap();
  const stripped = nodes.map((n: any) => (n.id === "c" ? { ...n, data: { ...n.data, lane: undefined } } : n));
  const g = computeLaneGrid(stripped, edges);
  assert.equal(g.laneOf.get("c"), "Talkpush automation", "an automated step with no lane falls back to the one automated lane");
  assert.equal(JSON.stringify([...computeLaneGrid(nodes, edges).center]), JSON.stringify([...computeLaneGrid(nodes, edges).center]));
  assert.ok(LANE.colPitch > 0);
});

// ---------- layout, scene, checks, numbering ----------
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyLayout, layoutProcessMap } from "../src/lib/workflow/process-map/layout";
import { layoutDiagram } from "../src/lib/workflow/process-map/diagram-layout";
import { layoutLanes } from "../src/lib/workflow/process-map/lanes";
import { buildScene } from "../src/lib/workflow/process-map/scene";
import { lintLayout } from "../src/lib/workflow/process-map/lint";
import { computeDecimalNumbers } from "../src/lib/workflow/numbering-decimal";
import { SceneSvg } from "../src/components/workflow/process-map/shapes";

const meta = { clientName: "Sample", workflowName: "Lanes", versionLabel: "v1", date: "2026-10-04", author: "Talkpush" };
const laidOut = (m: { nodes: any[]; edges: any[] }) => applyLayout(m.nodes, m.edges, layoutDiagram(m.nodes, m.edges));
const sceneFor = (m: { nodes: any[]; edges: any[] }, over: Record<string, unknown> = {}) => {
  const l = laidOut(m);
  return buildScene(l.nodes, l.edges, { ...meta, ...over });
};
const overlap = (a: any, b: any) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("layout: a diagram without lanes gets exactly the single-row layout it always had", () => {
  for (const make of [pilotLike, myPalLike]) {
    const { nodes, edges } = make();
    const a = layoutDiagram(nodes, edges);
    const b = layoutProcessMap(nodes, edges);
    assert.equal(JSON.stringify([...a.positions]), JSON.stringify([...b.positions]));
    assert.equal(JSON.stringify([...a.edges]), JSON.stringify([...b.edges]));
  }
});

test("layout: every step is placed, nothing overlaps, and each step sits inside a row of its own lane", () => {
  const m = integrationMap();
  const scene = sceneFor(m);
  const flow = scene.shapes;
  assert.equal(flow.length, m.nodes.length, "every step and note is drawn");
  for (let i = 0; i < flow.length; i++) for (let j = i + 1; j < flow.length; j++) assert.ok(!overlap(flow[i].rect, flow[j].rect), `${flow[i].id} / ${flow[j].id}`);
  const rows = scene.containers.filter((c) => c.kind === "lane");
  for (const s of flow) {
    if (s.kind === "note") continue;
    const lane = scene.laneOf!.get(s.id)!;
    const cx = s.rect.x + s.rect.w / 2;
    const cy = s.rect.y + s.rect.h / 2;
    assert.ok(rows.some((r) => r.title === lane && cy >= r.rect.y && cy <= r.rect.y + r.rect.h && cx >= r.rect.x && cx <= r.rect.x + r.rect.w), `${s.id} is in its "${lane}" row`);
  }
});

test("layout: laying out twice changes nothing", () => {
  const m = integrationMap();
  const once = laidOut(m);
  const twice = applyLayout(once.nodes, once.edges, layoutLanes(once.nodes, once.edges));
  assert.equal(JSON.stringify(once.nodes.map((n: any) => [n.id, n.position])), JSON.stringify(twice.nodes.map((n: any) => [n.id, n.position])));
});

test("numbering: lane maps keep the same numbers however the steps are laid out or moved", () => {
  const m = integrationMap();
  const base = computeDecimalNumbers(m.nodes, m.edges);
  const laid = laidOut(m);
  const after = computeDecimalNumbers(laid.nodes, laid.edges);
  assert.deepEqual([...after.stepNumbers.entries()].sort(), [...base.stepNumbers.entries()].sort(), "laying out does not renumber");
  const scrambled = m.nodes.map((n: any, i: number) => ({ ...n, position: { x: (i * 977) % 3000, y: (i * 613) % 2000 } }));
  const moved = computeDecimalNumbers(scrambled, m.edges);
  assert.deepEqual([...moved.stepNumbers.entries()].sort(), [...base.stepNumbers.entries()].sort(), "moving steps does not renumber");
  assert.equal(base.stepNumbers.get("r1"), "3.1");
  assert.equal(base.edgeLabels.get("b1"), "3.1 · No");
});

test("scene: stage bands, lane rows and stage markers replace the classic frames; outside systems are blue and dashed", () => {
  const scene = sceneFor(integrationMap());
  const kinds = scene.containers.map((c) => c.kind);
  assert.ok(!kinds.includes("journey") && !kinds.includes("entry"), "no classic frames in a lanes diagram");
  assert.equal(scene.containers.filter((c) => c.kind === "stage").length, 4);
  assert.equal(scene.containers.filter((c) => c.kind === "marker").length, 6);
  const lanes = scene.containers.filter((c) => c.kind === "lane");
  assert.ok(lanes.filter((l) => l.external).every((l) => ["Assessment platform", "HRIS"].includes(l.title)));
  const dashed = scene.edges.filter((e) => e.external).map((e) => e.id).sort();
  assert.deepEqual(dashed, ["b9", "m14", "m15", "m6", "m7"], "exactly the connectors to or from an outside system");
});

test("scene: a connector that changes stage is drawn in two pieces through its markers", () => {
  const scene = sceneFor(integrationMap());
  const e = scene.edges.find((x) => x.id === "m4")!;
  assert.equal(e.extra?.length, 1);
  const m = scene.containers.filter((c) => c.kind === "marker");
  const near = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) => Math.abs(p.x - (r.x + r.w)) < 1 || Math.abs(p.x - r.x) < 1;
  assert.ok(m.some((c) => near(e.points[e.points.length - 1], c.rect)), "the first piece ends at a marker");
  assert.ok(m.some((c) => near(e.extra![0][0], c.rect)), "the second starts at the next marker");
  assert.ok(!scene.edges.find((x) => x.id === "m1")!.extra, "a connector inside a stage is one piece");
});

test("scene: the key explains outside systems, dashed lines and stage circles, and still lists no tags", () => {
  const rows = sceneFor(integrationMap()).legend.rows;
  const keys = rows.map((r) => r.key);
  for (const k of ["external_lane", "external_flow", "stage_jump", "numbers", "end_success", "end_failure", "end_neutral"]) assert.ok(keys.includes(k), k);
  assert.ok(!rows.some((r) => /\[|MOVE|\btags?\b/i.test(r.label)), "no bracket tags or tag icons in the key");
  const plain = sceneFor(pilotLike()).legend.rows.map((r) => r.key);
  assert.ok(!plain.includes("external_lane") && !plain.includes("stage_jump"), "a single-row diagram has none of these lines");
});

test("checks: the lanes diagram has no serious findings; the single-row rules do not misfire on it", () => {
  const findings = lintLayout(sceneFor(integrationMap()));
  assert.deepEqual(findings.filter((f) => f.severity === "high" || f.severity === "medium"), [], JSON.stringify(findings));
  assert.ok(!findings.some((f) => f.code === "fork_mixed_connectors" || f.code === "entry_row_mismatch"));
});

test("checks: a step dragged out of its lane is reported, and so is a stage with too many lanes", () => {
  const m = laidOut(integrationMap());
  const dragged = m.nodes.map((n: any) => (n.id === "s2" ? { ...n, position: { x: n.position.x, y: n.position.y + 20000 } } : n));
  const f = lintLayout(buildScene(dragged, m.edges, meta));
  assert.ok(f.some((x) => x.code === "step_outside_lane" && x.nodeId === "s2"));
  const many = ["A", "B", "C", "D", "E", "F", "G"].map((l, i) => ({ ...integrationMap().nodes[1], id: `x${i}`, data: { ...integrationMap().nodes[1].data, lane: l, stage: undefined } }));
  const edges = many.slice(1).map((n: any, i: number) => ({ id: `e${i}`, source: many[i].id, target: n.id, type: "custom", data: { label: "" } }));
  const g = buildScene(applyLayout(many, edges, layoutDiagram(many, edges)).nodes, edges, meta);
  assert.ok(lintLayout(g).some((x) => x.code === "too_many_lanes"));
});

test("render: the drawing shows stage titles, lane names, the outside-system caption, markers and dashed blue data lines", () => {
  const svg = renderToStaticMarkup(createElement(SceneSvg, { scene: sceneFor(integrationMap()) }));
  for (const word of ["1. Apply and screen", "4. Hire", "Talkpush automation", "Assessment platform", "HRIS", "another system", "Continues in", "From", "Ends successfully"]) assert.ok(svg.includes(word), word);
  assert.ok(svg.includes('stroke-dasharray="7 5"') && svg.includes("#1565C0"), "dashed blue connectors");
  assert.ok(svg.includes("pm-arrow-ext"));
});

test("render: hiding the numbers works in lanes too", () => {
  const svg = renderToStaticMarkup(createElement(SceneSvg, { scene: sceneFor(integrationMap(), { hideNumbers: true }) }));
  assert.ok(!svg.includes("①") && !svg.includes("3.1 · No"));
});
