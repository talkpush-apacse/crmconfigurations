/**
 * How an automated message, call or alert is shown on its box: "Channel · When", for example "Email · 1 hour after".
 * The channel comes from the step's metadata and the timing from its `timing` line. Known channels get a friendly name;
 * anything else (a client's own channel, "Teams") is shown exactly as typed, so the list is never a limit.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const FRIENDLY: Record<string, string> = {
  sms: "SMS",
  email: "Email",
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  voice: "Voice call",
  web: "Web",
  line: "LINE",
};

/** One channel, or several ("sms", ["email", "sms"], "email + sms", "Email, SMS"), as one tidy string: "Email + SMS". */
export function channelLabel(value: unknown): string {
  const parts = (Array.isArray(value) ? value : typeof value === "string" ? value.split(/\s*(?:\+|,|\/|&|\band\b)\s*/i) : [])
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .map((p) => FRIENDLY[p.toLowerCase()] ?? p);
  return [...new Set(parts)].join(" + ");
}

/** The italic last line of a box: channel and timing joined by a middle dot, either one alone, or "" when neither is set. */
export function channelWhen(node: any): string {
  const d = node?.data ?? {};
  return [channelLabel(d.data?.channel), String(d.timing ?? "").trim()].filter(Boolean).join(" · ");
}
