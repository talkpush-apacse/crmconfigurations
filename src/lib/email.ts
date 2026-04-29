import "server-only";

import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatUtcTimestamp(date = new Date()): string {
  return date.toISOString().replace("T", " ").replace("Z", " UTC");
}

export async function sendOwnerNotification(params: {
  to: string;
  clientName: string;
  tabDisplayName: string;
  tabUrl: string;
  updateType: "Edited" | "File uploaded";
  summary: string;
}): Promise<{ ok: boolean; error?: string }> {
  const from = process.env.NOTIFICATION_FROM_EMAIL?.trim();
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }
  if (!from) {
    return { ok: false, error: "NOTIFICATION_FROM_EMAIL is not configured" };
  }

  const subject = `[CRM Checklist] ${params.clientName} — ${params.tabDisplayName} ${params.updateType.toLowerCase()}`;
  const timestamp = formatUtcTimestamp();
  const clientName = escapeHtml(params.clientName);
  const tabDisplayName = escapeHtml(params.tabDisplayName);
  const updateType = escapeHtml(params.updateType);
  const summary = escapeHtml(params.summary);
  const tabUrl = escapeHtml(params.tabUrl);

  const html = `
    <div style="background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
        <h1 style="margin:0 0 20px;font-size:20px;line-height:1.3;">${clientName}</h1>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tbody>
            <tr>
              <td style="padding:8px 0;color:#475569;font-weight:600;">Checklist</td>
              <td style="padding:8px 0;">${clientName}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#475569;font-weight:600;">Tab</td>
              <td style="padding:8px 0;">${tabDisplayName}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#475569;font-weight:600;">Update type</td>
              <td style="padding:8px 0;">${updateType}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#475569;font-weight:600;">Summary</td>
              <td style="padding:8px 0;">${summary}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#475569;font-weight:600;">Timestamp</td>
              <td style="padding:8px 0;">${timestamp}</td>
            </tr>
          </tbody>
        </table>
        <a href="${tabUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600;">
          Open checklist tab
        </a>
        <p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:1.5;">
          Editor identity not tracked — public link. Set ownerEmail to blank on the checklist to disable these notifications.
        </p>
      </div>
    </div>
  `;

  try {
    const { error } = await resend.emails.send({
      from,
      to: params.to,
      subject,
      html,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown email send failure",
    };
  }
}
