import test from "node:test";
import assert from "node:assert/strict";
import { buildActivityDigestEmail } from "../src/lib/activity-digest/digest-email";
import { summariseArea } from "../src/lib/activity-digest/describe";
import { canReceiveDigest } from "../src/lib/activity-digest/recipient";
import { parseSlotDate } from "../src/lib/activity-digest/window";
import type { DigestArea, DigestEntry } from "../src/lib/activity-digest/types";

const ME = "jolo.yu@talkpush.com";
const TUE = parseSlotDate("2026-10-06");
const MON = parseSlotDate("2026-10-05");
const BASE = "https://crmconfig.talkpush.com";

function entry(over: Partial<DigestEntry> = {}): DigestEntry {
  return { area: "tracker", groupId: "p1", groupTitle: "Concentrix PH, Implementation", groupPath: "/admin/tracker/projects/p1", at: new Date("2026-10-05T03:00:00Z"), actor: "roy.santos@talkpush.com", text: 'moved "Set up SSO" from In progress to Done', ...over };
}
const summaries = (entries: DigestEntry[]) => (["tracker", "workflow", "checklist"] as DigestArea[]).map((a) => summariseArea(a, entries, ME));
const make = (entries: DigestEntry[], extra: Partial<Parameters<typeof buildActivityDigestEmail>[0]> = {}) =>
  buildActivityDigestEmail({ areas: summaries(entries), failedAreas: [], notes: [], slot: TUE, appBaseUrl: BASE, ...extra });

test("subject and headline say how many changes and since when (yesterday, or Friday on a Monday)", () => {
  const many = make([entry(), entry({ text: "a" }), entry({ text: "b" })]);
  assert.equal(many.subject, "Hub activity: 3 changes since yesterday");
  assert.equal(many.totalChanges, 3);
  assert.match(many.html, /3 changes were made in the Hub since yesterday at 8:00 am/);
  assert.equal(make([entry()]).subject, "Hub activity: 1 change since yesterday");
  assert.match(make([entry()]).html, /1 change was made in the Hub since yesterday at 8:00 am/);
  assert.equal(make([entry()], { slot: MON }).subject, "Hub activity: 1 change since Friday");
  assert.match(make([entry()], { slot: MON }).html, /since Friday at 8:00 am/);
});

test("the subject is built from counts only, never from anything a person typed", () => {
  const e = make([entry({ groupTitle: "<b>Evil</b>\r\nBcc: x@y.com", text: "did Subject: hacked" })]);
  assert.doesNotMatch(e.subject, /Evil|Bcc|hacked/);
  assert.ok(!/[\r\n]/.test(e.subject));
});

test("sections appear in the fixed order, only when they have changes, and each group links to its staff page", () => {
  const e = make([
    entry({ area: "checklist", groupId: "c1", groupTitle: "Example Harbor", groupPath: "/admin/checklists/c1", actor: "A client", text: "edited the Contacts tab" }),
    entry(),
    entry({ area: "workflow", groupId: "w1", groupTitle: "Hiring flow", groupPath: "/admin/workflows/w1", text: "published a version" }),
  ]);
  const order = ["Project trackers", "Workflows", "Checklists"].map((t) => e.text.indexOf(`${t.toUpperCase()}\n`));
  assert.ok(order.every((i) => i >= 0), "all three sections");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "in order");
  assert.match(e.html, new RegExp(`href="${BASE}/admin/tracker/projects/p1"`));
  assert.match(e.html, new RegExp(`href="${BASE}/admin/workflows/w1"`));
  assert.match(e.html, new RegExp(`href="${BASE}/admin/checklists/c1"`));
  assert.match(e.text, /Roy Santos moved "Set up SSO" from In progress to Done/);
  assert.match(e.text, /A client edited the Contacts tab/);
});

test("a group shows its title, then its company after a middle dot", () => {
  const e = make([entry({ groupSubtitle: "Concentrix Philippines" })]);
  assert.match(e.text, /Concentrix PH, Implementation \u00b7 Concentrix Philippines: https:\/\/crmconfig\.talkpush\.com\/admin\/tracker\/projects\/p1/);
  assert.match(e.html, /&middot; Concentrix Philippines/);
});

test("an area with no changes gets no section but still shows 'No changes' in the summary", () => {
  const e = make([entry()]);
  assert.doesNotMatch(e.text, /^WORKFLOWS\n/m);
  assert.match(e.text, /Workflows: No changes/);
  assert.match(e.text, /Project trackers: 1 change/);
});

