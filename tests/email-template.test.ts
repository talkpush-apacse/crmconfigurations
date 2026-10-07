import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, renderEmail, strong, type EmailContent } from "../src/lib/email-template";
import { buildInvitationEmail } from "../src/lib/invitation-email";
import { buildOwnerNotificationEmail, formatWhen } from "../src/lib/owner-notification-email";

const base: EmailContent = {
  preheader: "Preview line",
  eyebrow: "Test email",
  headline: "Something happened to a thing",
  blocks: [
    { type: "paragraph", text: ["Hello ", strong("Bold Name"), "."] },
    { type: "steps", items: ["First", ["Second ", strong("bold")]] },
    { type: "details", rows: [{ label: "Label", value: "Value" }] },
    { type: "callout", tone: "note", text: "Careful" },
  ],
  button: { label: "Open it", url: "https://hub.example.com/path?a=1&b=2" },
  footer: "Why you got this.",
};

test("the standard layout has the logo, brand strip, eyebrow, headline, one button and the footer, in Inter", () => {
  const { html } = renderEmail(base, "Subject");
  assert.match(html, /<img class="logo-light" src="https:\/\/hub\.example\.com\/email\/talkpush-logo\.png"/);
  assert.match(html, /<img class="logo-dark" src="https:\/\/hub\.example\.com\/email\/talkpush-logo-dark\.png"/);
  for (const hex of ["#ACCDB5", "#BBCAF0", "#E8C2EF", "#E8B766"]) assert.ok(html.includes(hex), hex);
  assert.match(html, /Test email/);
  assert.match(html, /Something happened to a thing/);
  assert.match(html, /Why you got this\./);
  assert.match(html, /'Inter'/);
  assert.equal((html.match(/class="dm-btn"/g) ?? []).length, 1, "exactly one button");
  assert.match(html, /<html lang="en">/);
  assert.match(html, /prefers-color-scheme:dark/);
});

test("the hidden preview line and a plain-text version are always there", () => {
  const { html, text } = renderEmail(base, "Subject");
  assert.match(html, /display:none[^>]*>Preview line</);
  assert.match(text, /^TEST EMAIL\n\nSomething happened to a thing\n/);
  assert.match(text, /Hello Bold Name\./);
  assert.match(text, /1\. First\n2\. Second bold/);
  assert.match(text, /Label: Value/);
  assert.match(text, /Open it: https:\/\/hub\.example\.com\/path\?a=1&b=2/);
  assert.doesNotMatch(text, /<|&amp;/);
});

test("anything a person typed is escaped, in every place it can appear", () => {
  const evil = `<script>alert(1)</script>"'&`;
  const { html } = renderEmail(
    {
      ...base,
      preheader: evil,
      eyebrow: evil,
      headline: evil,
      blocks: [
        { type: "paragraph", text: [evil, strong(evil)] },
        { type: "steps", items: [evil] },
        { type: "details", rows: [{ label: evil, value: evil }] },
        { type: "callout", tone: "info", text: evil },
      ],
      button: { label: evil, url: "https://hub.example.com/x" },
      footer: evil,
    },
    evil
  );
  assert.doesNotMatch(html, /<script>/);
  assert.ok(html.includes(escapeHtml(evil)));
});

test("only web addresses become the button; anything else is dropped rather than linked", () => {
  const { html } = renderEmail({ ...base, button: { label: "Go", url: "javascript:alert(1)" } }, "Subject");
  assert.doesNotMatch(html, /javascript:/);
  assert.doesNotMatch(html, /class="dm-btn"/);
});

test("the invitation names who added them, the role, the Hub link and the exact email", () => {
  const e = buildInvitationEmail({ to: "jeremi.gomez@talkpush.com", inviterEmail: "jolo.yu@talkpush.com", role: "editor", signInUrl: "https://crmconfig.talkpush.com" });
  assert.equal(e.subject, "You now have access to the Talkpush Implementation Hub");
  assert.ok(e.subject.length <= 60);
  for (const body of [e.html, e.text]) {
    assert.match(body, /jolo\.yu@talkpush\.com/);
    assert.match(body, /Talkpush Admin/);
    assert.match(body, /https:\/\/crmconfig\.talkpush\.com/);
    assert.match(body, /jeremi\.gomez@talkpush\.com/);
    assert.match(body, /Sign in with Google/);
  }
  assert.match(e.html, /crmconfig\.talkpush\.com\/email\/talkpush-logo\.png/);
});

test("a read-only invitation uses the read-only role, not the admin one", () => {
  const e = buildInvitationEmail({ to: "a@talkpush.com", inviterEmail: "b@talkpush.com", role: "viewer", signInUrl: "https://crmconfig.talkpush.com" });
  assert.match(e.text, /Talkpush read-only/);
  assert.doesNotMatch(e.text, /Talkpush Admin/);
});

test("the checklist update says what happened to what, in plain words and UTC", () => {
  const when = new Date("2026-10-07T11:42:00Z");
  assert.equal(formatWhen(when), "7 Oct 2026, 11:42 UTC");
  const edited = buildOwnerNotificationEmail({ clientName: "Example Harbor", tabDisplayName: "Contacts", tabUrl: "https://crm.example.com/c/x/contacts", updateType: "Edited", summary: "3 fields added, 1 field renamed", when });
  assert.equal(edited.subject, "Example Harbor updated the Contacts tab");
  for (const body of [edited.html, edited.text]) {
    assert.match(body, /Example Harbor/);
    assert.match(body, /3 fields added, 1 field renamed/);
    assert.match(body, /7 Oct 2026, 11:42 UTC/);
  }
  assert.match(edited.text, /Open the Contacts tab: https:\/\/crm\.example\.com\/c\/x\/contacts/);
  const uploaded = buildOwnerNotificationEmail({ clientName: "Example Harbor", tabDisplayName: "Contacts", tabUrl: "https://crm.example.com/c/x/contacts", updateType: "File uploaded", summary: "Uploaded logo.png", when });
  assert.equal(uploaded.subject, "Example Harbor uploaded a file to the Contacts tab");
});

test("the inbox preview line is trimmed to fit, and no email we write contains an em dash", () => {
  const long = buildOwnerNotificationEmail({ clientName: "A", tabDisplayName: "B", tabUrl: "https://crm.example.com/x", updateType: "Edited", summary: "word ".repeat(60) });
  const preview = long.html.match(/opacity:0[^>]*>([^<]*)</)?.[1] ?? "";
  assert.ok(preview.length <= 90, `preview was ${preview.length}`);
  const inv = buildInvitationEmail({ to: "a@talkpush.com", inviterEmail: "b@talkpush.com", role: "editor", signInUrl: "https://crmconfig.talkpush.com" });
  for (const body of [long.html, long.text, inv.html, inv.text, inv.subject, long.subject]) assert.ok(!body.includes("—"), "em dash found");
});
