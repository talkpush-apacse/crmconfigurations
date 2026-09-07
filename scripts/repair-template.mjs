/**
 * One-time (idempotent) repair of public/template.xlsx so that exceljs can read it.
 *
 * Why this exists
 * ---------------
 * The template was regenerated with openpyxl 3.1.5 in commit 230cb79 (2026-04-02).
 * openpyxl writes valid OOXML that exceljs 4.4.0 cannot parse, in two ways:
 *
 *   1. Drawings declare the spreadsheetDrawing namespace as the DEFAULT namespace
 *      (`<wsDr xmlns="...">`, `<oneCellAnchor>`). exceljs matches literal
 *      `xdr:`-prefixed tag names, so DrawingXform.parseStream() returns undefined
 *      and reconcile() throws "Cannot read properties of undefined (reading 'anchors')".
 *
 *   2. Relationships use absolute part targets (`Target="/xl/tables/table1.xml"`).
 *      exceljs looks tables up by the exact key `../tables/table1.xml`, so worksheet
 *      tables come back undefined and throw "... (reading 'name')".
 *
 * Before this repair, generateExcel() silently fell back to unbranded generation.
 *
 * It also appends the four client-facing columns the app collects but the template
 * lacked, so the branded export loses nothing:
 *   Campaigns List -> N "Assigned Recruiters"
 *   Sites          -> K "Comments/Remarks"
 *   Pre-screening  -> M "Category"
 *   Agency Portal  -> J "Comments/Remarks"
 * (Messaging Templates already ships a Comments/Remarks column at O.)
 *
 * IMPORTANT: if template.xlsx is ever re-exported from openpyxl / Google Sheets,
 * re-run this script, or generateExcel() will start throwing loudly again.
 *
 *   node scripts/repair-template.mjs [--check]
 *
 * --check exits non-zero if the template still needs repair (used by the test).
 */
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip"; // dev-only; installed transitively via exceljs

const TEMPLATE = path.join(process.cwd(), "public", "template.xlsx");
const NS_SD = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";

// Tags in the spreadsheetDrawing namespace that exceljs expects to see `xdr:`-prefixed.
const SD_TAGS = [
  "wsDr", "oneCellAnchor", "twoCellAnchor", "absoluteAnchor", "from", "to", "ext",
  "pic", "nvPicPr", "cNvPr", "cNvPicPr", "blipFill", "spPr", "clientData", "pos",
  "graphicFrame", "nvGraphicFramePr", "cNvGraphicFramePr", "xfrm",
  "col", "colOff", "row", "rowOff",
];

function prefixDrawingNamespace(xml) {
  if (!xml.includes(`xmlns="${NS_SD}"`)) return xml; // already prefixed
  let out = xml.replace(` xmlns="${NS_SD}"`, ` xmlns:xdr="${NS_SD}"`);
  for (const tag of SD_TAGS) {
    out = out.replace(new RegExp(`<${tag}(?=[\\s/>])`, "g"), `<xdr:${tag}`);
    out = out.split(`</${tag}>`).join(`</xdr:${tag}>`);
  }
  return out;
}