test("a source that could not be loaded is named, not shown as empty", () => {
  const e = make([entry()], { failedAreas: ["workflow"], notes: [{ tone: "note", text: "Workflow changes could not be loaded today." }] });
  assert.match(e.text, /Workflows: Could not be loaded/);
  assert.match(e.html, /Workflow changes could not be loaded today\./);
});

test("a day with nothing but a failed source still reads sensibly", () => {
  const e = make([], { failedAreas: ["tracker", "workflow"], notes: [{ tone: "note", text: "Some changes could not be loaded today." }] });
  assert.equal(e.subject, "Hub activity: no changes found since yesterday");
  assert.equal(e.totalChanges, 0);
  assert.match(e.html, /Nothing to list\. Some changes could not be loaded\./);
});

test("the standing note about partial checklist coverage is shown after the sections", () => {
  const note = "Checklist edits by staff and by Claude are not included yet, and checklist edits show the tab only.";
  const e = make([entry()], { notes: [{ tone: "info", text: note }] });
  assert.ok(e.text.indexOf(note) > e.text.indexOf("Concentrix PH"));
});

test("groups that did not fit are counted, with the right word", () => {
  const many = Array.from({ length: 13 }, (_, i) => entry({ groupId: `p${i}`, groupTitle: `Project ${i}` }));
  assert.match(make(many).html, /And 3 more projects with changes\. Open the Hub to see them\./);
});

test("with no Hub address there are no links and no button, but the email still builds", () => {
  const e = make([entry()], { appBaseUrl: "" });
  assert.doesNotMatch(e.html, /<a [^>]*href=/);
  assert.match(e.text, /Roy Santos moved/);
});

test("exactly one button, the footer says why and how to stop, and nothing we wrote has an em dash or exclamation mark", () => {
  const e = make([entry(), entry({ area: "workflow", groupId: "w1", groupTitle: "W", groupPath: "/admin/workflows/w1", text: "published a version" })], {
    notes: [{ tone: "info", text: "Checklist edits by staff and by Claude are not included yet, and checklist edits show the tab only." }],
  });
  assert.equal((e.html.match(/class="dm-btn"/g) ?? []).length, 1);
  assert.match(e.html, /every weekday at 8:00 am Manila time because you are a super admin/);
  assert.match(e.html, /remove ACTIVITY_DIGEST_TO/);
  for (const body of [e.html, e.text, e.subject]) assert.ok(!body.includes("—"), "em dash");
  assert.ok(!e.subject.includes("!") && !e.text.includes("!"));
});

test("titles and names typed by people are escaped everywhere", () => {
  const evil = `<script>alert(1)</script>"'&`;
  const e = make([entry({ groupTitle: evil, groupSubtitle: evil, actor: evil, text: `moved "${evil}"` })]);
  assert.doesNotMatch(e.html, /<script>/);
  assert.match(e.html, /&lt;script&gt;/);
});

test("a worst-case day stays under the size where Gmail starts clipping", () => {
  const entries: DigestEntry[] = [];
  const areas: Array<[DigestArea, string]> = [["tracker", "/admin/tracker/projects/"], ["workflow", "/admin/workflows/"], ["checklist", "/admin/checklists/"]];
  for (const [area, path] of areas) {
    for (let g = 0; g < 20; g++) {
      for (let i = 0; i < 33; i++) {
        entries.push(entry({ area, groupId: `${area}${g}`, groupTitle: `A fairly long client and project name number ${g}`, groupSubtitle: "Concentrix Philippines", groupPath: `${path}${g}`, at: new Date(1791000000000 + i * 60000), text: `moved "A fairly long item title that goes on number ${i}" from In progress to Done` }));
      }
    }
  }
  assert.equal(entries.length, 1980);
  const e = make(entries);
  const kb = Buffer.byteLength(e.html) / 1024;
  assert.ok(kb < 90, `email was ${kb.toFixed(1)} KB`);
  assert.equal(e.totalChanges, 1980);
});

test("only a super admin who is a Talkpush Admin may receive the digest", () => {
  assert.equal(canReceiveDigest({ role: "editor", isSuperAdmin: true }), true);
  assert.equal(canReceiveDigest({ role: "editor", isSuperAdmin: false }), false);
  assert.equal(canReceiveDigest({ role: "viewer", isSuperAdmin: true }), false);
  assert.equal(canReceiveDigest({ role: "banana", isSuperAdmin: true }), false);
  assert.equal(canReceiveDigest(null), false);
  assert.equal(canReceiveDigest(undefined), false);
});
