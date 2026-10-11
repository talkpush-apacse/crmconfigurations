"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useChecklist } from "@/hooks/useChecklist";
import { TopNav } from "@/components/layout/TopNav";
import { TabActivityBanner } from "@/components/layout/TabActivityBanner";
import { Header } from "@/components/layout/Header";
import { SectionSelect } from "@/components/layout/SectionSelect";
import { ChecklistLookProvider, useChecklistLookState } from "@/components/layout/ChecklistLook";
import { figtree } from "@/lib/client-form-font";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ApplyRequirementsTemplateSheet } from "@/components/admin/ApplyRequirementsTemplateSheet";
import { EditLinksDialog } from "@/components/admin/EditLinksDialog";
import { ShareDialog, type ShareTab } from "@/components/layout/ShareDialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/tracker/ConfirmDialog";
import { useCurrentUser } from "@/lib/use-current-user";
import { ChecklistContext } from "@/lib/checklist-context";
import { getEnabledTabs } from "@/lib/tab-config";
import { getSectionState, getCustomTabSectionState } from "@/lib/section-status";
import type { ChecklistData, CustomTab, CustomData, TabUploadMetaMap } from "@/lib/types";
import type { NavItem } from "@/components/layout/TopNav";

export default function AdminChecklistLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const id = params.id as string;
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  // "Share this page": the tab on screen when Share was pressed, so both links open that tab.
  const [shareTab, setShareTab] = useState<{ tab: ShareTab | null } | null>(null);
  const [editLinksOpen, setEditLinksOpen] = useState(false);
  // Archive: `undefined` = use what the server sent; set once staff archive or restore from this page.
  const { canEdit } = useCurrentUser();
  const [archivedOverride, setArchivedOverride] = useState<string | null | undefined>(undefined);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
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

  const archivedAt = archivedOverride !== undefined ? archivedOverride : ((data as { archivedAt?: string | null }).archivedAt ?? null);
  const isArchived = !!archivedAt;

  // Archiving never touches the checklist's content or version, so it can't clash with an unsaved edit.
  const setArchived = async (archived: boolean) => {
    setArchiveError(null);
    try {
      const res = await fetch(`/api/checklists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const body = (await res.json().catch(() => ({}))) as { archivedAt?: string | null; error?: string };
      if (!res.ok) throw new Error(body.error || "Couldn't change the archive status. Please try again.");
      setArchivedOverride(body.archivedAt ?? null);
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : "Couldn't change the archive status. Please try again.");
    }
  };

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
          onToggleArchive={canEdit ? () => (isArchived ? void setArchived(false) : setConfirmArchive(true)) : undefined}
          archived={isArchived}
          onShare={(tab) => setShareTab({ tab })}
        />
        {(isArchived || archiveError) && (
          <div
            role={archiveError ? "alert" : "status"}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-secondary px-4 py-2.5 text-[13px] text-foreground sm:px-6 lg:px-8"
          >
            <span className={archiveError ? "text-destructive" : undefined}>
              {archiveError ?? "This checklist is archived. It is hidden from your lists and sends no reminder emails. The client's links still work."}
            </span>
            {canEdit && isArchived && (
              <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-0" onClick={() => void setArchived(false)}>
                Restore checklist
              </Button>
            )}
          </div>
        )}
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
              <div className="px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
                <TabActivityBanner activityUrl={`/api/checklists/${id}/activity`} />
                {children}
              </div>
            </main>
          </div>
        </div>
        </div>
        </ChecklistLookProvider>
        <ShareDialog
          open={shareTab !== null}
          onOpenChange={(open) => !open && setShareTab(null)}
          checklistId={id}
          clientName={data.clientName}
          editorToken={data.editorToken}
          tab={shareTab?.tab ?? null}
          onOpenNamedLinks={() => setEditLinksOpen(true)}
        />
        <ConfirmDialog
          open={confirmArchive}
          onOpenChange={setConfirmArchive}
          title={`Archive “${data.clientName}”?`}
          description="It moves out of your lists and its reminder emails stop. Nothing is deleted, the client's links keep working, and you can restore it any time from “Show archived”."
          confirmLabel="Archive checklist"
          onConfirm={() => setArchived(true)}
        />
        <EditLinksDialog
          checklistId={id}
          clientName={data.clientName}
          open={editLinksOpen}
          onOpenChange={setEditLinksOpen}
        />
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
