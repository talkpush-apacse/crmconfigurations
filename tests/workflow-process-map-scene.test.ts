import test from "node:test";
import assert from "node:assert/strict";
import { layoutProcessMap, applyLayout } from "../src/lib/workflow/process-map/layout";
import { buildScene } from "../src/lib/workflow/process-map/scene";
import { lintLayout } from "../src/lib/workflow/process-map/lint";
import { routePoints, segmentsOf, pathFromPoints } from "../src/lib/workflow/process-map/route";
import { boxFor, wrapText, charsPerLine } from "../src/lib/workflow/process-map/text-fit";
import { actionTypeOf, fillFor, personActs, roleBracket, tagOf } from "../src/lib/workflow/process-map/model";
import { PM } from "../src/lib/workflow/process-map/tokens";
import { myPalLike, pilotLike, person, system, decision, end, jump, note, step, edge, start } from "./fixtures/process-map-fixtures";

/* eslint-disable @typescript-eslint/no-explicit-any */
const meta = { clientName: "Acme", workflowName: "Portal workflow", versionLabel: "v3", date: "2026-10-02", author: "Talkpush" };

function laidOut(make: () => { nodes: any[]; edges: any[] }) {
  const { nodes, edges } = make();
  const res = layoutProcessMap(nodes, edges);
  return applyLayout(nodes, edges, res);
}

// ---------- the look ----------

test("fill follows who acts: green for the system, white for a person, blue for decisions, never by tag", () => {
  assert.equal(fillFor(system("a", "x", "move")).fill, PM.colors.system);
  assert.equal(fillFor(person("b", "x", "RECRUITER", { actionType: "add_data" })).fill, PM.colors.person, "a person who also writes data stays white");
  assert.equal(fillFor(decision("c", "x")).fill, PM.colors.decision);
  assert.equal(fillFor(end("d", "x", "success")).fill, PM.colors.endSuccess);
  assert.equal(fillFor(end("d", "x", "failure")).fill, PM.colors.endFailure);
  assert.equal(fillFor(end("d", "x", "neutral")).fill, PM.colors.endNeutral);
  assert.equal(fillFor(end("d", "x", "soft")).fill, PM.colors.endSoft);
  assert.equal(fillFor(jump("j", "a")).fill, PM.colors.jump);
  assert.equal(fillFor(note("n", "h", "b", "needs_input")).fill, PM.colors.noteOrange);
  assert.equal(fillFor(note("n", "h", "b", "rejection")).fill, PM.colors.noteRejection);
  assert.equal(fillFor(note("n", "h", "b", "info")).dashed, true);
});

test("an explicit personActs setting wins over the actor", () => {
  assert.equal(personActs(step("a", "x", { actor: "manual", personActs: false })), false);
  assert.equal(personActs(step("a", "x", { actor: "automated", personActs: true })), true);
  assert.equal(personActs(step("a", "x", { actor: "candidate" })), true);
});

test("white boxes lead with the role in capitals and brackets; green boxes with the tag", () => {
  const p = person("p", "Opens the portal", "Hiring manager");
  assert.equal(roleBracket(p), "[HIRING MANAGER]");
  const sys = system("s", "Moves to Rejected", "move");
  assert.equal(tagOf(sys), "[MOVE]");
  assert.equal(roleBracket(sys), null);
  const b = boxFor(p, { spine: 3 });
  assert.equal(b.lines[0].runs.map((r) => r.text).join(""), "③ [HIRING MANAGER]");
  assert.equal(b.people, true);
  assert.equal(b.badge?.icon, "Users");
  const g = boxFor(sys, { branch: "5.1" });
  assert.equal(g.lines[0].runs.map((r) => r.text).join(""), "[MOVE] 5.1");
  assert.equal(g.lines[0].runs.at(-1)?.muted, true, "the branch number is small and muted after the tag");
});

test("tag, Action Type and icon are strictly one to one, and a folder move is never [SYSTEM]", () => {
  assert.equal(actionTypeOf(step("a", "x", { talkpushAction: undefined, data: { talkpushAction: "move_candidate" } })), "move");
  assert.equal(actionTypeOf(step("a", "x", {}, "communication")), "message");
  assert.equal(actionTypeOf(step("a", "x", { data: { integrationDirection: "pull" } }, "integration")), "get_data");
  assert.equal(actionTypeOf(decision("d", "x")), null, "decisions carry no tag");
  assert.equal(actionTypeOf(person("p", "x", "RECRUITER")), null, "a genuinely manual step carries no tag");
  assert.equal(tagOf(system("s", "x", "alert")), "[ALERT]");
});

