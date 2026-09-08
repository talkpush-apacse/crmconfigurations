"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A boolean preference kept in localStorage, read safely under SSR.
 *
 * The obvious approaches both fail here. A lazy `useState` initializer runs on
 * the server with no `window`, and hydration keeps the fallback it returned —
 * so the stored value is silently ignored on every load (this is what was
 * happening to the Welcome notes panel, and to saved column widths). Reading
 * it in an effect fixes that but trips the setState-in-effect lint rule.
 *
 * `useSyncExternalStore` is built for exactly this: an explicit server
 * snapshot, a client snapshot read after hydration, and a subscription so a
 * write re-renders everything using the key — including other tabs, via the
 * `storage` event.
 */

const listeners = new Set<() => void>();

function notifyAll() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Writes from another tab.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useStoredPreference(
  key: string,
  fallback: boolean
): [boolean, (next: boolean) => void] {
  const getSnapshot = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : raw !== "false";
    } catch {
      // Private browsing and blocked site data both throw on access.
      return fallback;
    }
  }, [key, fallback]);

  // The server has no localStorage, so it renders the fallback and the real
  // value arrives on the first client snapshot.
  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        // Remembering the preference is a convenience, not worth surfacing.
      }
      notifyAll();
    },
    [key]
  );

  return [value, setValue];
}
