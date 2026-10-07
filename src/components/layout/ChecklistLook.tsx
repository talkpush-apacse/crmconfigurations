"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LOOK_COOKIE, parseLook, type ChecklistLook } from "@/lib/checklist-look";

function readLookCookie(): ChecklistLook {
  if (typeof document === "undefined") return "modern";
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${LOOK_COOKIE}=`));
  return parseLook(match?.slice(LOOK_COOKIE.length + 1));
}

interface LookValue {
  look: ChecklistLook;
  setLook: (next: ChecklistLook) => void;
}

const LookContext = createContext<LookValue | null>(null);

/** Null outside a checklist shell, where there is no look to switch. */
export function useChecklistLook(): LookValue | null {
  return useContext(LookContext);
}

export const ChecklistLookProvider = LookContext.Provider;

/**
 * Call at the top of a checklist shell, before any early return. Hands back the value for the
 * provider and the class the shell's root element should carry.
 *
 * Menus, tooltips and dropdown lists render in a portal on <body>, outside the shell, so the
 * modern class is mirrored onto <body> while a checklist is open.
 */
export function useChecklistLookState(initialLook: ChecklistLook | undefined, fontClass: string) {
  const [look, setLookState] = useState<ChecklistLook>(() => initialLook ?? readLookCookie());

  const setLook = useCallback((next: ChecklistLook) => {
    setLookState(next);
    try {
      document.cookie = `${LOOK_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      /* cookies can be blocked; the choice then lasts until the page closes */
    }
  }, []);

  useEffect(() => {
    const fontClasses = fontClass.split(" ").filter(Boolean);
    document.body.classList.add(...fontClasses);
    document.body.classList.toggle("client-form", look === "modern");
    return () => document.body.classList.remove("client-form", ...fontClasses);
  }, [look, fontClass]);

  const value = useMemo(() => ({ look, setLook }), [look, setLook]);
  const rootClass = look === "modern" ? `client-form ${fontClass}` : fontClass;
  return { value, rootClass };
}
