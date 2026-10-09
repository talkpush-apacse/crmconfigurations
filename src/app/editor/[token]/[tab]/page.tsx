"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { getTabBySlug, getEnabledTabs, getCustomTabBySlug, excludeTalkpushTabs, isClientView } from "@/lib/tab-config";
import { useChecklistContext } from "@/lib/checklist-context";
import { sheetComponents, LazyAutoflowsSheet, LazyCustomChecklistForm, LazyCustomTabSheet } from "@/components/sheets/lazy-sheets";

/**
 * One tab of the editor link. The read-only view link (/view/<token>/<tab>) renders this same page: it only differs
 * by the context its shell provides (isReadOnly, basePath), so the two can never show different content.
 */
export default function EditorTabPage() {
  const params = useParams();
  const router = useRouter();
  const tab = params.tab as string;
  const { data, userRole, basePath } = useChecklistContext();
  const isViewLink = isClientView(basePath) && basePath.startsWith("/view/");

  // Custom checklists: render the custom form regardless of tab slug
  const isCustom = !!data?.isCustom;

  const tabConfig = isCustom ? null : getTabBySlug(tab);
  const customTab = isCustom ? null : getCustomTabBySlug(tab, data?.customTabs);

  // Admin users see admin-only tabs; editor link holders do not
  const enabledTabs = useMemo(() => {
    if (isCustom) return [];
    const tabs = getEnabledTabs(
      data?.enabledTabs ?? null,
      userRole === "admin",
      data?.tabOrder ?? null,
      data?.customTabs,
      isViewLink ? ((data?.tabFilledBy as Record<string, "talkpush" | "client"> | null) ?? null) : null,
    );
    // The view link shows what a client sees, so the tabs Talkpush fills in are not part of it.
    return isViewLink ? excludeTalkpushTabs(tabs) : tabs;
  }, [isCustom, isViewLink, userRole, data?.enabledTabs, data?.tabOrder, data?.customTabs, data?.tabFilledBy]);
  const isEnabled = isCustom || enabledTabs.some((t) => t.slug === tab);

  // Auto-redirect to first enabled tab if current tab is disabled
  useEffect(() => {
    if (!isCustom && !customTab && tabConfig && !isEnabled && enabledTabs.length > 0) {
      router.replace(`${basePath}/${enabledTabs[0].slug}`);
    }
  }, [isCustom, customTab, tabConfig, isEnabled, enabledTabs, basePath, router]);

  // Dynamic browser tab title
  useEffect(() => {
    if (isCustom && data?.clientName) {
      document.title = `Custom Checklist | ${data.clientName} | Talkpush CRM`;
    } else if (customTab && data?.clientName) {
      document.title = `${customTab.label} | ${data.clientName} | Talkpush CRM`;
    } else if (tabConfig && data?.clientName) {
      document.title = `${tabConfig.label} | ${data.clientName} | Talkpush CRM`;
    }
  }, [isCustom, tab, tabConfig, customTab, data?.clientName]);

  // Custom checklist: render the dynamic form
  if (isCustom) {
    return <LazyCustomChecklistForm />;
  }

  // Custom tab on a standard checklist
  if (customTab) {
    // Table-based tabs (created via MCP or spreadsheet import) have columns
    // defined. Without this branch they fell through to the form renderer and
    // showed "No fields have been defined" on the editor link, even though the
    // same tab rendered correctly in the client and admin views.
    if (customTab.columns !== undefined) {
      return <LazyCustomTabSheet customTab={customTab} />;
    }
    return <LazyCustomChecklistForm customTabId={customTab.id} />;
  }

  if (!tabConfig) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Tab not found</p>
      </div>
    );
  }

  // Guard against disabled tabs (render nothing while redirecting)
  if (!isEnabled) {
    return null;
  }

  if (tab === "autoflows") {
    return <LazyAutoflowsSheet isAdmin={userRole === "admin"} />;
  }

  const SheetComponent = sheetComponents[tab];
  if (!SheetComponent) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Coming soon</p>
      </div>
    );
  }

  return <SheetComponent />;
}
