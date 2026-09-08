"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Explicit save control.
 *
 * Changes already autosave about half a second after typing stops, so this is
 * not the only thing keeping a client's work — but autosave alone gave them
 * nothing to act on: the "unsaved changes" bar appeared and vanished within a
 * second, so there was never a button to deliberately press, and no answer to
 * "did that actually save?".
 *
 * This stays visible in all four states, tells the client when the last save
 * landed, and is the retry path when a save has failed.
 */

interface SaveButtonProps {
  status: "saved" | "saving" | "error";
  hasPendingChanges: boolean;
  lastSavedAt?: number | null;
  errorMessage?: string | null;
  onSave: () => void;
  onRetry?: () => void;
  /** "compact" for the header pill, "full" for the section footer. */
  variant?: "compact" | "full";
  className?: string;
}

/** "just now", "2 min ago", "14:35" — short enough for a header pill. */
function formatSavedAt(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SaveButton({
  status,
  hasPendingChanges,
  lastSavedAt,
  errorMessage,
  onSave,
  onRetry,
  variant = "compact",
  className,
}: SaveButtonProps) {
  // Re-render on a timer so "just now" doesn't stay "just now" for ten minutes.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!lastSavedAt) return;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  const compact = variant === "compact";
  const sizing = compact ? "h-7 px-2.5 text-xs" : "h-10 px-4 text-sm";

  if (status === "error") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            onClick={onRetry ?? onSave}
            className={cn(
              sizing,
              "gap-1.5 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800",
              className
            )}
          >
            <AlertCircle className={compact ? "h-3 w-3" : "h-4 w-4"} />
            {compact ? "Save failed" : "Save failed — retry"}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">
            {errorMessage || "Saving failed. Click to try again."}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (status === "saving") {
    return (
      <Button
        type="button"
        variant="outline"
        disabled
        className={cn(sizing, "gap-1.5 border-brand-lavender/40 bg-brand-lavender-lightest text-brand-lavender-darker", className)}
      >
        <Loader2 className={cn("animate-spin", compact ? "h-3 w-3" : "h-4 w-4")} />
        Saving…
      </Button>
    );
  }

  if (hasPendingChanges) {
    return (
      <Button
        type="button"
        onClick={onSave}
        className={cn(sizing, "gap-1.5 bg-brand-sage-darker text-white hover:bg-brand-sage-darker/85 active:scale-95", className)}
      >
        <Save className={compact ? "h-3 w-3" : "h-4 w-4"} />
        Save changes
      </Button>
    );
  }

  // Nothing to save. Kept visible and stating when the last save landed —
  // a control that disappears when idle is what made this feel absent.
  const savedLabel = lastSavedAt
    ? `Saved ${formatSavedAt(lastSavedAt, now)}`
    : "All changes saved";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex cursor-default items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50/90 font-medium text-emerald-700",
            sizing,
            className
          )}
        >
          <Check className={compact ? "h-3 w-3" : "h-4 w-4"} />
          {compact && lastSavedAt ? formatSavedAt(lastSavedAt, now) : savedLabel}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="text-xs">
          {lastSavedAt
            ? `Everything is saved. Last save ${formatSavedAt(lastSavedAt, now)}.`
            : "Everything is saved. Your changes save automatically as you type."}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
