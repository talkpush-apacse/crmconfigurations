import test from "node:test";
import assert from "node:assert/strict";
import { jiraUrlsOf, parseJiraUrl, parseJiraUrls } from "../src/lib/tracker/jira";
import { itemCreateSchema, itemUpdateSchema } from "../src/lib/tracker/validations";

const GOOD = "https://talkpush.atlassian.net/browse/TP-11000";

test("a Talkpush ticket address is accepted and tidied", () => {
  const ok = (input: string) => {
    const r = parseJiraUrl(input);
    assert.equal(r.ok, true, input);
    return r.ok ? r.link : null;
  };
  assert.deepEqual(ok(GOOD), { label: "TP-11000", url: GOOD });
  assert.deepEqual(ok(`  ${GOOD}  `), { label: "TP-11000", url: GOOD });
  assert.deepEqual(ok("https://talkpush.atlassian.net/browse/tp-11000/"), { label: "TP-11000", url: GOOD });
  assert.deepEqual(ok("https://TALKPUSH.atlassian.net/browse/TP-11000?focusedCommentId=5#comment"), { label: "TP-11000", url: GOOD });
});

test("anything that is not a Talkpush Jira ticket is refused", () => {
  const refused = [
    "",
    "   ",
    "TP-11000",
    "not a url",
    "http://talkpush.atlassian.net/browse/TP-11000",
    "https://other.atlassian.net/browse/TP-11000",
    "https://talkpush.atlassian.net.evil.com/browse/TP-11000",
    "https://evil.com/talkpush.atlassian.net/browse/TP-11000",
    "https://talkpush.atlassian.net@evil.com/browse/TP-11000",
    "https://user:pw@talkpush.atlassian.net/browse/TP-11000",
    "https://talkpush.atlassian.net:8443/browse/TP-11000",
    "https://talkpush.atlassian.net/browse/TP-",
    "https://talkpush.atlassian.net/jira/software/projects/TP/boards/1",
    "javascript:alert(1)",
  ];
  for (const input of refused) assert.equal(parseJiraUrl(input).ok, false, `should refuse: ${JSON.stringify(input)}`);
});

test("a list drops repeats of the same ticket and names the first bad address", () => {
  const r = parseJiraUrls([GOOD, "https://talkpush.atlassian.net/browse/tp-11000", "https://talkpush.atlassian.net/browse/TP-2"]);
  assert.equal(r.ok && r.links.map((l) => l.label).join(), "TP-11000,TP-2");
  const bad = parseJiraUrls([GOOD, "https://evil.com/x"]);
  assert.equal(bad.ok, false);
  assert.match(bad.ok ? "" : bad.error, /evil\.com/);
});

test("items can carry several tickets, and the API schema enforces the same rule", () => {
  const created = itemCreateSchema.parse({
    title: "Set up SSO",
    links: [{ url: GOOD }, { label: "whatever", url: "https://talkpush.atlassian.net/browse/TP-2" }, { url: GOOD }],
  });
  assert.deepEqual(created.links, [
    { label: "TP-11000", url: GOOD },
    { label: "TP-2", url: "https://talkpush.atlassian.net/browse/TP-2" },
  ]);
  assert.equal(itemUpdateSchema.parse({ links: [] }).links?.length, 0);
  assert.equal(itemUpdateSchema.parse({}).links, undefined, "leaving links out leaves them unchanged");
  assert.throws(() => itemCreateSchema.parse({ title: "x", links: [{ url: "https://evil.com/browse/TP-1" }] }));
  assert.throws(() => itemUpdateSchema.parse({ links: [{ url: "https://talkpush.atlassian.net/browse/TP-1" }, { url: "ftp://x" }] }));
});

test("reading addresses back tolerates odd stored values", () => {
  assert.deepEqual(jiraUrlsOf([{ label: "a", url: GOOD }, null, 5, { label: "b" }]), [GOOD]);
  assert.deepEqual(jiraUrlsOf(null), []);
});
