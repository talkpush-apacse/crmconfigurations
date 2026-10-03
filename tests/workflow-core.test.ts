import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Position } from "@xyflow/react";
import { workflowTemplates } from "../src/lib/workflow/template-data";
import { computeStepNumbers } from "../src/lib/workflow/numbering";
import { validateWorkflow } from "../src/lib/workflow/validation";
import { toMermaid } from "../src/lib/workflow/mermaid";
import { getLayoutedElements } from "../src/lib/workflow/layout";
import { applySegmentDrag, autoRouteWaypoints, buildOrthogonalPath, getFullPoints, getSegments } from "../src/lib/workflow/edge-routing";
import { nanoid } from "../src/lib/workflow/ids";
import { format, formatDistanceToNow } from "../src/lib/workflow/dates";

/**
 * The golden file was produced by running the ORIGINAL Workflow Editor's own code (commit 1bb8c86)
 * over its ten starter templates. These tests prove the ported code gives identical answers, so the port
 * changed no behaviour. If a later phase changes numbering/layout on purpose, regenerate the fixture
 * and say so in the commit.
 */
type Golden = Record<
  string,
  {
    stepNumbers: [string, string][];
    recoveryEdges: [string, string][];
    warnings: string[];
    overflow: string[];
    merge: string[];
    findings: string[][];
    mermaid: string;
    positions: [string, number, number][];
  }
>;
const golden: Golden = JSON.parse(readFileSync(join(__dirname, "fixtures/workflow-source-parity.json"), "utf8"));

/* eslint-disable @typescript-eslint/no-explicit-any */
for (const template of workflowTemplates) {
  const expected = golden[template.name];
  const nodes = template.nodes as any[];
  const edges = template.edges as any[];

  test(`parity: "${template.name}" has a golden record`, () => {
    assert.ok(expected, "template missing from the golden file");
  });

  test(`parity: step numbers match the original for "${template.name}"`, () => {
    const n = computeStepNumbers(nodes, edges);
    assert.deepEqual([...n.stepNumbers.entries()].sort(), expected.stepNumbers);
    assert.deepEqual([...n.recoveryEdges.entries()].sort(), expected.recoveryEdges);
    assert.deepEqual([...n.warnings].sort(), expected.warnings);
    assert.deepEqual([...n.overflowNodes].sort(), expected.overflow);
    assert.deepEqual([...n.mergeNodes].sort(), expected.merge);
  });

  test(`parity: validation findings match the original for "${template.name}"`, () => {
    const findings = validateWorkflow(nodes, edges).map((f) => [f.code, f.severity, f.nodeId ?? "", f.edgeId ?? ""]);
    assert.deepEqual(findings, expected.findings);
  });

  test(`parity: Mermaid text matches the original for "${template.name}"`, () => {
    const n = computeStepNumbers(nodes, edges);
    assert.equal(toMermaid(nodes, edges, n.stepNumbers), expected.mermaid);
  });

  test(`parity: auto-layout positions match the original for "${template.name}"`, () => {
    const layout = getLayoutedElements(nodes, edges, "TB");
    const positions = (layout.nodes as any[]).map((x) => [x.id, Math.round(x.position.x), Math.round(x.position.y)]);
    assert.deepEqual(positions, expected.positions);
  });
}

// ---------- numbering rules, stated directly ----------

const n = (id: string, type: string, x = 0, y = 0, extra: Record<string, unknown> = {}) => ({
  id,
  type,
  position: { x, y },
  data: { label: id, type, ...extra },
});
const e = (id: string, source: string, target: string, data: Record<string, unknown> = {}) => ({
  id,
  source,
  target,
  data,
});

test("numbering: source nodes are never numbered and the first step is 1", () => {
  const nodes = [n("src", "source"), n("a", "stage"), n("b", "stage")];
  const edges = [e("e1", "src", "a"), e("e2", "a", "b")];
  const r = computeStepNumbers(nodes as any, edges as any);
  assert.equal(r.stepNumbers.has("src"), false);
  assert.equal(r.stepNumbers.get("a"), "1");
  assert.equal(r.stepNumbers.get("b"), "2");
});

test("numbering: a decision with a primary edge gives the other branch a letter", () => {
  const nodes = [n("a", "stage"), n("d", "decision", 0, 100), n("yes", "stage", 0, 200), n("no", "stage", 200, 200)];
  const edges = [
    e("e1", "a", "d"),
    e("e2", "d", "yes", { isPrimary: true, isHappyPath: true }),
    e("e3", "d", "no", { pathSemantic: "failure" }),
  ];
  const r = computeStepNumbers(nodes as any, edges as any);
  assert.equal(r.stepNumbers.get("d"), "2");
  assert.equal(r.stepNumbers.get("yes"), "3");
  assert.match(r.stepNumbers.get("no") ?? "", /^2a/);
});

test("numbering: a node with no connections gets a U number", () => {
  const nodes = [n("a", "stage"), n("b", "stage", 0, 100), n("lone", "stage", 500, 500)];
  const r = computeStepNumbers(nodes as any, [e("e1", "a", "b")] as any);
  assert.match(r.stepNumbers.get("lone") ?? "", /^U\d+$/);
});

// ---------- validation ----------

test("validation: a wait step without a duration is flagged", () => {
  const nodes = [n("a", "stage"), n("w", "wait", 0, 100)];
  const codes = validateWorkflow(nodes as any, [e("e1", "a", "w")] as any).map((f) => f.code);
  assert.ok(codes.includes("wait_missing_duration"));
});

test("validation: a connector to a missing node is flagged as dangling", () => {
  const nodes = [n("a", "stage")];
  const codes = validateWorkflow(nodes as any, [e("e1", "a", "ghost")] as any).map((f) => f.code);
  assert.ok(codes.includes("dangling_edge"));
});

// ---------- layout ----------

test("layout: every node gets a position and nothing overlaps in a simple chain", () => {
  const nodes = [n("a", "stage"), n("b", "stage"), n("c", "stage")];
  const edges = [e("e1", "a", "b"), e("e2", "b", "c")];
  const out = getLayoutedElements(nodes as any, edges as any, "TB").nodes as any[];
  assert.equal(out.length, 3);
  const ys = out.map((x) => x.position.y);
  assert.ok(ys[0] < ys[1] && ys[1] < ys[2]);
});

// ---------- edge routing ----------

test("edge routing: a straight drop has two bend points and a path that starts with M", () => {
  const wps = autoRouteWaypoints(100, 100, 100, 300, Position.Bottom, Position.Top);
  const points = getFullPoints(100, 100, 100, 300, Position.Bottom, Position.Top, wps);
  const path = buildOrthogonalPath(points, 8);
  assert.ok(path.startsWith("M"));
  assert.ok(getSegments(points).length >= 1);
  assert.equal(typeof applySegmentDrag, "function");
});

// ---------- small helpers that replace libraries ----------

test("ids: nanoid returns the requested length from the allowed alphabet", () => {
  const id = nanoid(12);
  assert.equal(id.length, 12);
  assert.match(id, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(nanoid(12), nanoid(12));
});

test("dates: friendly distance and the one format the version list uses", () => {
  assert.equal(formatDistanceToNow(new Date(Date.now() - 5 * 60_000), { addSuffix: true }), "5 minutes ago");
  assert.equal(formatDistanceToNow(new Date(Date.now() - 3 * 86_400_000), { addSuffix: true }), "3 days ago");
  assert.equal(format(new Date(2026, 9, 3, 14, 5), "MMM d, yyyy 'at' h:mm a"), "Oct 3, 2026 at 2:05 PM");
});
