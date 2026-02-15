"use client";

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
}

export function Header({ clientName, slug, saveStatus, saveError, onRetrySave, onToggleSidebar }: HeaderProps) {
  const handleExport = () => {
    window.open(`/api/export/${slug}`, "_blank");
  };

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onToggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-sm font-semibold">{clientName}</h1>
          <p className="text-xs text-muted-foreground">CRM Configuration Checklist</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SaveStatus status={saveStatus} errorMessage={saveError} onRetry={onRetrySave} />
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export XLS
        </Button>
      </div>
    </header>
  );
}
