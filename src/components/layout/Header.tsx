"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronRight, Download, History, MoreHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { NavItem } from "./TopNav";
import { SaveButton } from "@/components/shared/SaveButton";

interface HeaderProps {
  clientName: string;
  slug: string;
  items: NavItem[];
  saveStatus: "saved" | "saving" | "error";
  saveError?: string | null;
  onRetrySave?: () => void;
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

function StatusPill({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: number;
  tone: "blue" | "emerald" | "amber";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium shadow-sm",
        tone === "blue" && "bg-brand-lavender-lightest text-brand-lavender-darker ring-1 ring-brand-lavender/40",
        tone === "emerald" && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70",
        tone === "amber" && "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70",
        className
      )}
    >
      <span className="tabular-nums">{value}</span>
      <span>{label}</span>
    </span>
  );
}

export function Header({
  clientName,
  slug,
  items,
  saveStatus,
  saveError,
  onRetrySave,
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

  const { activeItem, completeCount, inProgressCount, totalCount } = useMemo(() => {
    const active = items.find((item) => item.href === pathname) ?? items[0] ?? null;
    const statusItems = items.filter((item) => item.status !== null);

    return {
      activeItem: active,
      completeCount: statusItems.filter((item) => item.status === "complete").length,
      inProgressCount: statusItems.filter((item) => item.status === "in-progress").length,
      totalCount: statusItems.length,
    };
  }, [items, pathname]);

  const completionPercent = totalCount > 0
    ? Math.round((completeCount / totalCount) * 100)
    : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-card/95 shadow-sm backdrop-blur-xl">
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

            <div className="mt-3">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
                {clientName}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{activeItem?.label ?? "Configuration dashboard"}</span>
                <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block" />
                <span className="tabular-nums">{completeCount}/{totalCount} sections complete</span>
              </p>
            </div>

          </div>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
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
            <StatusPill label="Complete" value={completeCount} tone="emerald" className="hidden sm:inline-flex" />
            <StatusPill label="In Progress" value={inProgressCount} tone="amber" className="hidden sm:inline-flex" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden items-center gap-3 rounded-2xl bg-slate-100/90 px-3 py-2 text-xs text-slate-500 shadow-sm ring-1 ring-slate-200/70 sm:flex">
              <span className="font-medium text-slate-600">Completion</span>
              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-brand-sage-darker transition-all duration-300"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <span className="font-semibold tabular-nums text-slate-900">{completionPercent}%</span>
            </div>

            {snapshotsHref && (
              <Link
                href={snapshotsHref}
                className="hidden h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:scale-95 sm:inline-flex"
                title="Manage snapshots / restore previous state"
              >
                <History className="h-4 w-4" />
                Snapshots
              </Link>
            )}

            <Button
              size="sm"
              onClick={handleExport}
              className="hidden h-11 rounded-xl bg-primary px-4 text-primary-foreground shadow-[0_14px_28px_-18px_oklch(0.12_0.01_240/0.5)] hover:bg-primary/85 active:scale-95 sm:inline-flex"
            >
              <Download className="h-4 w-4" />
              Export XLS
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-xl bg-white sm:hidden"
                  aria-label="More checklist actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {snapshotsHref && (
                  <DropdownMenuItem asChild>
                    <Link href={snapshotsHref}>
                      <History className="h-4 w-4" />
                      Snapshots
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="h-4 w-4" />
                  Export XLS
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      </div>
    </header>
  );
}
