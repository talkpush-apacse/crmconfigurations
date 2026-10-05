import { getClientViewForProject } from "./client-view-service";
import type { ClientView } from "./client-view";
import { clientKey, createLimiter } from "./rate-limit";
import { resolveViewerToken } from "./share-service";

/**
 * The one door to the public client view. Both the JSON route (/api/share/[token])
 * and the server-rendered page (/share/[token]) go through here, so they share the
 * same rate limits, the same token check and the same "a bad link reveals nothing"
 * rule. The token is never logged.
 */

export type SharedViewResult =
  | { status: "ok"; data: ClientView }
  | { status: "busy" }
  // Malformed, unknown, expired, revoked or anything else that went wrong: one generic answer.
  | { status: "unavailable" };

// Any traffic per address, and a tighter cap on failed (unknown token) attempts.
const anyHits = createLimiter(60, 60_000);
const failedHits = createLimiter(15, 10 * 60_000);

export async function loadSharedClientView(token: string, requestHeaders: { get(name: string): string | null }): Promise<SharedViewResult> {
  const key = clientKey(requestHeaders as Headers);

  if (failedHits.count(key) >= 15 || !anyHits.hit(key)) return { status: "busy" };

  try {
    const projectId = await resolveViewerToken(token);
    if (!projectId) {
      failedHits.hit(key);
      return { status: "unavailable" };
    }
    return { status: "ok", data: await getClientViewForProject(projectId) };
  } catch (err) {
    console.error("[share] unexpected error:", err instanceof Error ? err.message : err);
    // Same answer as a bad link: never reveal that a token was valid but something else broke.
    return { status: "unavailable" };
  }
}
