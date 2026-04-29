import "server-only";

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

export async function sendOwnerNotification(params: {
  to: string;
  clientName: string;
  tabDisplayName: string;
  tabUrl: string;
  updateType: "Edited" | "File uploaded";
  summary: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const sender = parseSender(process.env.NOTIFICATION_FROM_EMAIL ?? "");

  if (!apiKey) {
    return { ok: false, error: "BREVO_API_KEY is not configured" };
  }
  if (!sender) {
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
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: params.to }],
        subject,
        htmlContent: html,
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
