import { renderEmail, strong, type RenderedEmail } from "./email-template";
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

/**
 * What happened when we tried to email an invitation. Plain words only: the raw email-service error stays in the server
 * log, never on the screen.
 *   sent    - the email went to the email service
 *   skipped - not a talkpush.com address, so there is no Google sign-in to invite them to
 *   failed  - the email could not be sent; the editor should tell the person themselves
 */
export type InvitationOutcome = { status: "sent" } | { status: "skipped" } | { status: "failed"; message: string };

export interface InvitationEmail extends RenderedEmail {
  subject: string;
}

export function buildInvitationEmail(params: { to: string; inviterEmail: string; role: Role; signInUrl: string }): InvitationEmail {
  const subject = "You now have access to the Talkpush Implementation Hub";
  const email = renderEmail(
    {
      preheader: "Sign in with your talkpush.com Google account. No password needed.",
      eyebrow: "Implementation Hub",
      headline: subject,
      blocks: [
        { type: "paragraph", text: [strong(params.inviterEmail), " added you as a ", strong(ROLE_LABELS[params.role]), ". ", ROLE_DESCRIPTIONS[params.role]] },
        { type: "steps", items: ["Open the Hub.", ["Choose ", strong("Sign in with Google"), "."], ["Pick the Google account for ", strong(params.to), "."]] },
        { type: "callout", tone: "note", text: "Use that exact email. A different Google account, or a personal one, will not get in." },
      ],
      button: { label: "Open the Hub", url: params.signInUrl },
      footer: `You are getting this because ${params.inviterEmail} added you to the Talkpush Implementation Hub. Not expecting it? Reply to this email. Nothing happens until you sign in.`,
    },
    subject
  );
  return { subject, ...email };
}
