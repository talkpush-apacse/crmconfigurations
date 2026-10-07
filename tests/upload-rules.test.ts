import test from "node:test";
import assert from "node:assert/strict";
import { checkUploadType, isBlockedFile } from "../src/lib/upload-rules";

test("tab uploads accept any file type", () => {
  for (const [name, type] of [
    ["campaigns.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["brief.pdf", "application/pdf"],
    ["page.html", "text/html"],
    ["logo.svg", "image/svg+xml"],
    ["notes.txt", "text/plain"],
    ["deck.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    ["archive.zip", "application/zip"],
    ["mystery.xyz", ""],
  ]) {
    assert.equal(checkUploadType("tab-uploads", name, type), null, name);
  }
});

test("executables are blocked everywhere", () => {
  assert.ok(isBlockedFile("setup.exe", "application/x-msdownload"));
  assert.ok(isBlockedFile("SETUP.EXE", ""));
  assert.ok(isBlockedFile("renamed.bin", "application/vnd.microsoft.portable-executable"));
  assert.ok(checkUploadType("tab-uploads", "setup.exe", "application/octet-stream"));
  assert.ok(checkUploadType("logos", "setup.exe", "image/png"));
});

test("other folders keep the original type list", () => {
  assert.equal(checkUploadType("logos", "logo.png", "image/png"), null);
  assert.ok(checkUploadType("logos", "page.html", "text/html"));
  assert.ok(checkUploadType("general", "notes.txt", "text/plain"));
});

test("an .exe-looking name is not a false positive for similar files", () => {
  assert.equal(isBlockedFile("exe-guide.pdf", "application/pdf"), false);
  assert.equal(isBlockedFile("my.exe.pdf", "application/pdf"), false);
});

import {
  MAX_UPLOAD_BYTES,
  buildTabUploadPath,
  checkTabUploadFile,
  isTabUploadPath,
  safeUploadName,
} from "../src/lib/upload-rules";

test("tab upload size: up to 10 MB passes, over fails, empty fails", () => {
  assert.equal(checkTabUploadFile("big.pdf", MAX_UPLOAD_BYTES, "application/pdf"), null);
  assert.equal(checkTabUploadFile("ok.pdf", 8 * 1024 * 1024, "application/pdf"), null);
  assert.match(checkTabUploadFile("big.pdf", MAX_UPLOAD_BYTES + 1, "application/pdf") ?? "", /10 MB/);
  assert.ok(checkTabUploadFile("empty.pdf", 0, "application/pdf"));
  assert.match(checkTabUploadFile("setup.exe", 100, "") ?? "", /exe/);
});

test("generated tab upload paths are recognised, other paths are not", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  const path = buildTabUploadPath("My Campaigns (final).pdf", id, 1760000000000);
  assert.equal(path, `tab-uploads/1760000000000-${id}-My_Campaigns__final_.pdf`);
  assert.ok(isTabUploadPath(path));
  assert.equal(isTabUploadPath("logos/1760000000000-x.png"), false);
  assert.equal(isTabUploadPath("tab-uploads/../logos/a.png"), false);
  assert.equal(isTabUploadPath(`tab-uploads/1760000000000-${id}-a/b.png`), false);
});

test("safeUploadName strips folders and odd characters", () => {
  assert.equal(safeUploadName("C:\\temp\\../evil name.pdf"), "evil_name.pdf");
  assert.equal(safeUploadName(""), "file");
});
