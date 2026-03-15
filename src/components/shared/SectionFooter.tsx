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
  const slug = params.slug as string;
  const currentTab = params.tab as string;
  const { data } = useChecklistContext();

  const enabledTabs = getEnabledTabs(data?.enabledTabs ?? null);
  // Exclude welcome and about from prev/next — they are not content sections
  const contentTabs = enabledTabs.filter((t) => t.slug !== "about");

  const currentIndex = contentTabs.findIndex((t) => t.slug === currentTab);

  // Don't render on welcome, about, or unrecognised tabs
  if (currentIndex === -1 || currentTab === "welcome" || currentTab === "about") return null;

  const prevTab = contentTabs[currentIndex - 1];
  const nextTab = contentTabs[currentIndex + 1];

  // When the next tab is "about", this is the last content section
  const isLastSection = !nextTab || nextTab.slug === "about";

  return (
    <div className="mt-10 flex items-center justify-between border-t border-gray-200 pt-5">
      {/* Previous link */}
      {prevTab && prevTab.slug !== "welcome" ? (
        <Link
          href={`/client/${slug}/${prevTab.slug}`}
          className="inline-flex items-center gap-1.5 text-[14px] text-gray-500 hover:text-gray-900 hover:underline transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: {prevTab.label}
        </Link>
      ) : (
        <span />
      )}

      {/* Next / Complete button */}
      {nextTab && (
        isLastSection ? (
          <Button asChild size="sm" className="gap-2 bg-green-600 hover:bg-green-700 text-white">
            <Link href={`/client/${slug}/${nextTab.slug}`}>
              <CheckCircle2 className="h-4 w-4" />
              Complete Checklist
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Link href={`/client/${slug}/${nextTab.slug}`}>
              Continue to {nextTab.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )
      )}
    </div>
  );
}
