"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SheetIntroProps {
  title: string;
  /**
   * What this tab is for. Shown as a tooltip rather than a paragraph — the
   * fields themselves are the thing the client came to fill in.
   */
  description?: React.ReactNode;
}

/**
 * Compact one-line replacement for SectionHeader on the spreadsheet-style tabs.
 *
 * SectionHeader renders a large rounded card with a "Configuration Workspace"
 * badge, a 28px heading and a paragraph. Stacked with the upload banner, the
 * example block and a reference table, it pushed the actual inputs off the
 * first screen — so a client opened the page and could not see a single field
 * they were being asked to fill in.
 */
export function SheetIntro({ title, description }: SheetIntroProps) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <h2 className="text-[19px] font-semibold leading-tight tracking-tight text-slate-950">
        {title}
      </h2>
      {description && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex shrink-0 cursor-help items-center rounded-full text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
              aria-label={`About ${title}`}
            >
              <Info className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="max-w-sm">
            <div className="space-y-1 text-xs leading-relaxed">{description}</div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
