"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useChecklist } from "@/hooks/useChecklist";
import { TabNavigation } from "@/components/layout/TabNavigation";
import { Header } from "@/components/layout/Header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ChecklistContext } from "@/lib/checklist-context";
import { getEnabledTabs } from "@/lib/tab-config";
import type { ChecklistData } from "@/lib/types";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;
  const { data, loading, error, saveStatus, saveError, updateField, retrySave } = useChecklist(slug);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading checklist...</p>
        </div>
      </div>
    );
  }

  const tabsWithData = getEnabledTabs(data?.enabledTabs ?? null).filter((t) => t.dataKey);
  const filledCount = data
    ? tabsWithData.filter((t) => {
        const val = (data as ChecklistData)[t.dataKey as keyof ChecklistData];
        if (val === null || val === undefined) return false;
        if (Array.isArray(val)) return val.length > 0;
        if (typeof val === "object") return Object.values(val as unknown as Record<string, unknown>).some((v) => v !== "" && v !== null);
        return true;
      }).length
    : 0;
  const totalCount = tabsWithData.length;

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-destructive">Checklist not found</p>
          <p className="mt-2 text-sm text-muted-foreground">{error || "This checklist does not exist."}</p>
        </div>
      </div>
    );
  }

  return (
    <ChecklistContext.Provider value={{ data, updateField, saveStatus, saveError, retrySave }}>
      <div className="flex h-screen flex-col">
        <Header
          clientName={data.clientName}
          slug={slug}
          saveStatus={saveStatus}
          saveError={saveError}
          onRetrySave={retrySave}
          onToggleSidebar={() => setSidebarOpen(true)}
          filledCount={filledCount}
          totalCount={totalCount}
        />
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop sidebar */}
          <aside className="hidden w-64 xl:w-72 shrink-0 border-r bg-gray-50/50 lg:block">
            <ScrollArea className="h-full">
              <TabNavigation slug={slug} data={data} />
            </ScrollArea>
          </aside>

          {/* Mobile sidebar */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <ScrollArea className="h-full">
                <TabNavigation slug={slug} data={data} />
              </ScrollArea>
            </SheetContent>
          </Sheet>

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            <div className="px-4 py-5 sm:px-6 lg:px-8">{children}</div>
          </main>
        </div>
      </div>
    </ChecklistContext.Provider>
  );
}
