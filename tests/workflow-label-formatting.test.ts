import test from "node:test";
import assert from "node:assert/strict";
import { hasInline, moveStepLabel, stripInline } from "../src/lib/workflow/process-map/inline-text";
import { boxFor, wrapRuns, wrapText } from "../src/lib/workflow/process-map/text-fit";
import { system } from "./fixtures/process-map-fixtures";

/* eslint-disable @typescript-eslint/no-explicit-any */
test("label formatting: bold, italic and underline markers are stripped for plain text", () => {
  assert.equal(stripInline("Moves to **Rejected** Folder/Stage"), "Moves to Rejected Folder/Stage");
  assert.equal(stripInline("Sends *urgent* __reminder__ email"), "Sends urgent reminder email");
  assert.equal(stripInline("**bold *and italic* too**"), "bold and italic too");
  assert.equal(stripInline("No markers here"), "No markers here");
});

test("label formatting: things that only look like markers stay as typed", () => {
  for (const s of ["5 * 3 * 2", "Required*", "snake_case_name", "unclosed **bold", "a ** b ** c"]) {
    assert.equal(stripInline(s), s, s);
    assert.equal(hasInline(s), false, s);
  }
});

test("label formatting: any style counts as formatting", () => {
  assert.equal(hasInline("a *b* c"), true);
  assert.equal(hasInline("a __b__ c"), true);
  assert.equal(hasInline("a **b** c"), true);
  assert.equal(hasInline("plain"), false);
});

test("label formatting: plain labels wrap exactly as before", () => {
  const text = "Sends application received email immediately after applying to the role";
  assert.deepEqual(wrapRuns(text, 24).map((l) => l.runs.map((r) => r.text).join("")), wrapText(text, 24));
});

test("label formatting: styled words keep their style across lines", () => {
  const lines = wrapRuns("Sends a __very important__ and *friendly* reminder", 16);
  const styled = lines.flatMap((l) => l.runs).filter((r) => r.underline || r.italic);
  assert.equal(styled.filter((r) => r.underline).map((r) => r.text.trim()).join(" "), "very important");
  assert.equal(styled.filter((r) => r.italic).map((r) => r.text.trim()).join(" "), "friendly");
  assert.equal(lines.map((l) => l.runs.map((r) => r.text).join("")).join(" ").replace(/\s+/g, " "), "Sends a very important and friendly reminder");
  for (const l of lines) assert.ok(l.runs.map((r) => r.text).join("").length <= 16);
});

test("label formatting: a step box draws italic and underline from its label", () => {
  const node: any = system("a", "Moves to *Rejected* and __closes__", "move");
  const runs = boxFor(node).lines.flatMap((l) => l.runs);
  assert.ok(runs.some((r) => r.italic && r.text.includes("Rejected")));
  assert.ok(runs.some((r) => r.underline && r.text.includes("closes")));
  // The same step with no markers is one plain run per line.
  const plain = boxFor(system("b", "Moves to Rejected and closes", "move")).lines.flatMap((l) => l.runs);
  assert.ok(plain.every((r) => !r.italic && !r.underline));
});

test("label formatting: markers never change how tall the box is (the text is measured without them)", () => {
  const marked = boxFor(system("a", "Moves to **Rejected** and sends the *not selected* email", "move"));
  const bare = boxFor(system("b", "Moves to Rejected and sends the not selected email", "move"));
  assert.equal(marked.height, bare.height);
});

test("label formatting: a step that is already styled is not rewritten by the Move wording helper", () => {
  assert.equal(moveStepLabel("Moves to *Rejected* Folder/Stage"), "Moves to *Rejected* Folder/Stage");
  assert.equal(moveStepLabel("Moves to Rejected"), "Moves to **Rejected** Folder/Stage");
});
