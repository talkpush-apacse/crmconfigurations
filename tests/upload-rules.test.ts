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
