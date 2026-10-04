import test from "node:test";
import assert from "node:assert/strict";
import { graphFromFlowTable } from "../src/lib/workflow/flow-table-import";
import { runGapCheck } from "../src/lib/workflow/gap-check";
import { validateWorkflow } from "../src/lib/workflow/validation";
import { applyLayout, layoutProcessMap, positionForNewNote } from "../src/lib/workflow/process-map/layout";
import { buildScene } from "../src/lib/workflow/process-map/scene";
import { lintLayout } from "../src/lib/workflow/process-map/lint";
import { decision, edge, end, note, person, start, system } from "./fixtures/process-map-fixtures";

/* eslint-disable @typescript-eslint/no-explicit-any */
const meta = { clientName: "Sample", workflowName: "Fixes", versionLabel: "v1", date: "2026-10-04", author: "Talkpush" };
const sceneOf = (nodes: any[], edges: any[]) => {
  const laid = applyLayout(nodes, edges, layoutProcessMap(nodes, edges));
  return { laid, scene: buildScene(laid.nodes, laid.edges, meta) };
};
const overlaps = (a: any, b: any) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("flow table: main-path connectors keep their label (Yes / Pass), branch connectors too", () => {
  const { edges, problems } = graphFromFlowTable([
    { step: "1", actor: "Talkpush", action: "Asks questions" },
    { step: "2", actor: "Talkpush", action: "All pass?", kind: "decision" },
    { step: "2.1", actor: "Talkpush", action: "Sends rejection", branch: "No" },
    { step: "3", actor: "Talkpush", action: "Sends booking link", branch: "Yes" },
    { step: "4", actor: "Recruiter", action: "Reviews", branch: "3. Pass" },
  ]);
  assert.deepEqual(problems, []);
  const labels = edges.map((e) => e.label);
  assert.deepEqual(labels, ["", "No", "Yes", "Pass"], "step 1 to 2 has no label; the rest carry theirs, without a leading step number");
});

test("gap check: a time stated in an information note counts as a turnaround time, an orange note does not", () => {
  const review = person("rv", "Reviews profile", "RECRUITER");
  const base = [start("s", "Entry"), review, end("e", "Done", "success")];
  const edges = [edge("e1", "s", "rv"), edge("e2", "rv", "e")];
  const sla = (nodes: any[]) => runGapCheck(nodes, edges).filter((f) => f.code === "sla_missing").length;
  assert.equal(sla(base), 1, "no timing anywhere: flagged");
  assert.equal(sla([...base, { ...note("n", "Timing", "Done the day before the interview."), data: { ...note("n", "Timing", "Done the day before the interview.").data, attachTo: "rv" } }]), 0, "info note with a time: not flagged");
  const orange = note("n", "To confirm", "How many hours does the recruiter have? Not yet confirmed.", "needs_input");
  assert.equal(sla([...base, { ...orange, data: { ...orange.data, attachTo: "rv" } }]), 1, "an orange 'to confirm' note says the time is unknown: still flagged");
});

test("validation: a Process Map fork with every path named needs no main line; unnamed paths and the classic style still do", () => {
  const nodes = [start("s", "Entry"), decision("d", "First?"), system("a", "A", "message"), system("b", "B", "message")];
  const named = [edge("e0", "s", "d"), edge("e1", "d", "a", "First"), edge("e2", "d", "b", "Second")];
  const unnamed = [edge("e0", "s", "d"), edge("e1", "d", "a", "First"), edge("e2", "d", "b", "")];
  const flags = (edges: any[], style?: string) => validateWorkflow(nodes as any, edges as any, { diagramStyle: style }).filter((f) => f.code === "missing_happy_or_primary_path").length;
  assert.equal(flags(named, "process_map"), 0);
  assert.equal(flags(unnamed, "process_map"), 1);
  assert.equal(flags(named, "classic"), 1, "the old style is unchanged");
  assert.equal(flags(named), 1, "no style given: unchanged");
});

