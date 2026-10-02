"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "./client-api";

/**
 * Load a tracker API route and keep it fresh. State is only set after the
 * request returns, never synchronously inside the effect. Call `reload()` after
 * a change to fetch again (the previous data stays on screen meanwhile).
 */
export function useApiResource<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    api<T>(url)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [url, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload };
}
