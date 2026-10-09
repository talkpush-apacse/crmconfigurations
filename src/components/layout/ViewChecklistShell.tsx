"use client";

import { useMemo, useRef } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { Header } from "@/components/layout/Header";
import { SectionSelect } from "@/components/layout/SectionSelect";
import { ChecklistLookProvider, useChecklistLookState } from "@/components/layout/ChecklistLook";
import type { ChecklistLook } from "@/lib/checklist-look";
import { ChecklistContext } from "@/lib/checklist-context";
import { getEnabledTabs, excludeTalkpushTabs } from "@/lib/tab-config";
import { getSectionState, getCustomTabSectionState } from "@/lib/section-status";
import type { ChecklistData, CustomTab, CustomData, TabUploadMetaMap } from "@/lib/types";
import type { NavItem } from "@/components/layout/TopNav";

const noop = () => {};

/**
 * The read-only frame for a view link (/view/<token>). It shows what a client sees, with every control that
 * changes something switched off. The data is loaded on the server and handed in; this page never saves, so it
 * has no save state, no polling and no way to write.
 */
export function ViewChecklistShell({
  token,
  data,
  failed = false,
  fontClass = "",
  initialLook,
  children,
}: {
  token: string;
  data: ChecklistData | null;
  /** The server could not look the link up (not the same as "no such link"). */
  failed?: boolean;
  fontClass?: string;
  initialLook?: ChecklistLook;
  children: React.ReactNode;
}) {
  const { value: lookValue, rootClass } = useChecklistLookState(initialLook, fontClass);
  const neverPending = useRef(false);

  const contextValue = useMemo(
    () =>
      data
        ? {
            data,
            updateField: noop,
            saveStatus: "saved" as const,
            saveError: null,
            hasPendingChanges: false,
            lastSavedAt: null,
            retrySave: noop,
            publishChanges: noop,
            discardChanges: noop,
            isReadOnly: true,
            userRole: null,
            basePath: `/view/${token}`,
          }
        : null,
    [data, token]
  );

  if (!data || !contextValue) {
    return (
      <div className="flex h-screen items-center justify-center px-6">
        <div role="alert" className="max-w-md text-center">
          <p className="text-lg font-semibold text-foreground">
            {failed ? "This page could not be loaded" : "This link is not available"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {failed
              ? "Please try again in a moment."
              : "It may have been turned off or replaced with a new one. Ask the person who shared it for the current link."}
          </p>
        </div>
      </div>
    );
  }

  const isCustom = !!data.isCustom;
  const customTabs = (data.customTabs as CustomTab[] | null) ?? null;
  const customData = (data.customData as CustomData | null) ?? null;

  // The same tabs a client sees: the ones Talkpush fills in are not part of the shared view.
  const enabledTabs = isCustom
    ? []
    : excludeTalkpushTabs(
        getEnabledTabs(
          data.enabledTabs ?? null,
          false,
          data.tabOrder ?? null,
          customTabs,
          (data.tabFilledBy as Record<string, "talkpush" | "client"> | null) ?? null,
        ),
      );

  const tabUploadMeta = (data.tabUploadMeta as TabUploadMetaMap | null) ?? null;

  const navItems: NavItem[] = enabledTabs.map((tab) => {
    let status: NavItem["status"] = null;
    if (tab.customTabId) {
      const ct = customTabs?.find((c) => c.id === tab.customTabId);
      if (ct) status = getCustomTabSectionState(ct, customData);
    } else if (tab.dataKey) {
      status = getSectionState(data[tab.dataKey as keyof ChecklistData], tab.dataKey);
    }
    const hasAttachments = !!tab.dataKey && (tabUploadMeta?.[tab.dataKey]?.uploadedFiles?.length ?? 0) > 0;
    return {
      label: tab.label,
      href: `/view/${token}/${tab.slug}`,
      status,
      icon: tab.icon,
      slug: tab.slug,
      filledBy: tab.filledBy,
      hasAttachments,
    };
  });

  return (
    <ChecklistContext.Provider value={contextValue}>
      <ChecklistLookProvider value={lookValue}>
        <div className={`${rootClass} flex h-screen flex-col overflow-hidden bg-background text-foreground`}>
          <Header
            clientName={data.clientName}
            slug={data.slug}
            items={navItems}
            saveStatus="saved"
            isReadOnly
          />
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {!isCustom && <TopNav items={navItems} clientName={data.clientName} hasPendingChangesRef={neverPending} />}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {!isCustom && <SectionSelect items={navItems} hasPendingChangesRef={neverPending} />}
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
