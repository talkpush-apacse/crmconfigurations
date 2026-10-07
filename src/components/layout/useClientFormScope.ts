"use client";

import { useEffect } from "react";

/**
 * The client form look is scoped to a wrapper class. Menus, tooltips and
 * dropdown lists render in a portal on <body>, outside that wrapper, so the
 * same classes are put on <body> while a checklist is open and taken off when
 * it closes. The wrapper still carries them for the first server paint.
 */
export function useClientFormScope(fontClass: string) {
  useEffect(() => {
    const classes = ["client-form", ...fontClass.split(" ").filter(Boolean)];
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, [fontClass]);
}
