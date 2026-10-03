import test from "node:test";
import assert from "node:assert/strict";
import { buildOutline, compareStepNumbers, filterOutline, walkChoices, walkStart } from "../src/lib/workflow/outline";
import { computeOverlay, describeOps } from "../src/lib/workflow/suggestion-overlay";
import { computeStepNumbers } from "../src/lib/workflow/numbering";
import { workflowTemplates } from "../src/lib/workflow/template-data";

/* eslint-disable @typescript-eslint/no-explicit-any */

test("outline: step numbers sort the way people read them", () => {
  const sorted = ["10", "2", "3a", "3", "3a.1", "3b", "U1", "1", "3r"].sort(compareStepNumbers);
  assert.deepEqual(sorted, ["1", "2", "3", "3a", "3a.1", "3b", "3r", "10", "U1"]);
});

test("outline: every real step appears once, annotations never do, entry step comes first", () => {
  const t = workflowTemplates.find((x) => x.name === "Interview scheduling and no-show recovery")!;
  const nodes = [...(t.nodes as any[]), { id: "note1", type: "annotation", position: { x: 0, y: 0 }, data: { isAnnotation: true, label: "A note" } }];
  const { stepNumbers } = computeStepNumbers(nodes, t.edges as any[]);
  const items = buildOutline(nodes, stepNumbers);
  assert.equal(items.length, (t.nodes as any[]).length);
  assert.ok(!items.some((i) => i.nodeId === "note1"));
  assert.equal(items[0].number, "", "the unnumbered source channel leads");
  const numbered = items.filter((i) => i.number && !i.number.startsWith("U")).map((i) => i.number);
  assert.deepEqual([...numbered], [...numbered].sort(compareStepNumbers));
  assert.equal(items.find((i) => i.number === "1")?.depth, 0);
});

test("outline: search looks at the label, notes, role and number", () => {
  const items = buildOutline(
    [
      { id: "a", type: "stage", position: { x: 0, y: 0 }, data: { label: "Prescreening", type: "stage", notes: "asks 5 questions", actorLabel: "Chatbot" } },
      { id: "b", type: "stage", position: { x: 0, y: 0 }, data: { label: "Interview", type: "stage", notes: "", actorLabel: "Recruiter" } },
    ],
    new Map([["a", "1"], ["b", "2"]])
  );
  assert.deepEqual(filterOutline(items, "recruiter").map((i) => i.nodeId), ["b"]);
  assert.deepEqual(filterOutline(items, "QUESTIONS").map((i) => i.nodeId), ["a"]);
  assert.deepEqual(filterOutline(items, "2").map((i) => i.nodeId), ["b"]);
  assert.equal(filterOutline(items, "  ").length, 2);
});

test("walk-through: the main path is first, failure paths later, loops last; the start is the entry step", () => {
  const edges = [
    { id: "e1", source: "d", target: "fail", data: { pathSemantic: "failure", label: "No" } },
    { id: "e2", source: "d", target: "back", data: { pathSemantic: "recovery" } },
    { id: "e3", source: "d", target: "yes", data: { isPrimary: true, label: "Yes" } },
    { id: "e4", source: "d", target: "other", data: {} },
  ];
  const choices = walkChoices("d", edges);
  assert.deepEqual(choices.map((c) => c.targetId), ["yes", "other", "fail", "back"]);
  assert.equal(choices[0].isMain, true);
  assert.equal(choices[0].label, "Yes");
  assert.deepEqual(walkChoices("nothing", edges), []);

  const nodes = [
    { id: "s", type: "source", data: { label: "Start" } },
    { id: "a", type: "stage", data: { label: "A" } },
  ];
  assert.equal(walkStart(nodes, [{ id: "x", source: "s", target: "a" }], new Map([["a", "1"]])), "s");
  assert.equal(walkStart([], [], new Map()), null);
});

test("suggestion overlay: shows what would be added, removed, edited and moved", () => {
  const nodes = [
    { id: "a", data: { label: "A", notes: "" }, position: { x: 0, y: 0 } },
    { id: "b", data: { label: "B", notes: "" }, position: { x: 0, y: 0 } },
    { id: "c", data: { label: "C", notes: "" }, position: { x: 0, y: 0 } },
  ];
  const ops: any[] = [
    { op: "addNode", pageId: "p1", node: { id: "n1", data: { label: "New" }, position: { x: 1, y: 1 } } },
    { op: "addEdge", pageId: "p1", edge: { id: "e1", source: "a", target: "n1" } },
    { op: "deleteNode", pageId: "p1", nodeId: "b" },
    { op: "moveNode", pageId: "p1", nodeId: "c", position: { x: 5, y: 5 } },
    { op: "updateNode", pageId: "p1", nodeId: "a", patch: { label: "A2" } },
    { op: "deleteEdge", pageId: "p1", edgeId: "old" },
    { op: "moveNode", pageId: "other-page", nodeId: "a", position: { x: 9, y: 9 } },
  ];
  const o = computeOverlay("p1", nodes, [{ id: "s1", ops }]);
  assert.equal(o.addedNodes.length, 1);
  assert.deepEqual(o.nodeMarks.get("b"), ["deleted"]);
  assert.deepEqual(o.nodeMarks.get("c"), ["moved"]);
  assert.deepEqual(o.nodeMarks.get("a"), ["edited"]);
  assert.deepEqual(o.movedTo.get("c"), { x: 5, y: 5 });
  assert.deepEqual(o.textChanges.get("a"), { label: ["A", "A2"] });
  assert.equal(o.addedEdges.length, 1);
  assert.ok(o.deletedEdgeIds.has("old"));
  assert.equal(o.movedTo.has("a"), false, "other pages are ignored");
  assert.equal(describeOps(ops), "1 step added, 1 step edited, 2 steps moved, 1 step removed, 1 connector added, 1 connector removed");
  assert.equal(describeOps([]), "No changes");
});
