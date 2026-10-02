export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly issues: { path: string; message: string }[] = []
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Call a tracker API route. Throws ApiError with the server's plain-language message. */
export async function api<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/admin/login";
    throw new ApiError("Please sign in again.", 401);
  }
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // empty body
  }
  if (!res.ok) {
    const p = (payload ?? {}) as { error?: string; issues?: { path: string; message: string }[] };
    throw new ApiError(p.error ?? "Something went wrong. Please try again.", res.status, p.issues ?? []);
  }
  return payload as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const detail = err.issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join(". ");
    return detail ? `${err.message} ${detail}` : err.message;
  }
  return "Something went wrong. Please try again.";
}
