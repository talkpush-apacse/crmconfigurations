"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ExportScope = "page" | "all";
type Phase = "saving" | "downloading";

interface Options {
  /** Where the full workbook comes from. */
  url: string;
  /** The tab being viewed, or null when there is none (or it has no sheet). */
  pageSlug: string | null;
  pageLabel: string | null;
  hasPendingChanges: boolean;
  saveStatus: "saved" | "saving" | "error";
}

/** Longest we wait for the autosave to land before giving up on the export. */
const SAVE_WAIT_MS = 20_000;

/**
 * Export XLS: pick "this page" or "entire checklist".
 *
 * The workbook is built on the server from what is SAVED, not from what is on
 * screen. So before downloading, this waits for any edit still waiting to save,
 * and refuses to export if the save fails: a file that quietly lacks the last
 * edits looks right and is wrong, which is worse than an error.
 *
 * It downloads with fetch rather than opening a new tab, so a failure (link
 * turned off, nothing to export) shows a message here instead of replacing the
 * checklist with a page of JSON, and so the download still works after a wait
 * (browsers block a new tab that opens after a delay).
 */
export function useChecklistExport({ url, pageSlug, pageLabel, hasPendingChanges, saveStatus }: Options) {
  // `slug` is the page at the moment of the click. The wait for the save can take a second or
  // two, and someone may change tab meanwhile; they asked for the page they were on.
  const [request, setRequest] = useState<{ scope: ExportScope; slug: string | null; phase: Phase } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const download = useCallback(
    async (scope: ExportScope, slug: string | null) => {
      try {
        const target = scope === "page" && slug ? `${url}?tab=${encodeURIComponent(slug)}` : url;
        const res = await fetch(target, { cache: "no-store" });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "The Excel file could not be made. Please try again.");
        }
        const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "CRM_Config.xlsx";
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(href);
      } catch (err) {
        setError(err instanceof Error ? err.message : "The Excel file could not be made. Please try again.");
      } finally {
        started.current = false;
        setRequest(null);
      }
    },
    [url]
  );

  // Phase 1: wait for the checklist to be fully saved, then hand over to the download.
  useEffect(() => {
    if (!request || request.phase !== "saving" || started.current) return;
    if (saveStatus === "error") {
      setError("Your latest changes didn't save, so nothing was exported. Fix the save problem first, then export again.");
      setRequest(null);
      return;
    }
    if (hasPendingChanges || saveStatus === "saving") return;
    started.current = true;
    setRequest({ ...request, phase: "downloading" });
    void download(request.scope, request.slug);
  }, [request, hasPendingChanges, saveStatus, download]);

  // Don't wait forever.
  useEffect(() => {
    if (!request || request.phase !== "saving") return;
    const timer = setTimeout(() => {
      setError("Saving is taking longer than expected, so nothing was exported. Try again in a moment.");
      setRequest(null);
    }, SAVE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [request]);

  const start = useCallback(
    (scope: ExportScope) => {
      if (request) return;
      setError(null);
      setRequest({ scope, slug: pageSlug, phase: "saving" });
    },
    [request, pageSlug]
  );

  const busyLabel = request ? (request.phase === "saving" ? "Saving…" : "Preparing…") : null;

  return {
    start,
    busy: request !== null,
    busyLabel,
    error,
    clearError: () => setError(null),
    pageSlug,
    pageLabel,
  };
}
