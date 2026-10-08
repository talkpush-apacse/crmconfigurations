import test from "node:test";
import assert from "node:assert/strict";
import { activityTabForSlug } from "../src/lib/edit-history/tab-keys";
import { displayNameFor, isMe } from "../src/lib/edit-history/activity-rules";
import { parseActivityQuery } from "../src/lib/edit-history/activity-http";

test("a tab address maps to the saved sections and history name it belongs to", () => {
  assert.deepEqual(activityTabForSlug("users"), { tabKey: "users", fields: ["users"] });
  assert.deepEqual(activityTabForSlug("ai-call-faqs"), { tabKey: "aiCallFaqs", fields: ["aiCallFaqs"] });
  assert.deepEqual(activityTabForSlug("company-info"), { tabKey: "companyInfo", fields: ["companyInfo"] });
  // Every custom tab is stored in the same two sections, but has its own history name.
  assert.deepEqual(activityTabForSlug("custom-ai-call-scripts"), { tabKey: "custom-ai-call-scripts", fields: ["customTabs", "customData"] });
  // Pages that are not a checklist tab, and anything odd.
  for (const bad of ["welcome", "history", "snapshots", "", "no such tab", "../x", "a".repeat(101)]) {
    assert.equal(activityTabForSlug(bad), null, bad);
  }
});

test("names: clients never see a staff email; staff see full names; shared links are described, not named", () => {
  assert.equal(displayNameFor("link", "Jane Cruz (TP)", "client"), "Jane Cruz (TP)");
  assert.equal(displayNameFor("link", "Jane Cruz (TP)", "staff"), "Jane Cruz (TP)");
  assert.equal(displayNameFor("admin", "jolo@example.com", "client"), "Talkpush team");
  assert.equal(displayNameFor("admin", "jolo@example.com", "staff"), "jolo@example.com");
  assert.equal(displayNameFor("mcp", "Claude (MCP)", "client"), "Talkpush team");
  assert.equal(displayNameFor("mcp", "Claude (MCP)", "staff"), "Claude (MCP)");
  assert.equal(displayNameFor("legacy_link", "Original shared link (unnamed)", "client"), "Someone using the shared link");
  assert.equal(displayNameFor("slug", "Client form link (unnamed)", "staff"), "Someone using the client form link");
  assert.equal(displayNameFor("system", "x@y.z", "client"), "Talkpush team", "an unknown kind never leaks its raw name to a client");
});

test("which changes are 'mine'", () => {
  const ev = (actorType: string, actorName: string, linkId: string | null) => ({ actorType, actorName, linkId });
  assert.equal(isMe(ev("link", "Jane", "L1"), { linkId: "L1", actorType: "link" }), true);
  assert.equal(isMe(ev("link", "Jane", "L2"), { linkId: "L1", actorType: "link" }), false);
  assert.equal(isMe(ev("admin", "a@x", null), { actorType: "admin", name: "a@x" }), true);
  assert.equal(isMe(ev("admin", "b@x", null), { actorType: "admin", name: "a@x" }), false);
  assert.equal(isMe(ev("legacy_link", "o", null), { actorType: "legacy_link" }), true);
  assert.equal(isMe(ev("slug", "s", null), { actorType: "legacy_link" }), false);
  assert.equal(isMe(ev("link", "Jane", "L1"), { actorType: "admin", name: "a@x" }), false);
});

test("the request's tab and version are validated", () => {
  const q = (s: string) => parseActivityQuery(new URLSearchParams(s));
  assert.deepEqual(q("tab=users&since=7"), { slug: "users", since: 7 });
  assert.deepEqual(q("tab=users"), { slug: "users", since: null });
  assert.deepEqual(q("tab=users&since=-1"), { slug: "users", since: null });
  assert.deepEqual(q("tab=users&since=1.5"), { slug: "users", since: null });
  assert.deepEqual(q("tab=users&since=abc"), { slug: "users", since: null });
  assert.deepEqual(q("tab=a%20b"), { slug: null, since: null });
  assert.deepEqual(q(""), { slug: null, since: null });
  assert.deepEqual(q("tab=users&since=0"), { slug: "users", since: 0 });
});