function noteFixture() {
  const nodes = [
    start("src", "Entry"),
    person("p1", "Reviews profile", "RECRUITER"),
    person("p2", "Sends offer", "RECRUITER"),
    end("e", "Done", "success"),
    { ...note("n1", "To confirm", "One.", "needs_input"), data: { ...note("n1", "To confirm", "One.", "needs_input").data, attachTo: "p1" } },
    { ...note("n2", "Timing", "Two.", "info"), data: { ...note("n2", "Timing", "Two.", "info").data, attachTo: "p1" } },
  ];
  const edges = [edge("e1", "src", "p1"), edge("e2", "p1", "p2", "", { isPrimary: true }), edge("e3", "p2", "e")];
  return { nodes, edges };
}

test("layout: two notes attached to the same main-path step do not overlap", () => {
  const { nodes, edges } = noteFixture();
  const res = layoutProcessMap(nodes, edges);
  const r = (id: string) => ({ ...res.positions.get(id)!, w: res.sizes.get(id)!.w, h: res.sizes.get(id)!.h });
  assert.ok(!overlaps(r("n1"), r("n2")), "the two notes are stacked, not on top of each other");
  assert.ok(Math.abs(r("n1").x - r("n2").x) < 1, "and share a column above the step");
});

test("new note: placed beside its step straight away, measured from where the step really is", () => {
  const { nodes, edges } = noteFixture();
  const laid = applyLayout(nodes.filter((n) => n.id !== "n2"), edges, layoutProcessMap(nodes.filter((n) => n.id !== "n2"), edges)).nodes;
  const dragged = laid.map((n: any) => (n.id === "p1" ? { ...n, position: { x: n.position.x + 500, y: n.position.y + 40 } } : n));
  const fresh = nodes.find((n) => n.id === "n2")!;
  const spot = positionForNewNote(dragged, edges, fresh)!;
  assert.ok(spot, "a position is found");
  const p1 = dragged.find((n: any) => n.id === "p1");
  assert.ok(Math.abs(spot.x + 120 - (p1.position.x + 120)) < 140, "horizontally near the (moved) step, not at the origin");
  assert.ok(spot.y < p1.position.y, "above a main-path step");
  assert.equal(positionForNewNote(dragged, edges, { ...fresh, data: { ...fresh.data, attachTo: "nope" } }), null, "an unknown step keeps the caller's default");
});

test("connectors to a note leave from the top or bottom, never the side the real paths use", () => {
  const nodes = [
    start("src", "Entry"),
    decision("d", "Passed?"),
    person("a", "Sends offer", "RECRUITER"),
    { ...note("n", "To confirm", "What if it fails?", "needs_input"), data: { ...note("n", "To confirm", "x", "needs_input").data, attachTo: "d" } },
  ];
  const edges = [edge("e1", "src", "d"), edge("e2", "d", "a", "Pass", { isPrimary: true }), edge("e3", "d", "n", "Fail")];
  const res = layoutProcessMap(nodes, edges);
  const toNote = res.edges.get("e3")!;
  const pass = res.edges.get("e2")!;
  assert.notEqual(toNote.sourceHandle, pass.sourceHandle, "the note connector does not share the Pass exit");
  assert.deepEqual([toNote.sourceHandle, toNote.targetHandle], ["top", "bottom"], "a note above is reached straight up");
});

test("several entry channels are stacked in a column centred on the main row, each leading to the first step, with no layout complaints", () => {
  const nodes = [start("s1", "Facebook ad"), start("s2", "Careers page"), person("p1", "Applies", "CANDIDATE"), system("p2", "Prescreens", "system"), end("e", "Done", "success")];
  const edges = [edge("a", "s1", "p1"), edge("b", "s2", "p1"), edge("c", "p1", "p2"), edge("d", "p2", "e")];
  const { laid, scene } = sceneOf(nodes, edges);
  const pos = (id: string) => laid.nodes.find((n: any) => n.id === id).position;
  assert.equal(pos("s1").x, pos("s2").x, "one column");
  assert.ok(pos("s1").y < pos("s2").y, "one above the other");
  const findings = lintLayout(scene);
  assert.deepEqual(findings.filter((f) => f.severity === "high" || f.code === "entry_row_mismatch"), [], "no high findings and the entry column counts as level with the main row");
});