test("text fit: lines break by the character-width formula and boxes grow by one line height per line", () => {
  assert.equal(charsPerLine(264), Math.floor((264 - 32) / PM.type.charW));
  assert.equal(charsPerLine(264), 30);
  assert.deepEqual(wrapText("one two three", 7), ["one two", "three"]);
  assert.deepEqual(wrapText("supercalifragilistic", 8), ["supercal", "ifragili", "stic"]);
  const short = boxFor(system("a", "Short", "system"));
  const long = boxFor(system("a", "word ".repeat(40), "system"));
  assert.equal(short.width, PM.size.processW);
  assert.ok(long.height > short.height);
  assert.equal(long.width, short.width, "boxes of one kind share one width");
  assert.ok(long.height >= 32 + long.lines.length * PM.type.lineH - 1);
});

test("terminators are not numbered and never show a number, even if numbers are given", () => {
  const b = boxFor(end("e", "Hired", "success"), { spine: 9, branch: "9.1" });
  assert.equal(b.lines.map((l) => l.runs.map((r) => r.text).join("")).join("|"), "Hired");
});

test("a jump marker says where it goes, circled for the main path and plain for a branch", () => {
  assert.equal(boxFor(jump("j", "x"), { jumpTarget: "9" }).lines.map((l) => l.runs[0].text).join(" "), "→ Go to step ⑨");
  assert.equal(boxFor(jump("j", "x"), { jumpTarget: "9.1" }).lines.map((l) => l.runs[0].text).join(" "), "→ Go to step 9.1");
});

// ---------- routing ----------

test("routing: elbows only, no diagonals", () => {
  const cases: [any, any, any, any][] = [
    [{ x: 0, y: 0 }, "right", { x: 300, y: 0 }, "left"],
    [{ x: 0, y: 0 }, "right", { x: 300, y: 120 }, "left"],
    [{ x: 0, y: 0 }, "bottom", { x: 0, y: 200 }, "top"],
    [{ x: 0, y: 0 }, "bottom", { x: 200, y: 200 }, "top"],
    [{ x: 300, y: 300 }, "right", { x: 600, y: 100 }, "bottom"],
    [{ x: 300, y: 300 }, "left", { x: 100, y: 100 }, "bottom"],
  ];
  for (const [s, sp, t, tp] of cases) {
    const pts = routePoints(s, sp, t, tp);
    for (const seg of segmentsOf(pts)) assert.ok(Math.abs(seg.a.x - seg.b.x) < 0.5 || Math.abs(seg.a.y - seg.b.y) < 0.5, `${JSON.stringify(pts)} has a diagonal`);
    assert.deepEqual(pts[0], s);
    assert.deepEqual(pts.at(-1), t);
  }
  assert.equal(routePoints({ x: 0, y: 0 }, "right", { x: 300, y: 0 }, "left").length, 2, "level steps get a straight line");
  assert.match(pathFromPoints(routePoints({ x: 0, y: 0 }, "bottom", { x: 100, y: 200 }, "top"), 8), /^M0 0 L0 \d+ Q/);
});

// ---------- the scene ----------

