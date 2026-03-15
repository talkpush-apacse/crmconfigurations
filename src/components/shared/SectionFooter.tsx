"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEnabledTabs } from "@/lib/tab-config";
import { useChecklistContext } from "@/lib/checklist-context";

/** Renders a "Continue to next section" button at the bottom of each content sheet. */
export function SectionFooter() {
  const params = useParams();
  const slug = params.slug as string;
  const currentTab = params.tab as string;
  const { data } = useChecklistContext();

  const enabledTabs = getEnabledTabs(data?.enabledTabs ?? null);
  const currentIndex = enabledTabs.findIndex((t) => t.slug === currentTab);
  const nextTab = enabledTabs[currentIndex + 1];

  // Don't render on the last tab or when navigation can't be determined
  if (!nextTab || currentIndex === -1) return null;

  return (
    <div className="mt-8 flex justify-end border-t pt-4">
      <Button asChild variant="outline" size="sm" className="gap-2">
        <Link href={`/client/${slug}/${nextTab.slug}`}>
          Continue to {nextTab.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
