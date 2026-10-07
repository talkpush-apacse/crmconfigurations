import test from "node:test";
import assert from "node:assert/strict";
import { ACTION_TEXT, describeAuditAction } from "../src/lib/workflow/audit-text";

test("activity wording: filing a workflow under a company names the company", () => {
  assert.equal(describeAuditAction("account.linked", { accountName: "Acme" }), "filed this workflow under Acme");
});

test("activity wording: moving says from and to", () => {
  assert.equal(describeAuditAction("account.linked", { accountName: "Globex", previousAccountName: "Acme" }), "moved this workflow from Acme to Globex");
});

test("activity wording: taking it out names where it came from", () => {
  assert.equal(describeAuditAction("account.unlinked", { previousAccountName: "Acme" }), "took this workflow out of Acme");
});

test("activity wording: entries without names still read well", () => {
  assert.equal(describeAuditAction("account.linked", {}), "filed this workflow under a company");
  assert.equal(describeAuditAction("account.linked", { accountName: "  " }), "filed this workflow under a company");
  assert.equal(describeAuditAction("account.linked"), "filed this workflow under a company");
  assert.equal(describeAuditAction("account.unlinked", null), "took this workflow out of its company");
});

test("activity wording: every other action reads as before, and an unknown one shows its name", () => {
  assert.equal(describeAuditAction("comment.created"), ACTION_TEXT["comment.created"]);
  assert.equal(describeAuditAction("review.approved", { x: 1 }), "approved");
  assert.equal(describeAuditAction("something.new"), "something.new");
});
