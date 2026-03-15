"use client";

import Link from "next/link";
import { Download, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SaveStatus } from "./SaveStatus";

interface HeaderProps {
  clientName: string;
  slug: string;
  saveStatus: "saved" | "saving" | "error";
  saveError?: string | null;
  onRetrySave?: () => void;
  onToggleSidebar?: () => void;
  filledCount: number;
  totalCount: number;
}

export function Header({ clientName, slug, saveStatus, saveError, onRetrySave, filledCount, totalCount }: HeaderProps) {
  const handleExport = () => {
    window.open(`/api/export/${slug}`, "_blank");
  };

  return (
    <div>
      <header className="flex h-14 items-center justify-between border-b bg-white px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="hidden lg:flex items-center gap-1.5 mr-2 pr-3 border-r text-xs font-medium text-gray-600 hover:text-gray-900 hover:underline transition-colors min-h-[32px]"
            title="Back to Admin dashboard"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Admin
          </Link>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">{clientName}</h1>
            <p className="text-xs text-gray-500">CRM Configuration Checklist</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <span className="hidden sm:inline text-xs text-gray-500 tabular-nums">
              {filledCount}/{totalCount} sections
            </span>
          )}
          <SaveStatus status={saveStatus} errorMessage={saveError} onRetry={onRetrySave} />
          <Button
            size="sm"
            onClick={handleExport}
            className="bg-blue-600 hover:bg-blue-700 text-white border-none text-[14px] font-medium"
          >
            <Download className="mr-2 h-4 w-4" />
            Export XLS
          </Button>
        </div>
      </header>
      <div className="h-1.5 bg-gray-200">
        <div
          className="h-full bg-blue-600 transition-all duration-500"
          style={{ width: totalCount > 0 ? `${(filledCount / totalCount) * 100}%` : "0%" }}
        />
      </div>
    </div>
  );
}
