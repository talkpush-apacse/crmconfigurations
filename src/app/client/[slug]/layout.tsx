"use client";

import { useParams } from "next/navigation";
import { useChecklist } from "@/hooks/useChecklist";
import { TopNav } from "@/components/layout/TopNav";
import { FloatingActionBar } from "@/components/layout/FloatingActionBar";
import { Header } from "@/components/layout/Header";
import { ChecklistContext } from "@/lib/checklist-context";
import { getEnabledTabs } from "@/lib/tab-config";
import { getSectionState, getCustomTabSectionState } from "@/lib/section-status";
import type { ChecklistData, CustomTab, CustomData, TabUploadMetaMap } from "@/lib/types";
import type { NavItem } from "@/components/layout/TopNav";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;
  const {
    data,
    loading,
    error,
    saveStatus,
    saveError,
    hasPendingChanges,
    updateField,
    retrySave,
    publishChanges,
    discardChanges,
    hasPendingChangesRef,
  } = useChecklist(slug);

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

  const isCustom = !!data.isCustom;
  const customTabs = (data.customTabs as CustomTab[] | null) ?? null;
  const customData = (data.customData as CustomData | null) ?? null;

  const enabledTabs = isCustom
    ? []
    : getEnabledTabs(
        data.enabledTabs ?? null,
        false,
        data.tabOrder ?? null,
        customTabs,
        (data.tabFilledBy as Record<string, "talkpush" | "client"> | null) ?? null,
      );

  const tabsWithData = enabledTabs.filter((t) => t.dataKey || t.customTabId);
  const filledCount = isCustom
    ? 0
    : tabsWithData.filter((t) => {
        if (t.customTabId) {
          const ct = customTabs?.find((c) => c.id === t.customTabId);
          return ct ? getCustomTabSectionState(ct.fields, customData) !== "not-started" : false;
        }
        const val = (data as ChecklistData)[t.dataKey as keyof ChecklistData];
        return getSectionState(val, t.dataKey) !== "not-started";
      }).length;
  const totalCount = isCustom ? 0 : tabsWithData.length;

  const tabUploadMeta = (data.tabUploadMeta as TabUploadMetaMap | null) ?? null;

  const navItems: NavItem[] = enabledTabs.map((tab) => {
    let status: NavItem["status"] = null;
    if (tab.customTabId) {
      const ct = customTabs?.find((c) => c.id === tab.customTabId);
      if (ct) status = getCustomTabSectionState(ct.fields, customData);
    } else if (tab.dataKey && data) {
      status = getSectionState((data as ChecklistData)[tab.dataKey as keyof ChecklistData], tab.dataKey);
    }
    const hasAttachments =
      !!tab.dataKey && (tabUploadMeta?.[tab.dataKey]?.uploadedFiles?.length ?? 0) > 0;
    return {
      label: tab.label,
      href: `/client/${slug}/${tab.slug}`,
      status,
      icon: tab.icon,
      slug: tab.slug,
      filledBy: tab.filledBy,
      hasAttachments,
    };
  });

  return (
    <ChecklistContext.Provider value={{ data, updateField, saveStatus, saveError, hasPendingChanges, retrySave, publishChanges, discardChanges, isReadOnly: false, userRole: null, basePath: `/client/${slug}` }}>
      <div className="flex h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(226,232,240,0.9),_transparent_36%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_42%,#f8fafc_100%)] text-slate-950">
        <Header
          clientName={data.clientName}
          slug={slug}
          items={navItems}
          saveStatus={saveStatus}
          saveError={saveError}
          onRetrySave={retrySave}
          filledCount={filledCount}
          totalCount={totalCount}
          hasPendingChanges={hasPendingChanges}
        />
        <div className="flex flex-1 overflow-hidden">
          {!isCustom && (
            <TopNav items={navItems} clientName={data.clientName} hasPendingChangesRef={hasPendingChangesRef} />
          )}
          <div className="flex flex-col flex-1 overflow-hidden">
            <main className="flex-1 overflow-y-auto">
              <div className="px-4 py-6 sm:px-6 lg:px-8 xl:px-10">{children}</div>
            </main>
          </div>
        </div>
        <FloatingActionBar
          visible={hasPendingChanges}
          isSaving={saveStatus === "saving"}
          onDiscard={discardChanges}
          onPublish={publishChanges}
        />
      </div>
    </ChecklistContext.Provider>
  );
}
