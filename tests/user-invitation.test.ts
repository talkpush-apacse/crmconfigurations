import test from "node:test";
import assert from "node:assert/strict";
import { buildInvitationEmail, canEmailInvitation } from "../src/lib/invitation-email";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "../src/lib/roles";

const base = { to: "jeremi.gomez@talkpush.com", inviterEmail: "jolo.yu@talkpush.com", role: "editor", signInUrl: "https://crmconfig.talkpush.com" } as const;

test("only talkpush.com addresses are emailed an invitation", () => {
  assert.equal(canEmailInvitation("jeremi.gomez@talkpush.com"), true);
  assert.equal(canEmailInvitation("  Jeremi.Gomez@Talkpush.com "), true);
  assert.equal(canEmailInvitation("16johnlouie@gmail.com"), false);
  assert.equal(canEmailInvitation("someone@evil-talkpush.com"), false);
});

test("the invitation tells them who added them, their role, the link and the exact email to use", () => {
  const { subject, html, text } = buildInvitationEmail(base);
  assert.match(subject, /Talkpush Implementation Hub/);
  for (const body of [html, text]) {
    assert.match(body, /jolo\.yu@talkpush\.com/);
    assert.ok(body.includes(ROLE_LABELS.editor), "names the role");
    assert.match(body, /https:\/\/crmconfig\.talkpush\.com/);
    assert.match(body, /jeremi\.gomez@talkpush\.com/);
    assert.match(body, /Sign in with Google/);
  }
});

test("a read-only login is described with the read-only role, not the admin one", () => {
  const { html, text } = buildInvitationEmail({ ...base, role: "viewer" });
  for (const body of [html, text]) {
    assert.ok(body.includes(ROLE_LABELS.viewer));
    assert.ok(body.includes(ROLE_DESCRIPTIONS.viewer));
    assert.ok(!body.includes(ROLE_DESCRIPTIONS.editor));
  }
});

test("anything typed into the email or link is escaped in the HTML", () => {
  const { html } = buildInvitationEmail({ ...base, inviterEmail: `a"><script>alert(1)</script>@talkpush.com`, signInUrl: `https://x.test/?a=1&b="2"` });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /a=1&amp;b=&quot;2&quot;/);
});
