"use client";

import { useParams } from "next/navigation";
import { useChecklist } from "@/hooks/useChecklist";
import { TopNav } from "@/components/layout/TopNav";
import { LegendBar } from "@/components/layout/LegendBar";
import { Header } from "@/components/layout/Header";
import { ChecklistContext } from "@/lib/checklist-context";
import { getEnabledTabs } from "@/lib/tab-config";
import { getSectionState } from "@/lib/section-status";
import type { ChecklistData } from "@/lib/types";
import type { NavItem } from "@/components/layout/TopNav";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;
  const { data, loading, error, saveStatus, saveError, updateField, retrySave } = useChecklist(slug);

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

  const enabledTabs = getEnabledTabs(data.enabledTabs ?? null);

  const tabsWithData = enabledTabs.filter((t) => t.dataKey);
  const filledCount = tabsWithData.filter((t) => {
    const val = (data as ChecklistData)[t.dataKey as keyof ChecklistData];
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object") return Object.values(val as unknown as Record<string, unknown>).some((v) => v !== "" && v !== null);
    return true;
  }).length;
  const totalCount = tabsWithData.length;

  const navItems: NavItem[] = enabledTabs.map((tab) => {
    let status: NavItem["status"] = null;
    if (tab.dataKey && data) {
      status = getSectionState((data as ChecklistData)[tab.dataKey as keyof ChecklistData]);
    }
    return {
      label: tab.label,
      href: `/client/${slug}/${tab.slug}`,
      status,
    };
  });

  return (
    <ChecklistContext.Provider value={{ data, updateField, saveStatus, saveError, retrySave }}>
      <div className="flex h-screen flex-col overflow-hidden">
        <Header
          clientName={data.clientName}
          slug={slug}
          saveStatus={saveStatus}
          saveError={saveError}
          onRetrySave={retrySave}
          filledCount={filledCount}
          totalCount={totalCount}
        />
        <TopNav items={navItems} />
        <LegendBar />
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-5 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </ChecklistContext.Provider>
  );
}
