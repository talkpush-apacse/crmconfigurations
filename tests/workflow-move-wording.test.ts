import test from "node:test";
import assert from "node:assert/strict";
import { hasInline, moveStepLabel, richWords, stripInline } from "../src/lib/workflow/process-map/inline-text";
import { boxFor } from "../src/lib/workflow/process-map/text-fit";
import { createWorkflowNode, moveWordingFor } from "../src/lib/workflow/helpers";
import { validateWorkflow } from "../src/lib/workflow/validation";
import { deriveFlowTable } from "../src/lib/workflow/process-map/flow-table";
import { edge, start, system } from "./fixtures/process-map-fixtures";

/* eslint-disable @typescript-eslint/no-explicit-any */
test("bold markers: stripped for plain text, kept per word for drawing", () => {
  assert.equal(stripInline("Moves to **Expected to Show Up** Folder/Stage"), "Moves to Expected to Show Up Folder/Stage");
  assert.equal(stripInline("No markers here"), "No markers here");
  assert.equal(hasInline("a **b** c"), true);
  assert.equal(hasInline("a * b ** c"), false);
  assert.deepEqual(richWords("Moves to **Show Up** Folder/Stage").map((w) => `${w.text}:${w.bold ? 1 : 0}`), ["Moves:0", "to:0", "Show:1", "Up:1", "Folder/Stage:0"]);
});

test("Move wording: a plain 'Moves to X' becomes 'Moves to **X** Folder/Stage'", () => {
  assert.equal(moveStepLabel("Moves to Expected to Show Up"), "Moves to **Expected to Show Up** Folder/Stage");
  assert.equal(moveStepLabel("Moves to Rejected"), "Moves to **Rejected** Folder/Stage");
  assert.equal(moveStepLabel("Moves to Interview Scheduling Folder/Stage"), "Moves to **Interview Scheduling** Folder/Stage");
  assert.equal(moveStepLabel("Auto-moves to Rejected"), "Auto-moves to **Rejected** Folder/Stage");
});

test("Move wording is idempotent and leaves anything with more in it alone", () => {
  const done = "Moves to **Expected to Show Up** Folder/Stage";
  assert.equal(moveStepLabel(done), done);
  assert.equal(moveStepLabel(moveStepLabel("Moves to Hired")), "Moves to **Hired** Folder/Stage");
  assert.equal(moveStepLabel("Reminder at 48h; auto-moves to Rejected"), "Reminder at 48h; auto-moves to Rejected");
  assert.equal(moveStepLabel("Moves to Interview Scheduling and sends the booking link"), "Moves to Interview Scheduling and sends the booking link");
  assert.equal(moveStepLabel("Moves to Screening (high volume)"), "Moves to Screening (high volume)");
  assert.equal(moveStepLabel(""), "");
});

test("only a Move step gets the wording when a node is created", () => {
  const move = createWorkflowNode({ type: "stage", label: "Moves to Expected to Show Up", extra: { actionType: "move" } });
  assert.equal(move.data.label, "Moves to **Expected to Show Up** Folder/Stage");
  const other = createWorkflowNode({ type: "stage", label: "Moves to Expected to Show Up", extra: { actionType: "system" } });
  assert.equal(other.data.label, "Moves to Expected to Show Up");
  assert.equal(moveWordingFor("Moves to Hired", "move"), "Moves to **Hired** Folder/Stage");
  assert.equal(moveWordingFor("Moves to Hired", undefined), "Moves to Hired");
});

test("the box draws the folder name bold and the rest plain, centred as before", () => {
  const box = boxFor(system("m", "Moves to **Expected to Show Up** Folder/Stage", "move"), { spine: 3 });
  const body = box.lines.slice(1);
  const text = body.map((l) => l.runs.map((r) => r.text).join("")).join(" ");
  assert.equal(text.replace(/\s+/g, " ").trim(), "Moves to Expected to Show Up Folder/Stage");
  const boldText = body.flatMap((l) => l.runs.filter((r) => r.bold).map((r) => r.text.trim())).join(" ");
  assert.equal(boldText, "Expected to Show Up");
  assert.ok(!body.some((l) => l.runs.some((r) => r.text.includes("*"))), "no asterisks reach the screen");
  assert.ok(body.every((l) => l.runs.every((r) => !r.bold || /Expected|to|Show|Up/.test(r.text))), "Moves/Folder/Stage stay plain");
});

