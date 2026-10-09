import test from "node:test";
import assert from "node:assert/strict";
import { buildCommentAlertEmail, oneLine } from "../src/lib/comment-alerts/comment-alert-email";
import { shouldAlertTrackerRemark, shouldAlertWorkflowComment, trackerAuthorName } from "../src/lib/comment-alerts/rules";

const BASE = {
  placeName: "Concentrix PH, Hiring flow",
  companyName: "Concentrix PH",
  authorName: "Maria Cruz",
  body: "Can we add a step for the background check?",
  url: "https://crmconfig.talkpush.com/admin/workflows/w1",
  when: new Date("2026-10-09T06:30:00Z"),
};

test("a workflow comment says who, where, what, and when, with a button to the workflow", () => {
  const e = buildCommentAlertEmail({ ...BASE, kind: "workflow", isReply: false });
  assert.equal(e.subject, "New comment on the workflow Concentrix PH, Hiring flow");
  assert.match(e.html, /Maria Cruz left a comment on a workflow/);
  assert.match(e.html, /Can we add a step for the background check\?/);
  assert.match(e.html, /9 Oct 2026, 06:30 UTC/);
  assert.match(e.html, /href="https:\/\/crmconfig\.talkpush\.com\/admin\/workflows\/w1"/);
  assert.match(e.html, /Open the workflow/);
  assert.match(e.text, /Maria Cruz/);
});

test("a tracker comment names the project, company and item", () => {
  const e = buildCommentAlertEmail({ ...BASE, kind: "tracker", isReply: false, placeName: "Implementation", itemTitle: "Set up SSO", url: "https://crmconfig.talkpush.com/admin/tracker/projects/p1" });
  assert.equal(e.subject, "New comment in the tracker Implementation");
  assert.match(e.html, /Set up SSO/);
  assert.match(e.html, /Concentrix PH/);
  assert.match(e.html, /Open the project tracker/);
});

test("a reply is called a reply", () => {
  const e = buildCommentAlertEmail({ ...BASE, kind: "workflow", isReply: true });
  assert.match(e.subject, /^New reply on the workflow/);
  assert.match(e.html, /left a reply on a workflow/);
});

test("the subject never contains the commenter's name or the comment, and is one clean line", () => {
  const e = buildCommentAlertEmail({ ...BASE, kind: "workflow", isReply: false, authorName: "Evil\r\nBcc: x@y.com", body: "Subject: hacked", placeName: "Flow\r\nBcc: a@b.com" });
  assert.doesNotMatch(e.subject, /Evil|hacked/);
  assert.ok(!/[\r\n]/.test(e.subject));
});

test("anything a person typed is escaped, and long comments are cut", () => {
  const e = buildCommentAlertEmail({ ...BASE, kind: "workflow", isReply: false, body: `<script>alert(1)</script> ${"x".repeat(2000)}` });
  assert.doesNotMatch(e.html, /<script>alert/);
  assert.match(e.html, /&lt;script&gt;/);
  assert.ok(e.html.length < 20000);
});

test("no em dash appears in the email, and an empty place name still gives a readable subject", () => {
  const e = buildCommentAlertEmail({ ...BASE, kind: "workflow", isReply: false, placeName: "  " });
  assert.ok(!e.html.includes("—") && !e.text.includes("—"));
  assert.equal(e.subject, "New comment on the workflow a workflow");
});

test("oneLine flattens line breaks and cuts long text", () => {
  assert.equal(oneLine("a\r\n  b\tc", 20), "a b c");
  assert.equal(oneLine("x".repeat(100), 10), "xxxxxxx...");
});

test("workflow comments alert only when they did not come from signed-in staff", () => {
  assert.equal(shouldAlertWorkflowComment({}), true);
  assert.equal(shouldAlertWorkflowComment({ admin: { id: "a1", label: "roy@talkpush.com" } }), false);
});

test("tracker comments alert only when shared AND from a client or Claude", () => {
  assert.equal(shouldAlertTrackerRemark({ via: "client", visibility: "shared" }), true);
  assert.equal(shouldAlertTrackerRemark({ via: "mcp", visibility: "shared" }), true);
  assert.equal(shouldAlertTrackerRemark({ via: "web", visibility: "shared" }), false);
  assert.equal(shouldAlertTrackerRemark({ via: "client", visibility: "internal" }), false);
  assert.equal(shouldAlertTrackerRemark({ via: "mcp", visibility: "internal" }), false);
});

test("the author name drops the client prefix, and Claude shows as Claude", () => {
  assert.equal(trackerAuthorName("client:Maria Cruz", "client"), "Maria Cruz");
  assert.equal(trackerAuthorName("Claude for admin", "mcp"), "Claude");
  assert.equal(trackerAuthorName("client:", "client"), "A client contact");
});
