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
