"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEnabledTabs, isClientView } from "@/lib/tab-config";
import { useChecklistContext } from "@/lib/checklist-context";
import { SaveButton } from "@/components/shared/SaveButton";
import { getChecklistProgress } from "@/lib/section-status";

/** Renders Prev / Continue navigation at the bottom of each content sheet. */
export function SectionFooter() {
  const params = useParams();
  const currentTab = params.tab as string;
  const {
    data,
    basePath,
    includeAdminTabs,
    saveStatus,
    saveError,
    hasPendingChanges,
    lastSavedAt,
    publishChanges,
    retrySave,
    isReadOnly,
  } = useChecklistContext();

  const enabledTabs = getEnabledTabs(
    data?.enabledTabs ?? null,
    !!includeAdminTabs,
    data?.tabOrder ?? null,
    data?.customTabs ?? null,
    data?.tabFilledBy ?? null,
  );
  // Exclude welcome from prev/next — it is not a content section
  const contentTabs = enabledTabs.filter((t) => t.slug !== "welcome");

  const currentIndex = contentTabs.findIndex((t) => t.slug === currentTab);

  // Don't render on welcome or unrecognised tabs
  if (currentIndex === -1 || currentTab === "welcome") return null;

  const prevTab = contentTabs[currentIndex - 1];
  const nextTab = contentTabs[currentIndex + 1];

  const isLastSection = !nextTab;
  const progress = getChecklistProgress(data, {
    includeAdminTabs: !!includeAdminTabs,
    clientView: isClientView(basePath),
  });
  const allSectionsComplete =
    progress.totalCount > 0 && progress.completeCount === progress.totalCount;

  return (
    <div className="mt-10 flex flex-col gap-4 rounded-xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Previous link */}
      {prevTab && prevTab.slug !== "welcome" ? (
        <Link
          href={`${basePath}/${prevTab.slug}`}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: {prevTab.label}
        </Link>
      ) : (
        <span />
      )}

      {/* Save, repeated here so it is reachable after a long table */}
      {!isReadOnly && (
        <div className="sm:ml-auto sm:mr-3">
          <SaveButton
            status={saveStatus}
            hasPendingChanges={hasPendingChanges}
            lastSavedAt={lastSavedAt}
            errorMessage={saveError}
            onSave={publishChanges}
            onRetry={retrySave}
            variant="full"
          />
        </div>
      )}

      {/* Next / Complete button */}
      {isLastSection ? (
        allSectionsComplete ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-sage-darker/30 bg-brand-sage-lightest px-3 py-2 text-sm font-medium text-foreground">
            <CheckCircle2 className="h-4 w-4 text-brand-sage-darker" />
            All sections complete
          </div>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">End of checklist</span>
        )
      ) : nextTab ? (
        <Button asChild size="sm" className="h-11 gap-2 px-4">
          <Link href={`${basePath}/${nextTab.slug}`}>
            Continue to {nextTab.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