test("a connector running up from a decision into its note puts its label outside the note", () => {
  const nodes = [
    start("src", "Entry"),
    decision("d", "Passed?"),
    person("a", "Sends offer", "RECRUITER"),
    { ...note("n", "To confirm", "What if it fails?", "needs_input"), data: { ...note("n", "To confirm", "x", "needs_input").data, attachTo: "d" } },
  ];
  const edges = [edge("e1", "src", "d"), edge("e2", "d", "a", "Pass", { isPrimary: true }), edge("e3", "d", "n", "Fail")];
  const { laid, scene } = sceneOf(nodes, edges);
  const handles = layoutProcessMap(nodes, edges).edges.get("e3")!;
  assert.deepEqual([handles.sourceHandle, handles.targetHandle], ["top", "bottom"]);
  const fail = scene.edges.find((e: any) => e.id === "e3")!;
  const noteRect = scene.shapes.find((s: any) => s.id === "n")!.rect;
  assert.ok(fail.labelRect && !overlaps(fail.labelRect, noteRect), "the label does not sit on the note");
  assert.deepEqual(lintLayout(scene).filter((f) => f.code === "label_overlap"), [], "and the layout check agrees");
  void laid;
});

test("the key explains the end-state colours a diagram uses, and how to read the numbers, with an example from the diagram", () => {
  const nodes = [
    start("s", "Entry"),
    decision("d", "Passed?"),
    system("a", "Moves to Hired", "move"),
    system("b", "Moves to Rejected", "move"),
    end("ok", "Hired", "success"),
    end("no", "Rejected: did not pass", "failure"),
  ];
  const edges = [edge("e1", "s", "d"), edge("e2", "d", "a", "Yes", { isPrimary: true }), edge("e3", "d", "b", "No"), edge("e4", "a", "ok"), edge("e5", "b", "no")];
  const { scene } = sceneOf(nodes, edges);
  const rows = Object.fromEntries(scene.legend.rows.map((r: any) => [r.key, r]));
  assert.equal(rows.end_success.label, "Ends successfully");
  assert.equal(rows.end_failure.label, "Ends without success");
  assert.ok(!rows.end_neutral && !rows.end_soft, "no row for an end colour this diagram does not use");
  assert.match(rows.numbers.label, /^main path · \d+\.\d+ a branch from step \d+$/);
  assert.equal(rows.numbers.swatch.glyph, "①");
  assert.ok(!scene.legend.rows.some((r: any) => /\[|MOVE|tag/i.test(r.label)), "the key still lists no tags");
});

test("the key has no end-state or branch wording when the diagram has none", () => {
  const nodes = [start("s", "Entry"), system("a", "Sends a message", "message"), system("b", "Records it", "add_data")];
  const edges = [edge("e1", "s", "a"), edge("e2", "a", "b")];
  const { scene } = sceneOf(nodes, edges);
  assert.ok(!scene.legend.rows.some((r: any) => r.key.startsWith("end_")));
  assert.equal(scene.legend.rows.find((r: any) => r.key === "numbers")!.label, "main path steps are numbered in order");
});

test("hiding the numbers also hides the key's number line", () => {
  const nodes = [start("s", "Entry"), system("a", "Sends a message", "message")];
  const edges = [edge("e1", "s", "a")];
  const laid = applyLayout(nodes, edges, layoutProcessMap(nodes, edges));
  const hidden = buildScene(laid.nodes, laid.edges, { ...meta, hideNumbers: true });
  assert.ok(!hidden.legend.rows.some((r: any) => r.key === "numbers"));
});
