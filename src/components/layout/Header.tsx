"use client";

import Link from "next/link";
import { Download, Menu, ArrowLeft } from "lucide-react";
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

export function Header({ clientName, slug, saveStatus, saveError, onRetrySave, onToggleSidebar, filledCount, totalCount }: HeaderProps) {
  const handleExport = () => {
    window.open(`/api/export/${slug}`, "_blank");
  };

  return (
    <div>
      <header className="flex h-14 items-center justify-between border-b bg-white px-4">
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onToggleSidebar}>
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <Link
            href="/admin"
            className="hidden lg:flex items-center gap-1.5 mr-2 pr-3 border-r rounded px-1.5 py-0.5 text-xs font-semibold text-muted-foreground hover:bg-gray-100 hover:text-foreground transition-colors"
            title="Back to Admin dashboard"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Admin
          </Link>
          <div>
            <h1 className="text-sm font-semibold">{clientName}</h1>
            <p className="text-xs text-muted-foreground">CRM Configuration Checklist</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <div className="flex items-center gap-2 rounded-full border bg-gray-50 px-3 py-1 text-xs">
              <span className="font-semibold tabular-nums text-foreground">{filledCount}</span>
              <span className="text-muted-foreground">/</span>
              <span className="tabular-nums text-muted-foreground">{totalCount}</span>
              <span className="hidden sm:inline text-muted-foreground">sections</span>
            </div>
          )}
          <SaveStatus status={saveStatus} errorMessage={saveError} onRetry={onRetrySave} />
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export XLS
          </Button>
        </div>
      </header>
      <div className="h-1.5 bg-muted">
        <div
          className="h-full bg-brand-lavender-darker transition-all duration-500"
          style={{ width: totalCount > 0 ? `${(filledCount / totalCount) * 100}%` : "0%" }}
        />
      </div>
    </div>
  );
}