test("text without bold wraps exactly as it did before", () => {
  const box = boxFor(system("m", "Sends the assessment link to the candidate by email", "message"));
  const joined = box.lines.slice(1).map((l) => l.runs.map((r) => r.text).join("")).join(" ");
  assert.ok(joined.startsWith("Sends the assessment link"));
  assert.ok(box.lines.every((l) => l.runs.every((r) => !r.bold || box.lines.indexOf(l) === 0)));
});

test("a long folder name still wraps inside the box and stays bold across lines", () => {
  const box = boxFor(system("m", "Moves to **Interview Scheduling and Confirmation for Night Shift Applicants** Folder/Stage", "move"));
  const body = box.lines.slice(1);
  assert.ok(body.length >= 2);
  const bold = body.flatMap((l) => l.runs.filter((r) => r.bold).map((r) => r.text.trim())).join(" ");
  assert.equal(bold, "Interview Scheduling and Confirmation for Night Shift Applicants");
});

test("validate_workflow flags a Move step that is missing the wording, and only in the Process Map style", () => {
  const nodes = [start("s", "Applies"), system("m1", "Moves to Hired", "move"), system("m2", "Moves to **Hired** Folder/Stage", "move"), system("m3", "Reminder at 48h; auto-moves to Rejected", "move")];
  const edges = [edge("e1", "s", "m1"), edge("e2", "m1", "m2"), edge("e3", "m2", "m3")];
  const flagged = (style: string) => validateWorkflow(nodes as any, edges as any, { diagramStyle: style }).filter((f) => f.code === "move_wording").map((f) => f.nodeId);
  assert.deepEqual(flagged("process_map"), ["m1"]);
  assert.deepEqual(flagged("classic"), []);
});

test("the flow table shows the Move text without asterisks", () => {
  const nodes = [start("s", "Applies"), system("m", "Moves to **Hired** Folder/Stage", "move")];
  const table = deriveFlowTable(nodes as any, [edge("e", "s", "m")] as any);
  const row = table.rows.find((r) => r.nodeId === "m");
  assert.equal(row?.action, "Moves to Hired Folder/Stage");
});

test("a 'use client' line stays the first statement of the files that have one (an import above it breaks the build)", async () => {
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : /\.tsx?$/.test(f) ? [join(dir, f)] : []));
  const bad = walk("src").filter((file) => {
    const lines = readFileSync(file, "utf8").split("\n");
    const at = lines.slice(0, 12).findIndex((l) => /^\s*["']use client["'];?\s*$/.test(l));
    if (at <= 0) return false;
    return lines.slice(0, at).some((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l));
  });
  assert.deepEqual(bad, []);
});

test("the original look is the default and keeps the old numbers; the readable look is opt-in", async () => {
  const { PM, PM_ORIGINAL, PM_READABLE, withLook, tokensFor } = await import("../src/lib/workflow/process-map/tokens");
  assert.equal(PM.type.body, 11, "no look switched on = the original look");
  assert.equal(PM.size.processW, 240);
  assert.equal(tokensFor(undefined), PM_ORIGINAL);
  assert.equal(tokensFor("original"), PM_ORIGINAL);
  assert.equal(tokensFor("anything else"), PM_ORIGINAL);
  assert.equal(tokensFor("readable"), PM_READABLE);
  assert.equal(PM_READABLE.type.body, 13);
  assert.ok(PM_READABLE.type.small >= 12 && PM_READABLE.type.branch >= 11, "small print stays readable");
  assert.equal(withLook("readable", () => PM.type.body), 13);
  assert.equal(PM.type.body, 11, "put back afterwards");
  assert.throws(() => withLook("readable", () => { throw new Error("boom"); }));
  assert.equal(PM.type.body, 11, "put back even when the work fails");
  assert.equal(withLook("readable", () => withLook("original", () => PM.type.body)), 11, "looks nest");
});

