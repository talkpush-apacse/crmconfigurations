import test from "node:test";
import assert from "node:assert/strict";
import { runGapCheck, summarizeGaps } from "../src/lib/workflow/gap-check";
import { diffPages } from "../src/lib/workflow/diff";
import { graphFromFlowTable, normalizeStep, type FlowRowInput } from "../src/lib/workflow/flow-table-import";
import { computeDecimalNumbers } from "../src/lib/workflow/numbering-decimal";
import { deriveFlowTable } from "../src/lib/workflow/process-map/flow-table";
import { decision, edge, end, jump, myPalLike, person, pilotLike, start, step, system } from "./fixtures/process-map-fixtures";

/* eslint-disable @typescript-eslint/no-explicit-any */
const codes = (nodes: any[], edges: any[]) => runGapCheck(nodes, edges).map((f) => f.code);

// ---------- gap check ----------

test("gap check: a diagram with no entry channel is a blocker", () => {
  const nodes = [step("a", "A"), step("b", "B")];
  const f = runGapCheck(nodes, [edge("1", "a", "b")]);
  assert.ok(f.some((x) => x.code === "trigger_ambiguous" && x.tier === "blocker"));
});

test("gap check: a step that leads nowhere is a blocker; an end state is fine", () => {
  const nodes = [start("s", "S"), step("a", "A"), end("e", "Done", "success")];
  assert.ok(codes(nodes, [edge("1", "s", "a")]).includes("dead_end"));
  assert.ok(!codes(nodes, [edge("1", "s", "a"), edge("2", "a", "e")]).includes("dead_end"));
});

test("gap check: unlabeled decision paths, missing roles and missing timing are assumptions that say what changes", () => {
  const nodes = [start("s", "S"), decision("d", "Qualified?"), person("p", "Reviews the file", ""), end("e", "End", "neutral"), end("f", "No", "failure")];
  const edges = [edge("1", "s", "d"), edge("2", "d", "p", ""), edge("3", "d", "f", "No"), edge("4", "p", "e")];
  const f = runGapCheck(nodes, edges);
  const crit = f.find((x) => x.code === "decision_criteria_missing");
  assert.equal(crit?.tier, "assumption");
  assert.match(crit?.assumption ?? "", /^Assumed .* If incorrect/);
  assert.ok(f.some((x) => x.code === "ownership_gap" && x.nodeId === "p"));
  assert.ok(f.some((x) => x.code === "sla_missing" && x.nodeId === "p"));
});

test("gap check: voice AI with no disclosure is a blocker, and a disclosure step clears it", () => {
  const base = () => [start("s", "S"), system("v", "AI interview call", "ai"), end("e", "End", "neutral")];
  const edges = [edge("1", "s", "v"), edge("2", "v", "e")];
  assert.ok(codes(base(), edges).includes("voice_ai_no_disclosure"));
  const withNote = [...base(), step("c", "Tell candidate this is an AI and ask for recording consent")];
  assert.ok(!codes(withNote, [...edges, edge("3", "e", "c")]).includes("voice_ai_no_disclosure"));
});

test("gap check: a loop with no limit is a blocker; naming a limit clears it", () => {
  const nodes = [start("s", "S"), step("a", "Ask candidate to book"), step("b", "Send reminder"), end("e", "End", "neutral")];
  const edges = [edge("1", "s", "a", "", { isPrimary: true }), edge("2", "a", "b", "", { isPrimary: true }), edge("3", "b", "a", "", { isRecovery: true }), edge("4", "a", "e", "Booked")];
  assert.ok(codes(nodes, edges).includes("uncapped_loop"));
  nodes[2].data.notes = "Up to 3 reminders";
  assert.ok(!codes(nodes, edges).includes("uncapped_loop"));
});

test("gap check: Talkpush patterns are asked about, only when relevant", () => {
  const nodes = [start("s", "S"), step("a", "Chatbot prescreening"), step("b", "Schedule the interview"), end("e", "End", "neutral")];
  const f = codes(nodes, [edge("1", "s", "a"), edge("2", "a", "b"), edge("3", "b", "e")]);
  assert.ok(f.includes("prescreening_dropoff_recovery") && f.includes("no_show_recovery"));
  const { nodes: n2, edges: e2 } = pilotLike();
  assert.ok(!codes(n2, e2).includes("no_show_recovery"), "the pilot flow already has reminders and a no-show path");
});

