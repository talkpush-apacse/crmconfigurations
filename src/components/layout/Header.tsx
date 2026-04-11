"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NavItem } from "./TopNav";
import { SaveStatus } from "./SaveStatus";

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
}

function StatusPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "emerald" | "amber";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium shadow-sm",
        tone === "blue" && "bg-blue-50 text-blue-700 ring-1 ring-blue-200/70",
        tone === "emerald" && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70",
        tone === "amber" && "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70"
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
  filledCount,
  totalCount,
  isReadOnly,
  editorToken,
  hasPendingChanges = false,
}: HeaderProps) {
  const pathname = usePathname();

  const handleExport = () => {
    const exportUrl = editorToken
      ? `/api/export/by-token/${editorToken}`
      : `/api/export/${slug}`;
    window.open(exportUrl, "_blank");
  };

  const { activeItem, completeCount, inProgressCount } = useMemo(() => {
    const active = items.find((item) => item.href === pathname) ?? items[0] ?? null;

    return {
      activeItem: active,
      completeCount: items.filter((item) => item.status === "complete").length,
      inProgressCount: items.filter((item) => item.status === "in-progress").length,
    };
  }, [items, pathname]);

  const completionPercent = totalCount > 0
    ? Math.round((filledCount / totalCount) * 100)
    : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-white/70 bg-white/[0.72] px-4 py-4 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:px-6 lg:px-8">
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
              <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-950 sm:text-[28px]">
                {clientName}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>{activeItem?.label ?? "Configuration dashboard"}</span>
                <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block" />
                <span className="tabular-nums">{filledCount}/{totalCount} sections configured</span>
              </p>
            </div>

          </div>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <SaveStatus
              status={saveStatus}
              errorMessage={saveError}
              onRetry={onRetrySave}
              hasPendingChanges={hasPendingChanges}
            />
            <StatusPill label="Complete" value={completeCount} tone="emerald" />
            <StatusPill label="In Progress" value={inProgressCount} tone="amber" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden items-center gap-3 rounded-2xl bg-slate-100/90 px-3 py-2 text-xs text-slate-500 shadow-sm ring-1 ring-slate-200/70 sm:flex">
              <span className="font-medium text-slate-600">Completion</span>
              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[#1A73E8] transition-all duration-300"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <span className="font-semibold tabular-nums text-slate-900">{completionPercent}%</span>
            </div>

            <Button
              size="sm"
              onClick={handleExport}
              className="h-11 rounded-xl bg-[#1A73E8] px-4 text-white shadow-[0_16px_30px_-18px_rgba(26,115,232,0.85)] hover:bg-[#1765cb] active:scale-95"
            >
              <Download className="h-4 w-4" />
              Export XLS
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
