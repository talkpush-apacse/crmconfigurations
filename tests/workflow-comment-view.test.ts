import test from "node:test";
import assert from "node:assert/strict";
import { buildPageInfos, countThreads, groupComments, openCountsByNode, type CommentLike } from "../src/lib/workflow/comment-view";
import { computeStepNumbers } from "../src/lib/workflow/numbering";
import { workflowTemplates } from "../src/lib/workflow/template-data";

/* eslint-disable @typescript-eslint/no-explicit-any */

const t = workflowTemplates.find((x) => x.name === "Interview scheduling and no-show recovery")!;
const nodes = t.nodes as any[];
const edges = t.edges as any[];
const { stepNumbers } = computeStepNumbers(nodes, edges);
const numbered = nodes.filter((n) => stepNumbers.get(n.id));
const stepA = numbered.find((n) => stepNumbers.get(n.id) === "1")!;
const stepB = numbered.find((n) => stepNumbers.get(n.id) === "2")!;

const pages = [
  { id: "p1", name: "Main flow", nodes, edges },
  { id: "p2", name: "Second page", nodes: [{ id: "x1", type: "default", position: { x: 0, y: 0 }, data: { label: "Other step" } }], edges: [] },
];
const infos = buildPageInfos(pages, { id: "p1", nodes, edges, stepNumbers }, false);

let n = 0;
function c(over: Partial<CommentLike> & { body?: string }): CommentLike & { body: string } {
  n++;
  return { id: `c${n}`, pageId: "p1", nodeId: null, edgeId: null, parentId: null, status: "open", createdAt: new Date(2026, 9, 7, 9, n), body: "text", ...over };
}

test("comment view: threads are counted by their first comment, replies never add to the count", () => {
  const root = c({ nodeId: stepA.id });
  const done = c({ nodeId: stepA.id, status: "resolved" });
  const reply = c({ parentId: root.id, status: "open" });
  assert.deepEqual(countThreads([root, done, reply]), { open: 1, resolved: 1, all: 2 });
});

test("comment view: pin counts are open threads per step, on one page only", () => {
  const list = [c({ nodeId: stepA.id }), c({ nodeId: stepA.id }), c({ nodeId: stepB.id, status: "resolved" }), c({ pageId: "p2", nodeId: "x1" })];
  const counts = openCountsByNode(list, "p1");
  assert.equal(counts.get(stepA.id), 2);
  assert.equal(counts.has(stepB.id), false, "a resolved thread shows no pin");
  assert.equal(counts.has("x1"), false, "another page's comments are not pinned here");
});

test("comment view: grouped by step in reading order, with the step number and name in the title", () => {
  const list = [c({ nodeId: stepB.id }), c({ nodeId: stepA.id })];
  const groups = groupComments(list, infos, "open");
  assert.deepEqual(groups.map((g) => g.nodeId), [stepA.id, stepB.id]);
  assert.ok(groups[0].title.startsWith("1 · "), groups[0].title);
  assert.equal(groups[0].kind, "step");
});

test("comment view: whole-page comments come first, and pages keep their order", () => {
  const list = [c({ pageId: "p2", nodeId: "x1" }), c({ nodeId: stepA.id }), c({})];
  const groups = groupComments(list, infos, "open");
  assert.deepEqual(groups.map((g) => g.kind), ["page", "step", "step"]);
  assert.deepEqual(groups.map((g) => g.pageId), ["p1", "p1", "p2"]);
  assert.equal(groups[0].title, "Whole page");
});

test("comment view: replies stay with their thread and the filter works on the thread", () => {
  const open = c({ nodeId: stepA.id });
  const resolved = c({ nodeId: stepA.id, status: "resolved" });
  const reply = c({ nodeId: stepA.id, parentId: open.id });
  const list = [open, resolved, reply];
  const onlyOpen = groupComments(list, infos, "open");
  assert.equal(onlyOpen[0].threads.length, 1);
  assert.deepEqual(onlyOpen[0].threads[0].replies.map((r) => r.id), [reply.id]);
  assert.equal(groupComments(list, infos, "resolved")[0].threads[0].root.id, resolved.id);
  assert.equal(groupComments(list, infos, "all")[0].threads.length, 2);
  assert.equal(onlyOpen[0].openCount, 1);
  assert.equal(onlyOpen[0].resolvedCount, 1);
});

test("comment view: a group with nothing left after the filter disappears", () => {
  const groups = groupComments([c({ nodeId: stepA.id, status: "resolved" })], infos, "open");
  assert.equal(groups.length, 0);
});

test("comment view: a comment on a deleted step, connector or page is kept, not lost", () => {
  const list = [c({ nodeId: "gone" }), c({ edgeId: "gone-edge" }), c({ pageId: "deleted-page" })];
  const groups = groupComments(list, infos, "open");
  assert.equal(groups.length, 2, "deleted step and deleted connector share one group per page");
  assert.ok(groups.every((g) => g.kind === "missing"));
  assert.ok(groups.some((g) => g.pageName === "Deleted page"));
});

test("comment view: a connector comment is named by the two steps it joins", () => {
  const edge = edges.find((e) => stepNumbers.get(e.source) && stepNumbers.get(e.target))!;
  const groups = groupComments([c({ edgeId: edge.id })], infos, "open");
  assert.equal(groups[0].kind, "connector");
  assert.ok(groups[0].title.includes(`${stepNumbers.get(edge.source)} → ${stepNumbers.get(edge.target)}`), groups[0].title);
});

test("comment view: pages that are not being edited get step numbers from their saved copy", () => {
  const second = infos.find((i) => i.id === "p2")!;
  assert.equal(second.nodes.length, 1);
  assert.ok(second.stepNumbers instanceof Map);
  assert.equal(infos.find((i) => i.id === "p1")!.stepNumbers, stepNumbers, "the page being edited reuses the live numbers");
});
