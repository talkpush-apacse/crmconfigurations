"use client";

import { CollapsibleText } from "@/components/shared/CollapsibleText";

interface SectionHeaderProps {
  title: string;
  description?: string;
  /** "section" is a heading inside a page that already has one; the client form sets it smaller. */
  level?: "page" | "section";
}

export function SectionHeader({ title, description, level = "page" }: SectionHeaderProps) {
  return (
    <div className="cf-sectionheader mb-8 rounded-xl border border-border bg-card px-6 py-5">
      <h2 className={`cf-title ${level === "section" ? "cf-title-sub" : ""} text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[29px]`}>
        {title}
      </h2>
      {description && (
        <CollapsibleText className="cf-sectionheader-text mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
          {description}
        </CollapsibleText>
      )}
    </div>
  );
}
