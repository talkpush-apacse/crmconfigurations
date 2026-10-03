import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { layoutProcessMap, applyLayout } from "../src/lib/workflow/process-map/layout";
import { buildScene } from "../src/lib/workflow/process-map/scene";
import { SceneSvg } from "../src/components/workflow/process-map/shapes";
import { projectPageForClient } from "../src/lib/workflow/access/client-view";
import { myPalLike, pilotLike, table, step, edge } from "./fixtures/process-map-fixtures";

/* eslint-disable @typescript-eslint/no-explicit-any */
const meta = { clientName: "McDonald's PH", workflowName: "MyPal portal", versionLabel: "v3", date: "2026-10-02", author: "Talkpush" };

function svgFor(nodes: any[], edges: any[], over: Record<string, unknown> = {}) {
  const laid = applyLayout(nodes, edges, layoutProcessMap(nodes, edges));
  const scene = buildScene(laid.nodes, laid.edges, { ...meta, ...over });
  return { scene, svg: renderToStaticMarkup(createElement(SceneSvg, { scene })) };
}
const withTable = () => {
  const { nodes, edges } = myPalLike();
  nodes.push(table("tbl", "Success metrics", ["Metric", "Baseline today", "Target"], [["Reports per month", "200+ per year", "Tracking only"], ["Time to first acknowledgement", "Not available 24/7", "Instant"]], ["1:c2"]));
  return { nodes, edges };
};

test("svg: a standalone document with a viewBox matching the diagram", () => {
  const { nodes, edges } = pilotLike();
  const { scene, svg } = svgFor(nodes, edges);
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  const b = scene.bounds;
  assert.ok(svg.includes(`viewBox="${b.x} ${b.y} ${b.w} ${b.h}"`));
});

test("svg: text is real text (selectable), and every step's words are there", () => {
  const { nodes, edges } = withTable();
  const { svg } = svgFor(nodes, edges);
  assert.ok((svg.match(/<text/g) ?? []).length > 100);
  assert.ok(!svg.includes("<image"), "no pictures of text");
  for (const word of ["Opens the portal", "Choose how to report", "Closed as invalid", "Success metrics", "Baseline today", "Diagram key", "McDonald&#x27;s PH: MyPal portal", "v3 · 2026-10-02 · Talkpush"]) {
    assert.ok(svg.includes(word.replace("&#x27;", "&#x27;")) || svg.includes(word.replace("&#x27;", "'")), `has "${word}"`);
  }
});

test("svg: the key says what the colours mean and never lists tags", () => {
  const { nodes, edges } = myPalLike();
  const { svg } = svgFor(nodes, edges);
  assert.ok(svg.includes("System does it, no person needed"));
  assert.ok(svg.includes("A person acts (role in brackets)"));
  assert.ok(svg.includes("To confirm with McDonald"));
  assert.ok(!/Diagram key[\s\S]{0,2000}\[MOVE\]/.test(svg));
});

test("svg: no broken numbers or placeholders leak into the file", () => {
  const { nodes, edges } = withTable();
  const { svg } = svgFor(nodes, edges);
  for (const bad of ["NaN", "undefined", "Infinity", "[object"]) assert.ok(!svg.includes(bad), `no "${bad}"`);
});

test("svg: a 45-shape, one-table diagram stays under 1 MB and draws quickly", () => {
  const { nodes, edges } = withTable();
  const t0 = Date.now();
  const { svg } = svgFor(nodes, edges);
  assert.ok(svg.length < 1_000_000, `${svg.length} bytes`);
  assert.ok(Date.now() - t0 < 5000);
});

test("svg: circled numerals and branch numbers can be hidden", () => {
  const { nodes, edges } = pilotLike();
  const shown = svgFor(nodes, edges).svg;
  const hidden = svgFor(nodes, edges, { hideNumbers: true }).svg;
  assert.ok(shown.includes("①") && shown.includes("4.1 · No"));
  assert.ok(!hidden.includes("①") && !hidden.includes("4.1 · No") && hidden.includes(">No<"));
});

test("svg: a client's download never contains staff-only steps or notes", () => {
  const { nodes, edges } = pilotLike();
  const secret = step("sec", "INTERNAL-ONLY STEP", { visibility: "internal", internalNotes: "INTERNAL-NOTE" });
  const visible = nodes.find((n: any) => n.id === "t6")!;
  visible.data.internalNotes = "INTERNAL-NOTE-ON-VISIBLE";
  const page = projectPageForClient({ id: "p1", name: "P", nodes: [...nodes, secret], edges: [...edges, edge("es", "t6", "sec")] }, { showFeasibility: false });
  const { svg } = svgFor(page.nodes, page.edges);
  assert.ok(!svg.includes("INTERNAL"), "nothing internal in the exported picture");
});

test("svg: a rejection-reason step is drawn pink and dashed, in the flow", () => {
  const { nodes, edges } = myPalLike();
  const { svg } = svgFor(nodes, edges);
  assert.ok(svg.includes("#FFCDD2") && svg.includes('stroke-dasharray="6 4"'));
  assert.ok(svg.includes("[REJECTION REASON]"));
});

// ---------- the server preview draws exactly what the screen draws ----------

test("server renderer: identical to React's own renderer for real diagrams (with a table and every kind of step)", async () => {
  const { renderSceneSvg } = await import("../src/lib/workflow/render-server");
  for (const make of [withTable, pilotLike]) {
    const { nodes, edges } = make();
    const laid = applyLayout(nodes, edges, layoutProcessMap(nodes, edges));
    const scene = buildScene(laid.nodes, laid.edges, meta);
    assert.equal(renderSceneSvg(scene), renderToStaticMarkup(createElement(SceneSvg, { scene })));
  }
});
