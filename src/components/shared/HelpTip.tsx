"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpTipProps {
  /** Guidance for the thing this sits beside. */
  children: React.ReactNode;
  /** Names the target for screen readers, e.g. "Access Type". */
  label: string;
  /** Icon size in px. 13 suits a column header, 16 a page title. */
  size?: number;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

/**
 * The one help affordance in the app.
 *
 * Guidance is deliberately behind a hover rather than printed on the page —
 * always-on help competes with the fields for attention, and a client who
 * already knows what a column means shouldn't have to read past it. That only
 * works if the marker is genuinely findable, so every place that offers help
 * renders this same icon, at the same size, in the same spot: immediately
 * after the label it explains.
 *
 * It is visible at rest and grows a lavender disc on approach, which is what
 * tells someone this is a thing to point at. On the old near-black table
 * header the same icon was white at 70% opacity and might as well not have
 * been there.
 *
 * Opening is not hover-only: hover and keyboard focus open it (Radix), and a
 * click pins it open. Without the click path there is no way to read a
 * tooltip on a touchscreen, and a client on an iPad simply could not reach
 * any of this guidance.
 *
 * Every consumer routes through here so the affordance can be restyled in one
 * file rather than in each of the twenty-odd places that offer help.
 */
export function HelpTip({
  children,
  label,
  size = 13,
  className,
  side = "bottom",
  align = "start",
}: HelpTipProps) {
  /**
   * Hover and pin are tracked separately on purpose.
   *
   * Radix dismisses a tooltip when its trigger is clicked, so a single `open`
   * flag toggled from onClick fought that dismissal and the tooltip could be
   * opened but never closed again by clicking. Keeping the two apart lets a
   * pin survive Radix's close while a hover still behaves like a hover.
   */
  const [hovering, setHovering] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = pinned || hovering;

  const unpin = () => {
    setPinned(false);
    setHovering(false);
  };

  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => {
        if (!pinned) setHovering(next);
      }}
    >
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => (pinned ? unpin() : setPinned(true))}
          data-help-tip=""
          className={cn(
            "inline-flex h-[18px] w-[18px] shrink-0 cursor-help items-center justify-center rounded-full",
            "text-slate-400 transition-colors duration-150",
            "hover:bg-brand-lavender-lightest hover:text-brand-lavender-darker",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lavender-darker/40",
            // Driven from state rather than a `data-open:` variant: that
            // variant applied its text colour but silently resolved the
            // background to transparent, so the open marker half-worked.
            open && "bg-brand-lavender-lightest text-brand-lavender-darker",
            className
          )}
          aria-label={`About ${label}`}
        >
          <Info style={{ width: size, height: size }} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        className="max-w-sm"
        onEscapeKeyDown={unpin}
        onPointerDownOutside={unpin}
      >
        <div className="space-y-1 text-xs leading-relaxed">{children}</div>
      </TooltipContent>
    </Tooltip>
  );
}