test("the readable look passes the contrast checks", async () => {
  const { PM_READABLE: R, PM_ORIGINAL: O } = await import("../src/lib/workflow/process-map/tokens");
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  assert.ok(contrast("#FFFFFF", R.colors.laneLabel) >= 4.5, "lane label");
  assert.ok(contrast("#FFFFFF", R.colors.containerTab) >= 4.5, "tab");
  assert.ok(contrast("#FFFFFF", R.colors.accent) >= 4.5, "accent on white");
  assert.ok(contrast("#FFFFFF", R.colors.muted) >= 4.5, "muted text");
  assert.ok(contrast("#FFFFFF", O.colors.laneLabel) < 4.5, "(the original lane label is the one that failed)");
});

test("a map with no look, or look 'original', is drawn exactly as before; look 'readable' is drawn bigger with an accent main path", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const { SceneSvg } = await import("../src/components/workflow/process-map/shapes");
  const { buildScene } = await import("../src/lib/workflow/process-map/scene");
  const { layoutDiagram, applyLayout } = await import("../src/lib/workflow/process-map/diagram-layout");
  const { lintLayout } = await import("../src/lib/workflow/process-map/lint");
  const { PM_READABLE, PM_ORIGINAL } = await import("../src/lib/workflow/process-map/tokens");
  const { decision, end } = await import("./fixtures/process-map-fixtures");
  const nodes = [start("s", "Applies"), decision("d", "Pass?"), system("a", "Sends invite", "message"), end("e", "Rejected", "failure")];
  const edges = [edge("e1", "s", "d", "", { isPrimary: true, isHappyPath: true }), edge("e2", "d", "a", "Yes", { isPrimary: true, isHappyPath: true }), edge("e3", "d", "e", "No")];
  const draw = (look?: string) => {
    const laid = applyLayout(nodes, edges, layoutDiagram(nodes, edges, look));
    const scene = buildScene(laid.nodes, laid.edges, { clientName: "X", workflowName: "Y", look } as any);
    return { scene, svg: renderToStaticMarkup(createElement(SceneSvg, { scene })) };
  };
  const none = draw(undefined);
  const original = draw("original");
  assert.equal(none.svg, original.svg, "no look is the same as original");
  assert.equal(none.scene.look, "original");
  assert.ok(original.svg.includes('font-size="11"') && !original.svg.includes("var(--font-inter)"), "original: 11px, DM Sans");
  assert.ok(!original.svg.includes(PM_READABLE.colors.accent), "original: no accent colour anywhere");
  assert.ok(original.svg.includes(PM_ORIGINAL.colors.decision), "original: the blue decision");
  assert.equal(original.scene.shapes.find((s) => s.kind === "process")!.rect.w, 240);

  const readable = draw("readable");
  assert.equal(readable.scene.look, "readable");
  assert.equal(readable.scene.shapes.find((s) => s.kind === "process")!.rect.w, 264);
  assert.ok(readable.svg.includes('font-size="13"') && readable.svg.includes("var(--font-inter)"), "readable: 13px, Inter");
  assert.ok(readable.svg.includes(`stroke="${PM_READABLE.colors.accent}" stroke-width="3.2"`), "main path accent and thick");
  assert.ok(readable.svg.includes(`stroke="${PM_READABLE.colors.branchLine}" stroke-width="1.4"`), "branch thin grey");
  assert.ok(readable.svg.includes(PM_READABLE.colors.decision) && !readable.svg.includes(PM_ORIGINAL.colors.decision), "readable: the quiet decision");
  assert.equal(lintLayout(readable.scene).filter((f) => f.severity === "high").length, 0, "no serious layout findings in the readable look");
});
