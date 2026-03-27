"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, Info, ArrowRight, ChevronDown } from "lucide-react";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { useChecklistContext } from "@/lib/checklist-context";
import { getEnabledTabs } from "@/lib/tab-config";
import { getSectionState } from "@/lib/section-status";
import type { ChecklistData } from "@/lib/types";

function StatusChip({
  label,
  status,
  href,
}: {
  label: string;
  status: "complete" | "in-progress" | "not-started";
  href: string;
}) {
  const dotClass =
    status === "complete"
      ? "bg-green-600"
      : status === "in-progress"
      ? "bg-amber-500"
      : "border-2 border-gray-400 bg-transparent";
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-medium text-gray-700 hover:bg-slate-200 transition-colors"
    >
      <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
      {label}
    </Link>
  );
}

export function WelcomeSheet() {
  const { data, basePath } = useChecklistContext();

  // Lazy initializer reads localStorage once on mount — avoids setState-in-effect pattern
  const [notesOpen, setNotesOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true; // SSR safe default
    const stored = localStorage.getItem("talkpush_welcome_notes_seen");
    return stored === null ? true : stored !== "false";
  });

  const handleNotesToggle = () => {
    setNotesOpen((v) => {
      const next = !v;
      localStorage.setItem("talkpush_welcome_notes_seen", String(next));
      return next;
    });
  };

  const enabledTabs = getEnabledTabs(data?.enabledTabs ?? null);
  const contentTabs = enabledTabs.filter((t) => t.dataKey);

  const completedCount = contentTabs.filter((t) => {
    const val = (data as ChecklistData)[t.dataKey as keyof ChecklistData];
    return getSectionState(val) === "complete";
  }).length;

  const totalCount = contentTabs.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const firstContentTab = contentTabs[0];

  return (
    <div>
      <SectionHeader title="Welcome" />
      <div className="space-y-5">
        {/* Hero — left-aligned, no wrapping card */}
        <div>
          <h1 className="text-[22px] font-semibold text-gray-900">
            Talkpush CRM Configuration Checklist
          </h1>
          <p className="mt-1 text-[14px] text-gray-500">
            Complete each section to configure your Talkpush CRM platform.
          </p>
        </div>

        {/* Progress summary card */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-[16px] font-semibold text-gray-900">
            {completedCount} of {totalCount} sections complete
          </p>
          <div className="mt-3 h-1.5 w-full rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-green-600 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {contentTabs.map((t) => {
              const val = (data as ChecklistData)[t.dataKey as keyof ChecklistData];
              const status = getSectionState(val);
              return (
                <StatusChip
                  key={t.slug}
                  label={t.label}
                  status={status}
                  href={`${basePath}/${t.slug}`}
                />
              );
            })}
          </div>
        </div>

        {/* Auto-save inline callout */}
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-[14px] text-gray-500">
            All changes auto-save 2 seconds after you stop typing.
          </p>
        </div>

        {/* Important Notes accordion */}
        <div className="rounded-lg border-l-4 border-blue-600 bg-blue-50">
          <button
            className="flex w-full items-center gap-3 p-4 text-left"
            onClick={handleNotesToggle}
            aria-expanded={notesOpen}
          >
            <Info className="h-5 w-5 text-blue-600 shrink-0" />
            <span className="flex-1 text-[15px] font-semibold text-blue-900">Important Notes</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-blue-600 transition-transform duration-200 ${notesOpen ? "rotate-180" : ""}`}
            />
          </button>
          {notesOpen && (
            <div className="px-4 pb-4 pt-0">
              <ul className="space-y-1 text-[14px] text-blue-800">
                <li>Do not skip sections — complete each tab in order when possible.</li>
                <li>Dropdown fields have predefined options — select from the list.</li>
                <li>For tables, use the &quot;Add Row&quot; button to create new entries.</li>
                <li>You can delete rows using the trash icon on the right side.</li>
                <li>Hover over the ⓘ icon next to field labels for detailed descriptions.</li>
                <li>Export your completed checklist using the &quot;Export XLS&quot; button in the header.</li>
              </ul>
            </div>
          )}
        </div>

        {/* CTA button */}
        {firstContentTab && (
          <div className="flex justify-end pt-2">
            <Link
              href={`${basePath}/${firstContentTab.slug}`}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Continue to {firstContentTab.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
