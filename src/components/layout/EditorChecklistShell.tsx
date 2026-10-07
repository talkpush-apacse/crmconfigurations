"use client";

import { useState, useEffect } from "react";
import { useChecklist } from "@/hooks/useChecklist";
import { TopNav } from "@/components/layout/TopNav";
import { Header } from "@/components/layout/Header";
import { SectionSelect } from "@/components/layout/SectionSelect";
import { ChecklistLookProvider, useChecklistLookState } from "@/components/layout/ChecklistLook";
import type { ChecklistLook } from "@/lib/checklist-look";
import { ChecklistContext } from "@/lib/checklist-context";
import { getEnabledTabs } from "@/lib/tab-config";
import { getSectionState, getCustomTabSectionState } from "@/lib/section-status";
import type { ChecklistData, CustomTab, CustomData, TabUploadMetaMap } from "@/lib/types";
import type { NavItem } from "@/components/layout/TopNav";

/**
 * The editor frame (header, tab nav, save status, admin controls). The checklist itself is loaded on the server and
 * handed in as `initialData`, so the page appears with its data in the first response.
 */
export function EditorChecklistShell({
  token,
  initialData,
  fontClass = "",
  initialLook,
  children,
}: {
  token: string;
  initialData: ChecklistData | null;
  /** next/font class for the modern look type. See useChecklistLookState. */
  fontClass?: string;
  /** The look saved in the visitor's cookie, read on the server so the first paint is right. */
  initialLook?: ChecklistLook;
  children: React.ReactNode;
}) {
  const [isAdmin, setIsAdmin] = useState(false);
  const { value: lookValue, rootClass } = useChecklistLookState(initialLook, fontClass);

  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then(({ authenticated, role }: { authenticated: boolean; role?: string }) => setIsAdmin(!!authenticated && role === "editor"))
      .catch(() => setIsAdmin(false));
  }, []);

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
  } = useChecklist(token, "token", initialData);

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
          <p className="mt-2 text-sm text-muted-foreground">{error || "This link may be invalid or expired."}</p>
        </div>
      </div>
    );
  }

  const isCustom = !!data.isCustom;
  const customTabs = (data.customTabs as CustomTab[] | null) ?? null;
  const customData = (data.customData as CustomData | null) ?? null;

  // Admin-only tabs are shown when the user has admin auth
  const enabledTabs = isCustom
    ? []
    : getEnabledTabs(
        data.enabledTabs ?? null,
        isAdmin,
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
      href: `/editor/${token}/${tab.slug}`,
      status,
      icon: tab.icon,
      slug: tab.slug,
      filledBy: tab.filledBy,
      hasAttachments,
      canChangeOwnership: isAdmin && !tab.adminOnly && !!(tab.dataKey || tab.customTabId),
    };
  });

  const handleTabReorder = (slugs: string[]) => {
    updateField("tabOrder", slugs);
  };

  const handleOwnershipChange = (slug: string, filledBy: "talkpush" | "client") => {
    if (!isAdmin) return;
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
        userRole: isAdmin ? "admin" : null,
        includeAdminTabs: isAdmin,
        basePath: `/editor/${token}`,
      }}
    >
      <ChecklistLookProvider value={lookValue}>
      <div className={`${rootClass} flex h-screen flex-col overflow-hidden bg-background text-foreground`}>
        <Header
          clientName={data.clientName}
          slug={data.slug}
          items={navItems}
          saveStatus={saveStatus}
          saveError={saveError}
          onRetrySave={retrySave}
          isReadOnly={false}
          editorToken={token}
          shareLink={isAdmin ? `${window.location.origin}/editor/${token}/welcome` : undefined}
          hasPendingChanges={hasPendingChanges}
          lastSavedAt={lastSavedAt}
          onSave={publishChanges}
          onDiscard={discardChanges}
        />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {!isCustom && (
            <TopNav
              items={navItems}
              clientName={data.clientName}
              hasPendingChangesRef={hasPendingChangesRef}
              onReorder={handleTabReorder}
              onOwnershipChange={isAdmin ? handleOwnershipChange : undefined}
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
    </ChecklistContext.Provider>
  );
}
