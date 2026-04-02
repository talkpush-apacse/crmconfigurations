"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEnabledTabs } from "@/lib/tab-config";
import { useChecklistContext } from "@/lib/checklist-context";

/** Renders Prev / Continue navigation at the bottom of each content sheet. */
export function SectionFooter() {
  const params = useParams();
  const currentTab = params.tab as string;
  const { data, basePath } = useChecklistContext();

  const enabledTabs = getEnabledTabs(data?.enabledTabs ?? null, false, data?.tabOrder ?? null);
  // Exclude welcome from prev/next — it is not a content section
  const contentTabs = enabledTabs.filter((t) => t.slug !== "welcome");

  const currentIndex = contentTabs.findIndex((t) => t.slug === currentTab);

  // Don't render on welcome or unrecognised tabs
  if (currentIndex === -1 || currentTab === "welcome") return null;

  const prevTab = contentTabs[currentIndex - 1];
  const nextTab = contentTabs[currentIndex + 1];

  const isLastSection = !nextTab;

  return (
    <div className="mt-10 flex flex-col gap-4 rounded-[24px] bg-white/[0.82] px-5 py-5 shadow-sm ring-1 ring-slate-200/70 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
      {/* Previous link */}
      {prevTab && prevTab.slug !== "welcome" ? (
        <Link
          href={`${basePath}/${prevTab.slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: {prevTab.label}
        </Link>
      ) : (
        <span />
      )}

      {/* Next / Complete button */}
      {isLastSection ? (
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200/70">
          <CheckCircle2 className="h-4 w-4" />
          All sections complete
        </div>
      ) : nextTab ? (
        <Button asChild size="sm" className="h-11 gap-2 rounded-xl bg-[#1A73E8] px-4 text-white hover:bg-[#1765cb] active:scale-95">
          <Link href={`${basePath}/${nextTab.slug}`}>
            Continue to {nextTab.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
