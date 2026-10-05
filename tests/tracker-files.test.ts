import test from "node:test";
import assert from "node:assert/strict";
import { buildStoragePath, checkFile, fileExtension, formatBytes, MAX_FILE_BYTES, pathBelongsToProject, safeFileName } from "../src/lib/tracker/file-rules";
import { describeActivity } from "../src/lib/tracker/activity-text";

test("only the approved kinds of file are accepted, decided by extension", () => {
  for (const name of ["Contract.pdf", "scope.DOCX", "plan.pptx", "sheet.xlsx", "data.csv", "notes.txt", "scan.PNG", "photo.jpeg"]) {
    assert.equal(checkFile(name, 1000).ok, true, name);
  }
  for (const name of ["run.exe", "page.html", "image.svg", "script.js", "archive.zip", "noextension", "trick.pdf.exe", ".htaccess"]) {
    assert.equal(checkFile(name, 1000).ok, false, name);
  }
});

test("the mime type comes from our list, never from the browser", () => {
  const r = checkFile("Contract.PDF", 1000);
  assert.equal(r.ok && r.mimeType, "application/pdf");
});

test("empty and oversized files are refused with a plain message", () => {
  const empty = checkFile("a.pdf", 0);
  assert.equal(empty.ok, false);
  const big = checkFile("a.pdf", MAX_FILE_BYTES + 1);
  assert.equal(big.ok, false);
  assert.match(big.ok ? "" : big.error, /limit is 25\.0 MB/);
  assert.equal(checkFile("a.pdf", MAX_FILE_BYTES).ok, true);
});

test("file names are made safe for storage", () => {
  assert.equal(safeFileName("../../etc/passwd.pdf"), "passwd.pdf");
  assert.equal(safeFileName("C:\\Users\\me\\Signed Contract (final).pdf"), "Signed_Contract_final_.pdf");
  assert.equal(safeFileName("....pdf"), "pdf");
  assert.equal(safeFileName("---.pdf").endsWith(".pdf"), true);
  assert.ok(safeFileName(`${"a".repeat(300)}.pdf`).length <= 84);
  assert.equal(fileExtension("a.b.PDF"), "pdf");
});

test("a stored path only ever belongs to the project it was issued for", () => {
  const path = buildStoragePath("proj1", "uuid-1", "contract.pdf");
  assert.equal(path, "projects/proj1/uuid-1-contract.pdf");
  assert.equal(pathBelongsToProject(path, "proj1"), true);
  assert.equal(pathBelongsToProject(path, "proj2"), false);
  assert.equal(pathBelongsToProject("projects/proj1/../proj2/x.pdf", "proj1"), false);
  assert.equal(pathBelongsToProject("projects/proj1/sub/x.pdf", "proj1"), false);
  assert.equal(pathBelongsToProject("projects/proj1/", "proj1"), false);
  assert.equal(pathBelongsToProject("branding-assets/logos/x.png", "proj1"), false);
});

test("sizes read like a person would say them", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
});

test("the activity feed describes file changes in a sentence", () => {
  assert.equal(describeActivity({ action: "file.added", entityTitle: null, before: null, after: { fileName: "MSA.pdf", kind: "contract" } }), 'added the contract file "MSA.pdf"');
  assert.equal(describeActivity({ action: "file.added", entityTitle: null, before: null, after: { fileName: "x.csv", kind: "other" } }), 'added the file "x.csv"');
  assert.equal(describeActivity({ action: "file.removed", entityTitle: null, before: { fileName: "MSA.pdf" }, after: null }), 'removed the file "MSA.pdf"');
});
