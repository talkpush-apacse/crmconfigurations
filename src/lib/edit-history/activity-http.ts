import { NextResponse } from "next/server";
import type { TabActivity } from "./types";

/** `?tab=<address segment>&since=<the checklist version the page has>`. Anything unusable becomes null. */
export function parseActivityQuery(sp: URLSearchParams): { slug: string | null; since: number | null } {
  const tab = sp.get("tab");
  const slug = tab && /^[A-Za-z0-9_-]{1,100}$/.test(tab) ? tab : null;
  const raw = sp.get("since");
  const n = raw === null || raw === "" ? NaN : Number(raw);
  const since = Number.isInteger(n) && n >= 0 && n < 1_000_000_000 ? n : null;
  return { slug, since };
}

/** Always fresh: this answer is only useful for the next few seconds. */
export function activityJson(activity: TabActivity) {
  return NextResponse.json(activity, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