function relativiseRelTargets(xml) {
  // Only the part types exceljs resolves by target string. Worksheet targets are
  // matched by entry name, so they are deliberately left alone.
  return xml
    .replace(/Target="\/xl\/tables\//g, 'Target="../tables/')
    .replace(/Target="\/xl\/drawings\//g, 'Target="../drawings/')
    .replace(/Target="\/xl\/media\//g, 'Target="../media/');
}

/** Columns to append: sheet file -> spec. Each is the new last cell of its header row. */
const NEW_COLUMNS = [
  {
    sheet: "sheet5", label: "Campaigns List", headerRow: 17, ref: "N17", style: 203,
    text: "Assigned Recruiters\n\nRecruiters assigned to this campaign. Separate multiple names with commas.",
    col: '<col width="48.38" customWidth="1" style="204" min="14" max="14" />',
    merges: [["B3:M3", "B3:N3"], ["B5:M5", "B5:N5"], ["B6:M6", "B6:N6"], ["B15:M15", "B15:N15"]],
  },
  {
    sheet: "sheet6", label: "Sites", headerRow: 11, ref: "K11", style: 203,
    text: "Comments/Remarks\n\nAdd any notes or details about this site.",
    col: '<col width="48.38" customWidth="1" style="204" min="11" max="11" />',
    merges: [["B3:J3", "B3:K3"], ["B5:J5", "B5:K5"], ["B9:J9", "B9:K9"]],
  },
  {
    sheet: "sheet7", label: "Pre-screening & Follow-up Quest", headerRow: 17, ref: "M17", style: 203,
    text: "Category\n\nWhether this is a Pre-screening or a Follow-up question.",
    col: '<col width="23.63" customWidth="1" style="204" min="13" max="13" />',
    merges: [["B3:L3", "B3:M3"], ["B5:L5", "B5:M5"], ["B14:L14", "B14:M14"]],
  },
  {
    sheet: "sheet16", label: "Agency Portal", headerRow: 11, ref: "J11", style: 203,
    text: "Comments/Remarks\n\nAdd any notes or details about this agency.",
    col: '<col width="48.38" customWidth="1" style="204" min="10" max="10" />',
    merges: [["B3:I3", "B3:J3"], ["B5:I5", "B5:J5"], ["B9:I9", "B9:J9"]],
  },
];

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function appendHeaderColumn(xml, spec) {
  if (xml.includes(`<c r="${spec.ref}"`)) return { xml, changed: false }; // idempotent

  const rowRe = new RegExp(`(<row r="${spec.headerRow}"[^>]*>)([\\s\\S]*?)(</row>)`);
  const m = xml.match(rowRe);
  if (!m) throw new Error(`${spec.sheet}: header row ${spec.headerRow} not found`);

  const cell =
    `<c r="${spec.ref}" s="${spec.style}" t="inlineStr">` +
    `<is><t xml:space="preserve">${esc(spec.text)}</t></is></c>`;

  let out = xml.replace(rowRe, `$1$2${cell}$3`);

  // Widen the banner merges so the new column sits inside the styled block.
  for (const [from, to] of spec.merges) {
    if (!out.includes(`ref="${from}"`)) throw new Error(`${spec.sheet}: merge ${from} not found`);
    out = out.split(`ref="${from}"`).join(`ref="${to}"`);
  }

  // Give the new column an explicit width.
  if (!out.includes("</cols>")) throw new Error(`${spec.sheet}: no <cols> block`);
  out = out.replace("</cols>", `${spec.col}</cols>`);

  return { xml: out, changed: true };
}

const checkOnly = process.argv.includes("--check");

const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE));
const changes = [];

for (const name of Object.keys(zip.files)) {
  if (zip.files[name].dir) continue;
  const isDrawing = /^xl\/drawings\/drawing\d+\.xml$/.test(name);
  const isRels = name.startsWith("xl/") && name.endsWith(".rels");
  const sheetSpec = NEW_COLUMNS.find((s) => name === `xl/worksheets/${s.sheet}.xml`);
  if (!isDrawing && !isRels && !sheetSpec) continue;

  const before = await zip.file(name).async("string");
  let after = before;

  if (isDrawing) after = prefixDrawingNamespace(after);
  if (isRels) after = relativiseRelTargets(after);
  if (sheetSpec) {
    const r = appendHeaderColumn(after, sheetSpec);
    after = r.xml;
    if (r.changed) changes.push(`added ${sheetSpec.ref} "${sheetSpec.text.split("\n")[0]}" to ${sheetSpec.label}`);
  }

  if (after !== before) {
    if (!isDrawing && !isRels) { /* already logged above */ }
    else changes.push(`repaired ${name}`);
    zip.file(name, after);
  }
}

if (checkOnly) {
  if (changes.length) {
    console.error("template.xlsx needs repair:\n  " + changes.join("\n  "));
    console.error("\nRun: node scripts/repair-template.mjs");
    process.exit(1);
  }
  console.log("template.xlsx is already exceljs-compatible.");
  process.exit(0);
}

if (!changes.length) {
  console.log("Nothing to do — template.xlsx is already repaired.");
} else {
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(TEMPLATE, buf);
  console.log("Repaired public/template.xlsx:");
  for (const c of changes) console.log("  -", c);
}
