import test from "node:test";
import assert from "node:assert/strict";
import { computeDecimalNumbers, computeNumbers } from "../src/lib/workflow/numbering-decimal";
import { circled } from "../src/lib/workflow/process-map/tokens";
import { decision, edge, end, myPalLike, pilotLike, start, step } from "./fixtures/process-map-fixtures";

test("circled numerals follow the skill: 1-20, then 21-35, 36-50, then (51)", () => {
  assert.equal(circled(1), "①");
  assert.equal(circled(20), "⑳");
  assert.equal(circled(21), "㉑");
  assert.equal(circled(35), "㉟");
  assert.equal(circled(36), "㊱");
  assert.equal(circled(50), "㊿");
  assert.equal(circled(51), "(51)");
});

test("decimal numbering: the main path is 1, 2, 3 and the entry channel is not numbered", () => {
  const { nodes, edges } = pilotLike();
  const n = computeDecimalNumbers(nodes, edges);
  assert.equal(n.stepNumbers.has("src"), false, "the start channel has no number");
  assert.deepEqual(
    ["t1", "t2", "t3", "t4", "t6", "t7", "t8"].map((id) => n.stepNumbers.get(id)),
    ["1", "2", "3", "4", "5", "6", "7"]
  );
});

test("decimal numbering: a fork's extra paths carry the fork's number, and every step in the path shares it", () => {
  const { nodes, edges } = pilotLike();
  const n = computeDecimalNumbers(nodes, edges);
  assert.equal(n.stepNumbers.get("t5"), "4.1", "the No-show path off decision 4");
  assert.equal(n.stepNumbers.get("t9"), "6.1", "the Fail path off decision 6");
  assert.equal(n.edgeLabels.get("p4n"), "4.1 · No");
  assert.equal(n.edgeLabels.get("p7n"), "6.1 · Fail");
  assert.equal(n.edgeLabels.has("p4"), false, "the main-path output keeps its plain label");
});

test("decimal numbering: terminators are never numbered, on the main path or in a branch", () => {
  const { nodes, edges } = pilotLike();
  const n = computeDecimalNumbers(nodes, edges);
  for (const id of ["e1", "e2", "e3"]) assert.equal(n.stepNumbers.has(id), false, id);
});

test("decimal numbering: a branch with several steps gives each the same number", () => {
  const nodes = [start("s", "Go"), step("a", "A"), decision("d", "D"), step("b1", "B1"), step("b2", "B2"), step("b3", "B3"), step("c", "C"), end("e", "End", "success"), end("x", "Out", "failure")];
  const edges = [
    edge("1", "s", "a"), edge("2", "a", "d", "", { isPrimary: true }), edge("3", "d", "c", "Yes", { isPrimary: true }),
    edge("4", "d", "b1", "No"), edge("5", "b1", "b2"), edge("6", "b2", "b3"), edge("7", "b3", "x"), edge("8", "c", "e"),
  ];
  const n = computeDecimalNumbers(nodes, edges);
  assert.deepEqual(["b1", "b2", "b3"].map((id) => n.stepNumbers.get(id)), ["2.1", "2.1", "2.1"], "the number names the branch, not the position");
  assert.equal(n.stepNumbers.get("c"), "3");
});

test("decimal numbering: a fork inside a branch numbers every path of it (11.1 -> 11.1.1, 11.1.2)", () => {
  const { nodes, edges } = myPalLike();
  const n = computeDecimalNumbers(nodes, edges);
  const k = (id: string) => n.stepNumbers.get(id);
  // the decision that forks 3 ways on the main path: d11 is the Nth numbered main-path step
  const d11 = Number(k("d11"));
  assert.ok(Number.isInteger(d11) && d11 > 5);
  const needsInfo = [k("p11a"), k("p11b"), k("p11c")].sort();
  assert.deepEqual(needsInfo, [`${d11}.1`, `${d11}.2`, `${d11}.3`], "three exception paths, numbered in reading order");
  assert.equal(k("d11a"), k("p11a"), "the fork inside the branch carries the branch's own number");
  assert.equal(k("p11a1"), `${k("p11a")}.1`);
  assert.equal(k("p11a2"), `${k("p11a")}.2`);
  assert.equal(n.edgeLabels.get("e11a1"), `${k("p11a")}.1 · Replies`);
  assert.equal(n.edgeLabels.get("e11a2"), `${k("p11a")}.2 · No reply`);
});

