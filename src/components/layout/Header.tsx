"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronRight, Download, History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NavItem } from "./TopNav";
import { SaveButton } from "@/components/shared/SaveButton";

interface HeaderProps {
  clientName: string;
  slug: string;
  items: NavItem[];
  saveStatus: "saved" | "saving" | "error";
  saveError?: string | null;
  onRetrySave?: () => void;
  filledCount: number;
  totalCount: number;
  isReadOnly?: boolean;
  editorToken?: string;
  hasPendingChanges?: boolean;
  /** Epoch ms of the last successful save. */
  lastSavedAt?: number | null;
  /** Saves now, rather than waiting for the autosave debounce. */
  onSave?: () => void;
  /** Reverts unsaved edits back to the last saved state. */
  onDiscard?: () => void;
  snapshotsHref?: string;
}

/**
 * How far through the checklist this client is — the single place the header
 * states progress.
 *
 * It used to say the same thing four ways at once: "6/11 sections configured"
 * in the subtitle, a "4 Complete" pill, a "2 In Progress" pill, and a
 * "Completion 55%" bar. Four readings of one fact, in four shapes, competing
 * with Save and Export in the same corner. Per-section state is already on
 * every row of the sidebar and on the Welcome chips, which is where someone
 * looking for *which* sections are outstanding actually goes.
 */
function ProgressMeter({
  filledCount,
  totalCount,
  percent,
}: {
  filledCount: number;
  totalCount: number;
  percent: number;
}) {
  return (
    <div className="hidden min-w-[168px] flex-col gap-1.5 sm:flex">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium tabular-nums text-slate-600">
          {filledCount} of {totalCount} sections
        </span>
        <span className="text-xs font-semibold tabular-nums text-slate-900">
          {percent}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-brand-sage-darker transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function Header({
  clientName,
  slug,
  items,
  saveStatus,
  saveError,
  onRetrySave,
  filledCount,
  totalCount,
  isReadOnly,
  editorToken,
  hasPendingChanges = false,
  lastSavedAt = null,
  onSave,
  onDiscard,
  snapshotsHref,
}: HeaderProps) {
  const pathname = usePathname();

  const handleExport = () => {
    const exportUrl = editorToken
      ? `/api/export/by-token/${editorToken}`
      : `/api/export/${slug}`;
    window.open(exportUrl, "_blank");
  };

  // The per-status counts that used to be derived here fed the two pills that
  // are gone; the sidebar already carries per-section state.
  const activeItem = useMemo(
    () => items.find((item) => item.href === pathname) ?? items[0] ?? null,
    [items, pathname]
  );

  const completionPercent = totalCount > 0
    ? Math.round((filledCount / totalCount) * 100)
    : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-white/70 bg-white/[0.72] shadow-[0_14px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl">
      <div className="brand-gradient-strip h-1.5 w-full" />
      <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {!editorToken && (
            <Link
              href="/admin"
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-all hover:bg-slate-200 hover:text-slate-900 active:scale-95 lg:inline-flex"
              title="Back to Admin dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-600">
                CRM Configuration
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <span className="truncate">{activeItem?.label ?? "Configuration dashboard"}</span>
              {isReadOnly && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700 ring-1 ring-amber-200/70">
                  View only
                </span>
              )}
            </div>

            {/*
              No subtitle. It repeated the tab name that is already in the
              breadcrumb directly above it, and restated the progress the
              meter on the right now owns.
            */}
            <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-950 sm:text-[26px]">
              {clientName}
            </h1>
          </div>
        </div>

        {/*
          One row, not two. Save, progress and Export used to stack on
          separate lines with four progress indicators between them, which is
          what made the header as tall as it was.
        */}
        <div className="flex flex-wrap items-center gap-3 xl:flex-nowrap xl:justify-end">
          <div className="flex flex-wrap items-center gap-2">
            {/*
              Discard sits beside Save, and only while there is something to
              discard — a destructive action does not need to be permanently
              on screen next to the button people actually press.
            */}
            {!isReadOnly && hasPendingChanges && onDiscard && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (
                    window.confirm(
                      "Discard your unsaved changes? They cannot be recovered."
                    )
                  ) {
                    onDiscard();
                  }
                }}
                className="h-7 gap-1.5 border-slate-200 bg-white px-2.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                <X className="h-3 w-3" />
                Discard
              </Button>
            )}
            {isReadOnly ? null : (
              <SaveButton
                status={saveStatus}
                hasPendingChanges={hasPendingChanges}
                lastSavedAt={lastSavedAt}
                errorMessage={saveError}
                onSave={onSave ?? (() => {})}
                onRetry={onRetrySave}
                variant="compact"
              />
            )}
          </div>

          <div className="hidden h-6 w-px bg-slate-200 sm:block" />

          <ProgressMeter
            filledCount={filledCount}
            totalCount={totalCount}
            percent={completionPercent}
          />

          <div className="flex flex-wrap items-center gap-2">
            {snapshotsHref && (
              <Link
                href={snapshotsHref}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:scale-95"
                title="Manage snapshots / restore previous state"
              >
                <History className="h-4 w-4" />
                Snapshots
              </Link>
            )}

            <Button
              size="sm"
              onClick={handleExport}
              className="h-10 rounded-lg bg-primary px-4 text-primary-foreground shadow-[0_10px_22px_-16px_oklch(0.12_0.01_240/0.45)] hover:bg-primary/85 active:scale-95"
            >
              <Download className="h-4 w-4" />
              Export XLS
            </Button>
          </div>
        </div>
      </div>
      </div>
    </header>
  );
}
