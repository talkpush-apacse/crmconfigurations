/** Shared bits for the contributor page and its item panel: the call helper and the button and field styles. */

export const card = "rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-4";
export const input = "min-h-11 w-full rounded-md border border-[var(--es-line)] bg-white px-3 py-2 text-sm text-[var(--es-ink)] disabled:opacity-60";
export const primary = "inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--es-ink)] px-4 text-sm font-medium text-white disabled:opacity-50";
export const secondary = "inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--es-line)] bg-[var(--es-card)] px-4 text-sm font-medium text-[var(--es-ink)] disabled:opacity-50";

/** Every call carries the secret link in the path. No cookies, no referrer. */
export async function call(token: string, path: string, method: string, body?: unknown): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(`/api/contribute/${encodeURIComponent(token)}${path}`, {
    method,
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    // empty body
  }
  return { ok: res.ok, status: res.status, json };
}

export function problem(json: Record<string, unknown>): string {
  const issues = Array.isArray(json.issues) ? (json.issues as { path: string; message: string }[]) : [];
  const detail = issues.map((i) => i.message).join(". ");
  const base = typeof json.error === "string" ? json.error : "Something went wrong. Please try again.";
  return detail ? `${base} ${detail}` : base;
}
