/**
 * Small date helpers so the workflow module needs no date library.
 */

export function formatDateInManila(value: string | number | Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", ...options }).format(new Date(value));
}

/** "5 minutes ago", "about 2 hours ago", "3 days ago". Mirrors date-fns formatDistanceToNow with addSuffix. */
export function formatDistanceToNow(value: string | number | Date, opts: { addSuffix?: boolean } = {}): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const future = diffMs < 0;
  const s = Math.abs(diffMs) / 1000;
  const m = s / 60;
  const h = m / 60;
  const d = h / 24;
  let text: string;
  if (s < 45) text = "less than a minute";
  else if (m < 90) text = `${Math.max(1, Math.round(m))} minute${Math.round(m) === 1 ? "" : "s"}`;
  else if (h < 22) text = `about ${Math.round(h)} hour${Math.round(h) === 1 ? "" : "s"}`;
  else if (h < 36) text = "1 day";
  else if (d < 30) text = `${Math.round(d)} days`;
  else if (d < 45) text = "about 1 month";
  else if (d < 365) text = `${Math.round(d / 30)} months`;
  else text = `about ${Math.round(d / 365)} year${Math.round(d / 365) === 1 ? "" : "s"}`;
  if (!opts.addSuffix) return text;
  return future ? `in ${text}` : `${text} ago`;
}

/** Only the patterns the editor uses, for example "MMM d, yyyy 'at' h:mm a". Text in single quotes is kept as is. */
export function format(value: string | number | Date, pattern: string): string {
  const date = new Date(value);
  const parts = {
    MMM: date.toLocaleString("en-US", { month: "short" }),
    d: String(date.getDate()),
    yyyy: String(date.getFullYear()),
    h: String(date.getHours() % 12 || 12),
    mm: String(date.getMinutes()).padStart(2, "0"),
    a: date.getHours() >= 12 ? "PM" : "AM",
  };
  return pattern.replace(/'([^']*)'|MMM|yyyy|mm|d|h|a/g, (token, literal) =>
    literal !== undefined ? literal : parts[token as keyof typeof parts]
  );
}
