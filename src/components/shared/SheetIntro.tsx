"use client";

import { Info, X } from "lucide-react";
import { HelpTip } from "./HelpTip";
import { useStoredPreference } from "@/hooks/useStoredPreference";

interface SheetIntroProps {
  title: string;
  /**
   * What this tab is for. Shown as a tooltip rather than a paragraph — the
   * fields themselves are the thing the client came to fill in.
   */
  description?: React.ReactNode;
}

/**
 * Shown once per viewer, then never again.
 *
 * Moving guidance behind hover only works if someone finds out it is there.
 * The alternative — a permanent "hover the ⓘ for help" line on all twenty-odd
 * tabs — is the always-on chrome this whole pass exists to remove, so it
 * dismisses itself for good on the first ×.
 */
function HelpCoachLine() {
  const [dismissed, setDismissed] = useStoredPreference(
    "talkpush_help_coach_dismissed",
    false
  );

  if (dismissed) return null;

  return (
    <div className="mt-1.5 flex items-center gap-2 text-[12.5px] text-muted-foreground">
      <span className="inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-brand-lavender-lightest text-brand-lavender-darker">
        <Info className="h-2.5 w-2.5" />
      </span>
      <span>Hover any info icon for guidance on what that field expects.</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss this tip"
        className="inline-flex shrink-0 items-center rounded text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/**
 * The page title on every content tab.
 *
 * This replaced SectionHeader, which rendered a large rounded card with a
 * "Configuration Workspace" badge, a 28px heading and a paragraph. Stacked
 * with the upload banner, the example block and a reference table, it pushed
 * the actual inputs off the first screen — so a client opened the page and
 * could not see a single field they were being asked to fill in.
 *
 * The tab name is already in the header breadcrumb, so this line is a
 * landmark, not an announcement.
 */
export function SheetIntro({ title, description }: SheetIntroProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-[19px] font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <HelpTip label={title} size={15}>
            {description}
          </HelpTip>
        )}
      </div>
      <HelpCoachLine />
    </div>
  );
}
