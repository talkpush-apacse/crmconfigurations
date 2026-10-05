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
  // 44px tall below md for touch, denser on desktop.
  const sizing = compact ? "h-11 px-3 text-xs md:h-8 md:px-2.5" : "h-11 px-4 text-sm md:h-10";

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
              "gap-1.5 border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive",
              className
            )}
          >
            <AlertCircle className={compact ? "h-3 w-3" : "h-4 w-4"} />
            Save failed. Retry.
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
        className={cn(sizing, "gap-1.5 border-brand-lavender/40 bg-brand-lavender-lightest text-foreground", className)}
      >
        <Loader2 className={cn("animate-spin", compact ? "h-3 w-3" : "h-4 w-4")} />
        Saving…
      </Button>
    );
  }

  if (hasPendingChanges) {
    // The header copy is the one primary action in the checklist bar. The footer
    // copy sits next to "Continue", which is the primary there, so it steps back.
    return (
      <Button
        type="button"
        onClick={onSave}
        variant={compact ? "default" : "outline"}
        className={cn(sizing, "gap-1.5", className)}
      >
        <Save className={compact ? "h-3 w-3" : "h-4 w-4"} />
        Save changes
      </Button>
    );
  }

  // Nothing to save. Kept visible and stating when the last save landed, since
  // a control that disappears when idle is what made this feel absent. Neutral
  // on purpose: green is reserved for "Complete" (DESIGN.md, The Meaning Rule).
  const savedLabel = lastSavedAt
    ? `Saved ${formatSavedAt(lastSavedAt, now)}`
    : "All changes saved";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex cursor-default items-center gap-1.5 whitespace-nowrap px-1 font-medium text-muted-foreground",
            compact ? "h-8 text-xs" : "h-10 text-sm",
            className
          )}
        >
          <Check className={compact ? "h-3 w-3" : "h-4 w-4"} aria-hidden="true" />
          {savedLabel}
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