test("gap check: findings are ordered blockers first and counted", () => {
  const { nodes, edges } = myPalLike();
  const f = runGapCheck(nodes, edges);
  const order = f.map((x) => ({ blocker: 0, assumption: 1, nice: 2 })[x.tier]);
  assert.deepEqual(order, [...order].sort());
  const sum = summarizeGaps(f);
  assert.equal(sum.blockers + sum.assumptions + sum.nice, f.length);
});

// ---------- version diff ----------

const page = (nodes: any[], edges: any[]) => [{ id: "p1", name: "Page 1", nodes, edges }];

test("diff: identical versions say so", () => {
  const { nodes, edges } = pilotLike();
  const d = diffPages(page(nodes, edges), page(structuredClone(nodes), structuredClone(edges)));
  assert.equal(d.identical, true);
  assert.deepEqual(d.lines, ["No differences."]);
});

test("diff: added, removed, renamed, moved and reconnected are described in plain language", () => {
  const { nodes, edges } = pilotLike();
  const after = structuredClone(nodes);
  after.find((n: any) => n.id === "t1").data.label = "Send booking link";
  after.find((n: any) => n.id === "t2").position = { x: 999, y: 999 };
  const gone = after.filter((n: any) => n.id !== "t9");
  gone.push(step("new1", "Collect documents"));
  const edges2 = edges.filter((e: any) => e.id !== "p9").concat([edge("pn", "t8", "new1", "Then")]);
  const d = diffPages(page(nodes, edges), page(gone, edges2));
  assert.deepEqual(d.added.map((x) => x.label), ["Collect documents"]);
  assert.deepEqual(d.removed.map((x) => x.label), ["Move to Rejected"]);
  assert.ok(d.changed.some((c) => c.nodeId === "t1" && c.fields[0].field === "label"));
  assert.equal(d.moved, 1);
  assert.ok(d.lines.includes('Added the step "Collect documents".'));
  assert.ok(d.lines.includes('Removed the step "Move to Rejected".'));
  assert.ok(d.lines.some((l) => l.startsWith('Changed "Send booking link": name')));
  assert.ok(d.lines.some((l) => l.includes('Connected "Move to Hired" to "Collect documents" (Then)')));
  assert.ok(d.lines.some((l) => l.includes("Disconnected")));
});

test("diff: pages added and removed", () => {
  const a = [{ id: "p1", name: "One", nodes: [], edges: [] }];
  const b = [{ id: "p2", name: "Two", nodes: [], edges: [] }];
  const d = diffPages(a, b);
  assert.deepEqual([d.pagesAdded, d.pagesRemoved], [["Two"], ["One"]]);
});

// ---------- approved flow table -> diagram ----------

const TABLE: FlowRowInput[] = [
  { step: "①", actor: "Talkpush", action: "Send self-scheduling link", actionType: "Message" },
  { step: "2", actor: "Candidate", action: "Picks a slot", actionType: "Candidate" },
  { step: "3", actor: "Talkpush", action: "Attended?", kind: "decision" },
  { step: "3.1", actor: "Talkpush", action: "Send no-show recovery", actionType: "message", branch: "3.1 · No" },
  { step: "3.1", actor: "Talkpush", action: "Manual follow-up", kind: "end", endKind: "neutral" },
  { step: "4", actor: "Recruiter", action: "Conducts the interview" },
  { step: "5", actor: "Talkpush", action: "Passed?" },
  { step: "5.1", actor: "Talkpush", action: "Move to Rejected", actionType: "Move", branch: "Fail" },
  { step: "5.1", actor: "Talkpush", action: "Rejected", kind: "end", endKind: "failure" },
  { step: "6", actor: "Talkpush", action: "Move to Hired", actionType: "move" },
  { step: "6", actor: "Talkpush", action: "Hired", kind: "end", endKind: "success" },
];

test("flow table import: circled numerals are understood", () => {
  assert.equal(normalizeStep("④"), "4");
  assert.equal(normalizeStep(" 11.1.1 "), "11.1.1");
});

