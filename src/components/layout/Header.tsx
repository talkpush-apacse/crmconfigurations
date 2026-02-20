"use client";

import Link from "next/link";
import { Download, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SaveStatus } from "./SaveStatus";

interface HeaderProps {
  clientName: string;
  slug: string;
  saveStatus: "saved" | "saving" | "error";
  saveError?: string | null;
  onRetrySave?: () => void;
  onToggleSidebar: () => void;
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
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onToggleSidebar}>
            <Menu className="h-5 w-5" />
          </Button>
          <Link
            href="/admin"
            className="hidden lg:flex items-center gap-1.5 mr-2 pr-3 border-r text-xs font-semibold text-brand-lavender-darker hover:text-brand-lavender-darker/80 transition-colors"
          >
            ← Admin
          </Link>
          <div>
            <h1 className="text-sm font-semibold">{clientName}</h1>
            <p className="text-xs text-muted-foreground">CRM Configuration Checklist</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground">{filledCount}</span>
              <span>/</span>
              <span className="tabular-nums">{totalCount}</span>
              <span className="hidden sm:inline">sections</span>
            </div>
          )}
          <SaveStatus status={saveStatus} errorMessage={saveError} onRetry={onRetrySave} />
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export XLS
          </Button>
        </div>
      </header>
      <div className="h-0.5 bg-muted">
        <div
          className="h-full bg-brand-lavender-darker transition-all duration-500"
          style={{ width: totalCount > 0 ? `${(filledCount / totalCount) * 100}%` : "0%" }}
        />
      </div>
    </div>
  );
}