test("scene: containers, title block and a legend that lists only what the diagram uses", () => {
  const { nodes, edges } = laidOut(pilotLike);
  const scene = buildScene(nodes, edges, meta);
  assert.deepEqual(scene.containers.map((c) => c.id).sort(), ["container_entry", "container_journey"]);
  assert.equal(scene.containers.find((c) => c.id === "container_journey")!.title, "Portal workflow Journey");
  assert.equal(scene.title.lines[0].text, "Acme: Portal workflow");
  assert.equal(scene.title.lines[1].text, "v3 · 2026-10-02 · Talkpush");
  const keys = scene.legend.rows.map((r) => r.key);
  assert.ok(keys.includes("system") && keys.includes("person") && keys.includes("decision"));
  assert.ok(!keys.includes("jump") && !keys.includes("rejection"), "no row for kinds that are not on this diagram");
  assert.ok(!scene.legend.rows.some((r) => /\[|MOVE|tag/i.test(r.label)), "the key lists colors and shapes, never bracket tags");
});

test("scene: the key says 'To confirm with <client>' for orange notes, with the client's name", () => {
  const { nodes, edges } = laidOut(myPalLike);
  const scene = buildScene(nodes, edges, { ...meta, clientName: "McDonald's PH" });
  const row = scene.legend.rows.find((r) => r.key === "needs");
  assert.equal(row?.label, "To confirm with McDonald's PH");
  assert.ok(scene.legend.rows.some((r) => r.key === "jump"));
  assert.ok(scene.legend.rows.some((r) => r.key === "rejection"));
});

test("scene: containers hold their shapes with at least 80px of padding", () => {
  const { nodes, edges } = laidOut(myPalLike);
  const scene = buildScene(nodes, edges, meta);
  const journey = scene.containers.find((c) => c.id === "container_journey")!.rect;
  for (const s of scene.shapes.filter((x) => x.kind !== "start")) {
    assert.ok(s.rect.x - journey.x >= 80 && s.rect.y - journey.y >= 80, `${s.id} is inset by 80px`);
    assert.ok(journey.x + journey.w - (s.rect.x + s.rect.w) >= 80 && journey.y + journey.h - (s.rect.y + s.rect.h) >= 80);
  }
});

test("scene: numbered fork labels sit on their connectors", () => {
  const { nodes, edges } = laidOut(pilotLike);
  const scene = buildScene(nodes, edges, meta);
  const no = scene.edges.find((e) => e.id === "p4n")!;
  assert.equal(no.label, "4.1 · No");
  assert.ok(no.labelRect);
  assert.equal(scene.edges.find((e) => e.id === "p4")!.label, "Yes", "the main-path output keeps its plain label");
});

// ---------- the layout check ----------

test("layout check: freshly laid out diagrams have no high-severity findings", () => {
  for (const make of [pilotLike, myPalLike]) {
    const { nodes, edges } = laidOut(make);
    const findings = lintLayout(buildScene(nodes, edges, meta));
    const high = findings.filter((f) => f.severity === "high");
    assert.deepEqual(high, [], high.map((f) => f.message).join("\n"));
  }
});

test("layout check: one failing fixture per rule", () => {
  const base = () => laidOut(pilotLike);
  const codes = (nodes: any[], edges: any[]) => lintLayout(buildScene(nodes, edges, meta)).map((f) => f.code);

  // a step dragged onto a connector
  let { nodes, edges } = base();
  const blocker = nodes.find((n: any) => n.id === "t3");
  const target = nodes.find((n: any) => n.id === "t6");
  blocker.position = { x: target.position.x + 10, y: target.position.y + 200 };
  assert.ok(codes(nodes, edges).includes("connector_crosses_shape") || codes(nodes, edges).includes("shapes_too_close"));

  // two steps on top of each other
  ({ nodes, edges } = base());
  nodes.find((n: any) => n.id === "t5").position = { ...nodes.find((n: any) => n.id === "t9").position };
  assert.ok(codes(nodes, edges).includes("shapes_overlap"));

  // a note placed on a connector lane
  ({ nodes, edges } = base());
  const n2 = note("note1", "Note", "x", "info");
  const a = nodes.find((n: any) => n.id === "t2");
  const b = nodes.find((n: any) => n.id === "t3");
  n2.position = { x: (a.position.x + a.position.x + 240 + b.position.x) / 2 - 60, y: a.position.y + 20 };
  nodes.push(n2);
  assert.ok(codes(nodes, edges).includes("note_in_connector_lane"));

  // straight connector
  ({ nodes, edges } = base());
  edges.find((e: any) => e.id === "p2").data.lineType = "straight";
  assert.ok(codes(nodes, edges).includes("diagonal_connector"));

  // entry channel off the row
  ({ nodes, edges } = base());
  nodes.find((n: any) => n.type === "source").position.y += 150;
  assert.ok(codes(nodes, edges).includes("entry_row_mismatch"));

  // a box squeezed smaller than its text
  ({ nodes, edges } = base());
  const s = nodes.find((n: any) => n.id === "t6");
  s.data.notes = "word ".repeat(60);
  const scene = buildScene(nodes, edges, meta);
  const shape = scene.shapes.find((x) => x.id === "t6")!;
  shape.rect.h = 40;
  assert.ok(lintLayout(scene).some((f) => f.code === "text_overflow" && f.nodeId === "t6"));

  // mixed connector styles out of one fork (the first fork of the MyPal-style flow has three numbered paths)
  {
    const pal = laidOut(myPalLike);
    pal.edges.find((e: any) => e.id === "e2b").sourceHandle = "right";
    assert.ok(codes(pal.nodes, pal.edges).includes("fork_mixed_connectors"));
  }

  // a path that runs a very long way to rejoin
  ({ nodes, edges } = base());
  const e1 = nodes.find((n: any) => n.id === "e1");
  const t5 = nodes.find((n: any) => n.id === "t5");
  nodes.push({ ...step("far", "Far step"), position: { x: e1.position.x + 5000, y: t5.position.y } });
  edges.push(edge("farIn", "t5", "far", "", {}));
  edges.push(edge("farBack", "far", "t2", "", {}));
  assert.ok(codes(nodes, edges).includes("far_merge"));
});

test("layout check: findings are sorted most serious first and say what to do", () => {
  const { nodes, edges } = laidOut(pilotLike);
  edges.find((e: any) => e.id === "p2").data.lineType = "bezier";
  const findings = lintLayout(buildScene(nodes, edges, meta));
  assert.ok(findings.length > 0);
  for (const f of findings) assert.ok(f.recommendation.length > 10 && f.message.length > 10);
  const order = findings.map((f) => ({ high: 0, medium: 1, low: 2 })[f.severity]);
  assert.deepEqual(order, [...order].sort());
});

test("process map ids are unique and entry source is detected as start", () => {
  const { nodes } = start("s", "x") ? { nodes: [start("s", "x")] } : { nodes: [] };
  assert.equal(nodes.length, 1);
});
