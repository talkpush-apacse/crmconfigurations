import "server-only";
import { buildInvitationEmail } from "./invitation-email";
import { buildOwnerNotificationEmail, type OwnerUpdateType } from "./owner-notification-email";
import type { Role } from "./roles";

function parseSender(value: string): { name?: string; email: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(.*?)<([^>]+)>$/);
  if (match) {
    const [, rawName, rawEmail] = match;
    const email = rawEmail.trim();
    const name = rawName.trim().replace(/^"|"$/g, "");
    if (!email) return null;
    return name ? { name, email } : { email };
  }

  return { email: trimmed };
}

type EmailResult = { ok: boolean; error?: string };

const BREVO_TIMEOUT_MS = 15_000;

/** One place that talks to Brevo, so every email handles missing settings and failures the same way. */
async function sendViaBrevo(message: { to: string; subject: string; html: string; text?: string; replyTo?: string }): Promise<EmailResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const sender = parseSender(process.env.NOTIFICATION_FROM_EMAIL ?? "");

  if (!apiKey) {
    return { ok: false, error: "BREVO_API_KEY is not configured" };
  }
  if (!sender) {
    return { ok: false, error: "NOTIFICATION_FROM_EMAIL is not configured" };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      // Never wait forever on the email service: a hung call would otherwise hold a scheduled job until Vercel stops it.
      signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        ...(message.text ? { textContent: message.text } : {}),
        ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const errorMessage =
        body && typeof body === "object" && "message" in body && typeof body.message === "string"
          ? body.message
          : `Brevo request failed with status ${response.status}`;
      return { ok: false, error: errorMessage };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown email send failure",
    };
  }
}

/** Emails a new Hub login how to sign in. Replies go to the editor who added them. */
export async function sendUserInvitation(params: { to: string; inviterEmail: string; role: Role; signInUrl: string }): Promise<EmailResult> {
  const email = buildInvitationEmail(params);
  return sendViaBrevo({ to: params.to, subject: email.subject, html: email.html, text: email.text, replyTo: params.inviterEmail });
}

export async function sendOwnerNotification(params: {
  to: string;
  clientName: string;
  tabDisplayName: string;
  tabUrl: string;
  updateType: OwnerUpdateType;
  summary: string;
}): Promise<EmailResult> {
  const email = buildOwnerNotificationEmail(params);
  return sendViaBrevo({ to: params.to, subject: email.subject, html: email.html, text: email.text });
}

/** The daily activity digest, already built by buildActivityDigestEmail. */
export async function sendActivityDigest(params: { to: string; subject: string; html: string; text: string }): Promise<EmailResult> {
  return sendViaBrevo({ to: params.to, subject: params.subject, html: params.html, text: params.text });
}
