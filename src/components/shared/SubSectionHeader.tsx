"use client";

import { HelpTip } from "./HelpTip";
import { cn } from "@/lib/utils";

interface SubSectionHeaderProps {
  title: string;
  /** Guidance for this group of fields, shown on hover. */
  description?: React.ReactNode;
  className?: string;
}

/**
 * A heading for a group of fields *within* a tab — "Business Hours",
 * "Chatbot FAQs", "Facebook Details".
 *
 * These used to render the same SectionHeader card as the page title, so a
 * sub-section shouted exactly as loudly as the tab it lived inside and the
 * page had no hierarchy. The small-caps label with a rule is lifted from the
 * pattern CompanyInfoSheet was already using inline for its own field groups,
 * now shared so every tab groups fields the same way.
 */
export function SubSectionHeader({
  title,
  description,
  className,
}: SubSectionHeaderProps) {
  return (
    <div className={cn("mb-3 flex items-center gap-3", className)}>
      <h3 className="whitespace-nowrap text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      {description && (
        <HelpTip label={title} size={14}>
          {description}
        </HelpTip>
      )}
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
