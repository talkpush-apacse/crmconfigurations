"use client";

import { useEffect, useState } from "react";
import type { Role } from "./roles";

export interface CurrentUser {
  email: string;
  role: Role;
  /** True for an editor. Screens use this to show or hide anything that changes data. */
  canEdit: boolean;
}

/**
 * Who is signed in, for hiding buttons a read-only login cannot use. This is a courtesy only: the server refuses every
 * change from a read-only login whatever the screen shows. Until it loads, `user` is null and `canEdit` is false, so a
 * read-only person never sees a flash of edit buttons.
 */
let inFlight: Promise<CurrentUser | null> | null = null;
let loadedAt = 0;
const REFRESH_AFTER_MS = 30_000;

/** Forget who was signed in (called on sign-out, so the next person is never shown the last person's role). */
export function resetCurrentUser(): void {
  inFlight = null;
}

function load(): Promise<CurrentUser | null> {
  if (inFlight && Date.now() - loadedAt > REFRESH_AFTER_MS) inFlight = null;
  if (!inFlight) {
    loadedAt = Date.now();
    inFlight = fetch("/api/auth/check", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { authenticated?: boolean; email?: string; role?: Role }) =>
        d.authenticated && d.email && d.role ? { email: d.email, role: d.role, canEdit: d.role === "editor" } : null
      )
      .catch(() => null);
  }
  return inFlight;
}

export function useCurrentUser(): { user: CurrentUser | null; canEdit: boolean; loaded: boolean } {
  const [state, setState] = useState<{ user: CurrentUser | null; loaded: boolean }>({ user: null, loaded: false });
  useEffect(() => {
    let cancelled = false;
    void load().then((user) => {
      if (!cancelled) setState({ user, loaded: true });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { ...state, canEdit: state.user?.canEdit ?? false };
}
