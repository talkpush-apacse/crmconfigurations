import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import {
  detectKind,
  MAX_CHARS_PER_PART,
  readAttachmentContent,
  unsupportedReason,
} from "../src/lib/mcp/attachment-reader";

// Real files, built in memory, so the readers are tested on the actual formats and not on mocks.

async function makeXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sites = wb.addWorksheet("Sites");
  sites.addRow(["Site", "City", "Headcount"]);
  sites.addRow(["Makati HQ", "Makati", 120]);
  sites.addRow(["BGC Hub", "Taguig", { formula: "SUM(10,20)", result: 30 }]);
  sites.addRow(["Note | with pipe", "Line one\nLine two", new Date("2026-03-04T00:00:00Z")]);
  const hidden = wb.addWorksheet("Old");
  hidden.state = "hidden";
  hidden.addRow(["legacy"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function makeDocx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  const cell = (t: string) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`;
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Site plan overview</w:t></w:r></w:p><w:tbl><w:tr>${cell("Site")}${cell("Owner")}</w:tr><w:tr>${cell("Makati HQ")}${cell("Ana Cruz")}</w:tr></w:tbl></w:body></w:document>`
  );
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

/** A one-page PDF with the words "Hello Sites PDF" in it. */
function makePdf(text: string): Buffer {
  const stream = `BT /F1 18 Tf 50 700 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

test("detectKind picks the right reader from the file name or the declared type", () => {
  assert.equal(detectKind("Sites.XLSX", null)?.kind, "spreadsheet");
  assert.equal(detectKind("plan", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")?.kind, "word");
  assert.equal(detectKind("a.pdf", null)?.kind, "pdf");
  assert.equal(detectKind("page.htm", null)?.kind, "html");
  assert.equal(detectKind("notes.csv", null)?.kind, "text");
  assert.deepEqual(detectKind("logo.JPG", null), { kind: "image", imageType: "image/jpeg" });
  assert.equal(detectKind("old.xls", null), null);
  assert.match(unsupportedReason("old.xls", null), /\.xlsx/);
  assert.match(unsupportedReason("deck.pptx", null), /PDF/);
  assert.match(unsupportedReason("movie.mp4", "video/mp4"), /cannot read/);
});

test("an Excel file comes back sheet by sheet with its values, formulas results and dates", async () => {
  const result = await readAttachmentContent(await makeXlsx(), { fileName: "Sites.xlsx", mimeType: null });
  assert.equal(result.kind, "text");
  if (result.kind !== "text") return;
  assert.equal(result.format, "spreadsheet");
  assert.match(result.text, /## Sheet: Sites/);
  assert.match(result.text, /1 \| Site \| City \| Headcount/);
  assert.match(result.text, /2 \| Makati HQ \| Makati \| 120/);
  assert.match(result.text, /3 \| BGC Hub \| Taguig \| 30/, "a formula shows its result, not the formula");
  assert.match(result.text, /Note \\\| with pipe/, "a pipe inside a cell is escaped so columns stay clear");
  assert.match(result.text, /Line one ⏎ Line two/);
  assert.match(result.text, /2026-03-04/);
  assert.match(result.text, /## Sheet: Old \(hidden\)/);
});

test("a Word file keeps its paragraphs and its table rows", async () => {
  const result = await readAttachmentContent(await makeDocx(), { fileName: "plan.docx", mimeType: null });
  assert.equal(result.kind, "text");
  if (result.kind !== "text") return;
  assert.match(result.text, /Site plan overview/);
  assert.match(result.text, /Makati HQ\s+Ana Cruz/);
});

test("a PDF gives its text page by page", async () => {
  const result = await readAttachmentContent(makePdf("Hello Sites PDF"), { fileName: "sites.pdf", mimeType: "application/pdf" });
  assert.equal(result.kind, "text");
  if (result.kind !== "text") return;
  assert.match(result.text, /--- Page 1 of 1 ---/);
  assert.match(result.text, /Hello Sites PDF/);
});

test("a PDF with no text says it is probably a scan", async () => {
  const result = await readAttachmentContent(makePdf(""), { fileName: "scan.pdf", mimeType: null });
  assert.equal(result.kind, "text");
  if (result.kind !== "text") return;
  assert.ok(result.notes.some((n) => /scan/i.test(n)));
});

test("an HTML file loses scripts and styles but keeps text, table rows and links", async () => {
  const html = `<html><head><title>x</title><style>p{color:red}</style></head><body><h1>Sites</h1><script>alert(1)</script>
    <table><tr><th>Site</th><th>City</th></tr><tr><td>Makati</td><td>Manila</td></tr></table>
    <p>See <a href="https://example.com/map">the map</a> &amp; more</p></body></html>`;
  const result = await readAttachmentContent(Buffer.from(html), { fileName: "sites.html", mimeType: "text/html" });
  assert.equal(result.kind, "text");
  if (result.kind !== "text") return;
  assert.match(result.text, /Sites/);
  assert.doesNotMatch(result.text, /alert|color:red/);
  assert.match(result.text, /Makati\s+Manila/);
  assert.match(result.text, /the map \[https:\/\/example.com\/map\] & more/);
});

test("plain text and CSV come back as they are, without a byte-order mark", async () => {
  const result = await readAttachmentContent(Buffer.from("﻿a,b\n1,2"), { fileName: "x.csv", mimeType: "text/csv" });
  assert.equal(result.kind, "text");
  if (result.kind === "text") assert.equal(result.text, "a,b\n1,2");
});

test("a picture is handed back as an image, and an oversized one is refused politely", async () => {
  const tiny = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const ok = await readAttachmentContent(tiny, { fileName: "logo.png", mimeType: "image/png" });
  assert.equal(ok.kind, "image");
  if (ok.kind === "image") {
    assert.equal(ok.mimeType, "image/png");
    assert.equal(ok.base64, tiny.toString("base64"));
  }
  const big = await readAttachmentContent(Buffer.alloc(5 * 1024 * 1024), { fileName: "huge.jpg", mimeType: null });
  assert.equal(big.kind, "unsupported");
});

test("a long file is split into parts and every part can be fetched", async () => {
  const lines = Array.from({ length: 6000 }, (_, i) => `line ${i} ${"x".repeat(20)}`).join("\n");
  const first = await readAttachmentContent(Buffer.from(lines), { fileName: "big.txt", mimeType: null }, 1);
  assert.equal(first.kind, "text");
  if (first.kind !== "text") return;
  assert.ok(first.totalParts > 1);
  assert.equal(first.text.length, MAX_CHARS_PER_PART);
  assert.ok(first.notes.some((n) => /part=2/.test(n)));

  let rebuilt = first.text;
  for (let p = 2; p <= first.totalParts; p++) {
    const next = await readAttachmentContent(Buffer.from(lines), { fileName: "big.txt", mimeType: null }, p);
    assert.equal(next.kind, "text");
    if (next.kind === "text") rebuilt += next.text;
  }
  assert.equal(rebuilt, lines, "the parts put together are the whole file");

  const beyond = await readAttachmentContent(Buffer.from(lines), { fileName: "big.txt", mimeType: null }, first.totalParts + 1);
  assert.equal(beyond.kind, "unsupported");
});

test("a damaged file gives a plain message instead of an error", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    for (const fileName of ["bad.xlsx", "bad.docx", "bad.pdf"]) {
      const result = await readAttachmentContent(Buffer.from("this is not a real file"), { fileName, mimeType: null });
      assert.equal(result.kind, "unsupported", fileName);
      if (result.kind === "unsupported") assert.match(result.reason, /damaged or password-protected/);
    }
  } finally {
    console.error = originalError;
  }
});
