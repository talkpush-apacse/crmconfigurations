import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "./roles";
import { isTalkpushEmail } from "./users-rules";

/**
 * The invitation email for a new Hub login. Pure (no server imports) so the wording is easy to test.
 *
 * Only talkpush.com addresses are emailed: people sign in with Google, and the sign-in only accepts a talkpush.com
 * Google account. An outside address is still added, but the page tells the editor to follow up themselves.
 */

export function canEmailInvitation(email: string): boolean {
  return isTalkpushEmail(email);
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

/**
 * What happened when we tried to email an invitation. Plain words only: the raw email-service error stays in the server
 * log, never on the screen.
 *   sent    - the email went to the email service
 *   skipped - not a talkpush.com address, so there is no Google sign-in to invite them to
 *   failed  - the email could not be sent; the editor should tell the person themselves
 */
export type InvitationOutcome = { status: "sent" } | { status: "skipped" } | { status: "failed"; message: string };

export interface InvitationEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildInvitationEmail(params: { to: string; inviterEmail: string; role: Role; signInUrl: string }): InvitationEmail {
  const roleLabel = ROLE_LABELS[params.role];
  const roleDescription = ROLE_DESCRIPTIONS[params.role];
  const to = escapeHtml(params.to);
  const inviter = escapeHtml(params.inviterEmail);
  const url = escapeHtml(params.signInUrl);

  const html = `
    <div style="background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">You have been added to the Talkpush Implementation Hub</h1>
        <p style="margin:0 0 16px;line-height:1.5;">${inviter} gave you access as <strong>${escapeHtml(roleLabel)}</strong>. ${escapeHtml(roleDescription)}</p>
        <ol style="margin:0 0 24px;padding-left:20px;line-height:1.6;">
          <li>Open the Hub using the button below.</li>
          <li>Click <strong>Sign in with Google</strong>.</li>
          <li>Choose the Google account for <strong>${to}</strong>. It has to be that exact email, and a talkpush.com Google account.</li>
        </ol>
        <a href="${url}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600;">
          Open the Hub
        </a>
        <p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:1.5;">
          If you were not expecting this, reply to this email or ignore it. Nothing happens until you sign in.
        </p>
      </div>
    </div>
  `;

  const text = [
    "You have been added to the Talkpush Implementation Hub",
    "",
    `${params.inviterEmail} gave you access as ${roleLabel}. ${roleDescription}`,
    "",
    `1. Open ${params.signInUrl}`,
    "2. Click Sign in with Google.",
    `3. Choose the Google account for ${params.to}. It has to be that exact email, and a talkpush.com Google account.`,
    "",
    "If you were not expecting this, reply to this email or ignore it. Nothing happens until you sign in.",
  ].join("\n");

  return { subject: "You have been added to the Talkpush Implementation Hub", html, text };
}
