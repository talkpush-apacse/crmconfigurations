"use client";

import { useEffect } from "react";

export const SITE_TITLE = "Talkpush Implementation Hub";

/**
 * Names the browser tab once the page knows what it is showing (a project or account
 * name that only arrives with the data). The route's own metadata gives a sensible
 * generic title first; this refines it. Runs after every render, which is cheap, so a
 * soft navigation that resets the tab title cannot leave it wrong.
 */
export function useDocumentTitle(name: string | null | undefined) {
  useEffect(() => {
    if (!name) return;
    const next = `${name} | ${SITE_TITLE}`;
    if (document.title !== next) document.title = next;
  });
}