test("flow table import: the main path, a branch and the endings are connected as the table says", () => {
  const { nodes, edges, problems } = graphFromFlowTable(TABLE);
  assert.deepEqual(problems, []);
  assert.equal(nodes.length, TABLE.length);
  const byLabel = (l: string) => nodes.find((n) => n.label === l)!;
  const connected = (a: string, b: string) => edges.some((e) => e.sourceTempId === byLabel(a).tempId && e.targetTempId === byLabel(b).tempId);
  assert.ok(connected("Send self-scheduling link", "Picks a slot"));
  assert.ok(connected("Attended?", "Send no-show recovery"));
  assert.ok(connected("Send no-show recovery", "Manual follow-up"));
  assert.ok(connected("Attended?", "Conducts the interview"), "the decision continues the main path");
  assert.ok(connected("Picks a slot", "Attended?"));
  assert.ok(connected("Move to Hired", "Hired"));
  assert.equal(byLabel("Attended?").type, "decision");
  assert.equal(byLabel("Hired").type, "terminator");
  assert.equal(byLabel("Send self-scheduling link").type, "communication");
  assert.equal(byLabel("Picks a slot").actor, "candidate");
  assert.equal(byLabel("Conducts the interview").personActs, true);
  const branchEdge = edges.find((e) => e.targetTempId === byLabel("Send no-show recovery").tempId)!;
  assert.equal(branchEdge.label, "No", "the number prefix is stripped from the condition");
});

test("flow table import: the built diagram numbers exactly as the table did (round trip)", () => {
  const { nodes, edges } = graphFromFlowTable(TABLE);
  // Wrap as workflow nodes/edges the way create_workflow_from_spec would.
  const wfNodes = nodes.map((n) => ({ id: n.tempId, type: n.type, position: { x: 0, y: 0 }, data: { ...n, label: n.label, type: n.type } }));
  const wfEdges = edges.map((e, i) => ({ id: `e${i}`, source: e.sourceTempId, target: e.targetTempId, data: { label: e.label, isPrimary: e.isPrimary, isHappyPath: e.isHappyPath } }));
  const num = computeDecimalNumbers(wfNodes, wfEdges);
  const byLabel = (l: string) => wfNodes.find((n) => n.data.label === l)!;
  assert.equal(num.stepNumbers.get(byLabel("Send self-scheduling link").id), "1");
  assert.equal(num.stepNumbers.get(byLabel("Attended?").id), "3");
  assert.equal(num.stepNumbers.get(byLabel("Send no-show recovery").id), "3.1");
  assert.equal(num.stepNumbers.get(byLabel("Move to Hired").id), "6");
  assert.equal(num.stepNumbers.has(byLabel("Hired").id), false);
  const table = deriveFlowTable(wfNodes, wfEdges);
  assert.deepEqual(table.rows.map((r) => r.step), ["1", "2", "3", "3.1", "4", "5", "5.1", "6"]);
});

test("flow table import: problems are reported, not guessed around", () => {
  const rows: FlowRowInput[] = [
    { step: "1", actor: "Talkpush", action: "Start" },
    { step: "4.2", actor: "Talkpush", action: "Orphan branch", branch: "Maybe" },
    { step: "2", actor: "Talkpush", action: "Go back", kind: "jump", jumpTo: "9" },
    { step: "", actor: "Talkpush", action: "No number" },
  ];
  const { problems } = graphFromFlowTable(rows);
  assert.equal(problems.length, 3);
  assert.ok(problems.some((p) => p.includes("no step 4")));
  assert.ok(problems.some((p) => p.includes("step 9")));
  assert.ok(problems.some((p) => p.includes("no step number")));
});

test("flow table import: a jump row points at the step it names", () => {
  const rows: FlowRowInput[] = [
    { step: "1", actor: "Talkpush", action: "A" },
    { step: "2", actor: "Talkpush", action: "Decide?", kind: "decision" },
    { step: "2.1", actor: "Talkpush", action: "Do something", branch: "No" },
    { step: "2.1", actor: "Talkpush", action: "Back", kind: "jump", jumpTo: "1" },
  ];
  const { nodes, problems } = graphFromFlowTable(rows);
  assert.deepEqual(problems, []);
  const j = nodes.find((n) => n.type === "jump")!;
  assert.equal(j.jumpToNodeId, nodes.find((n) => n.label === "A")!.tempId);
});
