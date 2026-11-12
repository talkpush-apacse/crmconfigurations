"use client";

import { History, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UnsavedBackupOffer } from "@/hooks/useChecklist";
import { formatDistanceToNow } from "@/lib/workflow/dates";

export interface UnsavedBackupState {
  offer: UnsavedBackupOffer | null;
  restore: () => void;
  discard: () => void;
  storageProblem: boolean;
}

/**
 * Two small notices about the copy of unsaved typing that the page keeps on this device:
 *  - "Restore unsaved answers?" when the last visit ended before everything was saved. Nothing is applied until the
 *    person says so, and a restore never overwrites an answer somebody else saved since.
 *  - A quiet warning when the browser would not let the page keep that copy, so the person knows to wait for "saved".
 */
export function UnsavedBackupBanner({ backup }: { backup: UnsavedBackupState }) {
  const { offer, restore, discard, storageProblem } = backup;

  return (
    <>
      {offer && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-brand-amber/40 bg-brand-amber-lightest px-4 py-3 text-sm text-foreground"
        >
          <History className="h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p>
              <span className="font-semibold">Restore unsaved answers?</span> This device kept answers you typed{" "}
              {formatDistanceToNow(offer.savedAt, { addSuffix: true })} that were never saved.
            </p>
            <p className="mt-0.5 text-muted-foreground">
              If someone saved the same cell since, their newer answer is kept.
            </p>
            {offer.error && (
              <p role="alert" className="mt-1 font-medium text-destructive">
                {offer.error}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" className="h-11 md:h-8" disabled={offer.busy} onClick={restore}>
              {offer.busy ? "Restoring..." : "Restore"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11 md:h-8"
              disabled={offer.busy}
              onClick={() => {
                if (window.confirm("Throw away these unsaved answers? This cannot be undone.")) discard();
              }}
            >
              Discard
            </Button>
          </div>
        </div>
      )}
      {storageProblem && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 flex items-start gap-3 rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="min-w-0">
            This browser would not let us keep a backup copy of your unsaved changes. They still save normally; keep this page
            open until the top of the page says saved.
          </p>
        </div>
      )}
    </>
  );
}
