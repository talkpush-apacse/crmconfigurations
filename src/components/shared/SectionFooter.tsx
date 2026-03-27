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

  const enabledTabs = getEnabledTabs(data?.enabledTabs ?? null);
  // Exclude welcome from prev/next — it is not a content section
  const contentTabs = enabledTabs.filter((t) => t.slug !== "welcome");

  const currentIndex = contentTabs.findIndex((t) => t.slug === currentTab);

  // Don't render on welcome or unrecognised tabs
  if (currentIndex === -1 || currentTab === "welcome") return null;

  const prevTab = contentTabs[currentIndex - 1];
  const nextTab = contentTabs[currentIndex + 1];

  const isLastSection = !nextTab;

  return (
    <div className="mt-10 flex items-center justify-between border-t border-gray-200 pt-5">
      {/* Previous link */}
      {prevTab && prevTab.slug !== "welcome" ? (
        <Link
          href={`${basePath}/${prevTab.slug}`}
          className="inline-flex items-center gap-1.5 text-[14px] text-gray-500 hover:text-gray-900 hover:underline transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: {prevTab.label}
        </Link>
      ) : (
        <span />
      )}

      {/* Next / Complete button */}
      {isLastSection ? (
        <div className="inline-flex items-center gap-1.5 text-sm text-green-700 font-medium">
          <CheckCircle2 className="h-4 w-4" />
          All sections complete
        </div>
      ) : nextTab ? (
        <Button asChild size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
          <Link href={`${basePath}/${nextTab.slug}`}>
            Continue to {nextTab.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
