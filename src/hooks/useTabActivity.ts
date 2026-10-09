"use client";

import { useEffect, useRef, useState } from "react";
import type { TabActivity } from "@/lib/edit-history/types";

const POLL_MS = 15_000;

/**
 * Asks, every 15 seconds while the page is on screen (and straight away when you come back to it), whether someone else
 * has been changing this tab. `slug` is null on pages that are not a checklist tab, which asks nothing.
 *
 * It never blocks or changes saving. A failed check is ignored and tried again; a turned-off or unknown link stops it.
 */
export function useTabActivity(activityUrl: string, slug: string | null, version: number): TabActivity | null {
  const [activity, setActivity] = useState<TabActivity | null>(null);
  // The latest page version, read at each check, so a save does not restart the timer.
  const versionRef = useRef(version);
  versionRef.current = version;

  useEffect(() => {
    setActivity(null);
    if (!slug) return;
    let stopped = false;
    let inFlight = false;
    let controller: AbortController | null = null;

    async function check() {
      if (stopped || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      controller = new AbortController();
      try {
        const res = await fetch(`${activityUrl}?tab=${encodeURIComponent(slug as string)}&since=${versionRef.current}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (stopped) return;
        if (res.status === 401 || res.status === 404 || res.status === 410) {
          stopped = true; // signed out, unknown, or the link was turned off: the page itself says so
          setActivity(null);
          return;
        }
        if (!res.ok) return;
        const body = (await res.json()) as TabActivity;
        if (!stopped && body && Array.isArray(body.others)) setActivity(body);
      } catch {
        // Offline or interrupted: keep the last answer and try again next time.
      } finally {
        inFlight = false;
      }
    }

    void check();
    const timer = setInterval(() => void check(), POLL_MS);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [activityUrl, slug]);

  return activity;
}