test("decimal numbering: the early 3-way fork gets 2.1, 2.2, 2.3 in the order the paths were drawn", () => {
  const { nodes, edges } = myPalLike();
  const n = computeDecimalNumbers(nodes, edges);
  assert.equal(n.stepNumbers.get("d2"), "2");
  assert.equal(n.stepNumbers.get("a1"), "2.1");
  assert.equal(n.stepNumbers.get("b1"), "2.2");
  assert.equal(n.stepNumbers.get("b2"), "2.2");
  assert.equal(n.stepNumbers.get("c1"), "2.3");
  assert.equal(n.edgeLabels.get("e2a"), "2.1 · Anonymous");
});

test("decimal numbering: reading order follows vertical stacking, then left to right, when positions exist", () => {
  const nodes = [start("s", "S"), decision("d", "D"), step("low", "Low"), step("high", "High"), step("main", "Main")];
  nodes[2].position = { x: 0, y: 300 };
  nodes[3].position = { x: 400, y: 100 };
  const edges = [edge("1", "s", "d"), edge("2", "d", "main", "", { isPrimary: true }), edge("3", "d", "low", "A"), edge("4", "d", "high", "B")];
  const n = computeDecimalNumbers(nodes, edges);
  assert.equal(n.stepNumbers.get("high"), "1.1", "higher on the page comes first");
  assert.equal(n.stepNumbers.get("low"), "1.2");
});

test("decimal numbering: a path that runs into an already-numbered step is a join, not a new number", () => {
  const nodes = [start("s", "S"), step("a", "A"), decision("d", "D"), step("b", "B"), step("m", "M"), end("e", "End", "success")];
  const edges = [edge("1", "s", "a"), edge("2", "a", "d"), edge("3", "d", "m", "Yes", { isPrimary: true }), edge("4", "d", "b", "No"), edge("5", "b", "m"), edge("6", "m", "e")];
  const n = computeDecimalNumbers(nodes, edges);
  assert.equal(n.stepNumbers.get("b"), "2.1");
  assert.ok(n.joinEdges.has("5"));
  assert.ok(n.mergeNodes.has("m"));
  assert.equal(n.stepNumbers.get("m"), "3", "the merge target keeps its main-path number");
});

test("decimal numbering: a fork with no main line is flagged so someone marks one", () => {
  const nodes = [start("s", "S"), decision("d", "D"), step("x", "X"), step("y", "Y")];
  const edges = [edge("1", "s", "d"), edge("2", "d", "x", "A"), edge("3", "d", "y", "B")];
  const n = computeDecimalNumbers(nodes, edges);
  assert.ok(n.warnings.has("d"));
  assert.equal(n.stepNumbers.get("x"), "1.1");
  assert.equal(n.stepNumbers.get("y"), "1.2");
});

test("decimal numbering: notes and unconnected steps", () => {
  const nodes = [start("s", "S"), step("a", "A"), { ...step("n", "Note", { noteKind: "info" }, "note") }, step("lone", "Lone")];
  const n = computeDecimalNumbers(nodes, [edge("1", "s", "a")]);
  assert.equal(n.stepNumbers.has("n"), false, "a note is never a step");
  assert.match(n.stepNumbers.get("lone") ?? "", /^U1$/);
});

test("decimal numbering: renumbering is part of the edit: removing an early step renumbers everything after it", () => {
  const { nodes, edges } = pilotLike();
  const before = computeDecimalNumbers(nodes, edges).stepNumbers.get("t8");
  const nodes2 = nodes.filter((x) => x.id !== "t3");
  const edges2 = edges.filter((e) => e.source !== "t3" && e.target !== "t3").concat([edge("p23", "t2", "t4", "", { isPrimary: true })]);
  const after = computeDecimalNumbers(nodes2, edges2).stepNumbers.get("t8");
  assert.equal(before, "7");
  assert.equal(after, "6");
});

test("computeNumbers: the older letter scheme is still available and the shape matches", () => {
  const { nodes, edges } = pilotLike();
  const letters = computeNumbers(nodes, edges, "letters");
  const decimal = computeNumbers(nodes, edges, "decimal");
  assert.ok(letters.stepNumbers.size > 0 && decimal.stepNumbers.size > 0);
  assert.equal(typeof letters.edgeLabels.size, "number");
});
