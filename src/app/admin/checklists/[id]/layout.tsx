"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useChecklist } from "@/hooks/useChecklist";
import { TopNav } from "@/components/layout/TopNav";
import { Header } from "@/components/layout/Header";
import { SectionSelect } from "@/components/layout/SectionSelect";
import { ChecklistLookProvider, useChecklistLookState } from "@/components/layout/ChecklistLook";
import { figtree } from "@/lib/client-form-font";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ApplyRequirementsTemplateSheet } from "@/components/admin/ApplyRequirementsTemplateSheet";
import { ChecklistContext } from "@/lib/checklist-context";
import { getEnabledTabs } from "@/lib/tab-config";
import { getSectionState, getCustomTabSectionState } from "@/lib/section-status";
import type { ChecklistData, CustomTab, CustomData, TabUploadMetaMap } from "@/lib/types";
import type { NavItem } from "@/components/layout/TopNav";

export default function AdminChecklistLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const id = params.id as string;
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  // Same modern look as the client's checklist, with a switch back to classic. See ChecklistLook.
  const { value: lookValue, rootClass } = useChecklistLookState(undefined, figtree.variable);
  const {
    data,
    loading,
    error,
    saveStatus,
    saveError,
    hasPendingChanges,
    lastSavedAt,
    updateField,
    retrySave,
    publishChanges,
    discardChanges,
    hasPendingChangesRef,
  } = useChecklist(id, "id");

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
        true,
        data.tabOrder ?? null,
        customTabs,
        (data.tabFilledBy as Record<string, "talkpush" | "client"> | null) ?? null,
      );

  const tabUploadMeta = (data.tabUploadMeta as TabUploadMetaMap | null) ?? null;

  const navItems: NavItem[] = enabledTabs.map((tab) => {
    let status: NavItem["status"] = null;
    if (tab.customTabId) {
      const ct = customTabs?.find((c) => c.id === tab.customTabId);
      if (ct) status = getCustomTabSectionState(ct, customData);
    } else if (tab.dataKey && data) {
      status = getSectionState((data as ChecklistData)[tab.dataKey as keyof ChecklistData], tab.dataKey);
    }
    const hasAttachments =
      !!tab.dataKey && (tabUploadMeta?.[tab.dataKey]?.uploadedFiles?.length ?? 0) > 0;
    return {
      label: tab.label,
      href: `/admin/checklists/${id}/${tab.slug}`,
      status,
      icon: tab.icon,
      slug: tab.slug,
      filledBy: tab.filledBy,
      hasAttachments,
      canChangeOwnership: !tab.adminOnly && !!(tab.dataKey || tab.customTabId),
    };
  });

  const handleTabReorder = (slugs: string[]) => {
    updateField("tabOrder", slugs);
  };

  const handleOwnershipChange = (slug: string, filledBy: "talkpush" | "client") => {
    updateField("tabFilledBy", { ...(data.tabFilledBy ?? {}), [slug]: filledBy });
  };

  return (
    <ChecklistContext.Provider
      value={{
        data,
        updateField,
        saveStatus,
        saveError,
        hasPendingChanges,
        lastSavedAt,
        retrySave,
        publishChanges,
        discardChanges,
        isReadOnly: false,
        userRole: "admin",
        includeAdminTabs: true,
        basePath: `/admin/checklists/${id}`,
      }}
    >
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        {/* The shared Implementation Hub header, so staff can switch modules from here. */}
        <AdminHeader />
        <ChecklistLookProvider value={lookValue}>
        {/* display: contents keeps this wrapper out of the flex layout while it carries the look classes. */}
        <div className={`${rootClass} contents`}>
        <Header
          variant="staff"
          company={(data as { account?: { id: string; name: string } | null }).account ?? null}
          clientName={data.clientName}
          slug={data.slug}
          items={navItems}
          saveStatus={saveStatus}
          saveError={saveError}
          onRetrySave={retrySave}
          isReadOnly={false}
          hasPendingChanges={hasPendingChanges}
          lastSavedAt={lastSavedAt}
          onSave={publishChanges}
          onDiscard={discardChanges}
          snapshotsHref={`/admin/checklists/${id}/snapshots`}
          historyHref={`/admin/checklists/${id}/history`}
          onApplyTemplate={isCustom ? undefined : () => setApplyTemplateOpen(true)}
        />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {!isCustom && (
            <TopNav
              items={navItems}
              clientName={data.clientName}
              hasPendingChangesRef={hasPendingChangesRef}
              onReorder={handleTabReorder}
              onOwnershipChange={handleOwnershipChange}
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {!isCustom && (
              <SectionSelect items={navItems} hasPendingChangesRef={hasPendingChangesRef} />
            )}
            <main className="flex-1 overflow-y-auto">
              <div className="px-4 py-6 sm:px-6 lg:px-8 xl:px-10">{children}</div>
            </main>
          </div>
        </div>
        </div>
        </ChecklistLookProvider>
        {!isCustom && (
          <ApplyRequirementsTemplateSheet
            checklistId={id}
            clientName={data.clientName}
            open={applyTemplateOpen}
            onOpenChange={setApplyTemplateOpen}
            hideTrigger
          />
        )}
      </div>
    </ChecklistContext.Provider>
  );
}
