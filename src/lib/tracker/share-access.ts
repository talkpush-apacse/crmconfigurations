import { getClientViewForProject } from "./client-view-service";
import type { ClientView } from "./client-view";
import { clientKey, createLimiter } from "./rate-limit";
import { resolveViewerLink, resolveViewerToken } from "./share-service";
import { getClientActivity } from "./client-activity-service";
import type { ClientActivityEntry } from "./client-activity";
import { makeWorkbook, recordWorkbookDownload } from "./workbook-service";

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

// Building a workbook is heavier than a page view, so downloads have their own tighter cap per address.
const downloadHits = createLimiter(10, 10 * 60_000);

export type SharedWorkbookResult = { status: "ok"; file: Buffer; name: string } | { status: "busy" } | { status: "unavailable" };

/** The Excel copy for a view-only link: client-safe data only, rate limited, and the download is recorded for staff. */
export async function loadSharedWorkbook(token: string, requestHeaders: { get(name: string): string | null }): Promise<SharedWorkbookResult> {
  const key = clientKey(requestHeaders as Headers);
  if (failedHits.count(key) >= 15 || !anyHits.hit(key) || !downloadHits.hit(key)) return { status: "busy" };

  try {
    const link = await resolveViewerLink(token);
    if (!link) {
      failedHits.hit(key);
      return { status: "unavailable" };
    }
    const { file, name } = await makeWorkbook(link.projectId, "client");
    await recordWorkbookDownload(link.projectId, { label: `Client link${link.label ? ` (${link.label})` : ""}`, via: "client" }, "client");
    return { status: "ok", file, name };
  } catch (err) {
    console.error("[share] workbook error:", err instanceof Error ? err.message : err);
    return { status: "unavailable" };
  }
}

export type SharedActivityResult = { status: "ok"; entries: ClientActivityEntry[] } | { status: "busy" } | { status: "unavailable" };

/** The activity trail for a view-only link: the client-safe allow-list only, same door and same limits as the page. */
export async function loadSharedActivity(token: string, requestHeaders: { get(name: string): string | null }): Promise<SharedActivityResult> {
  const key = clientKey(requestHeaders as Headers);
  if (failedHits.count(key) >= 15 || !anyHits.hit(key)) return { status: "busy" };
  try {
    const projectId = await resolveViewerToken(token);
    if (!projectId) {
      failedHits.hit(key);
      return { status: "unavailable" };
    }
    return { status: "ok", entries: await getClientActivity(projectId) };
  } catch (err) {
    console.error("[share] activity error:", err instanceof Error ? err.message : err);
    return { status: "unavailable" };
  }
}

/** Test hook: the limiters are module state. */
export function resetShareLimiters() {
  for (const l of [anyHits, failedHits, downloadHits]) l.reset();
}
