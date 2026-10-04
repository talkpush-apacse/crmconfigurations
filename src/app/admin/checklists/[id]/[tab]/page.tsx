"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { getTabBySlug, getEnabledTabs, getCustomTabBySlug } from "@/lib/tab-config";
import { useChecklistContext } from "@/lib/checklist-context";
import { getCustomTabMode } from "@/lib/custom-tab-service";
import { sheetComponents, LazyCustomChecklistForm, LazyCustomTabSheet } from "@/components/sheets/lazy-sheets";

export default function AdminChecklistTabPage() {
  const params = useParams();
  const router = useRouter();
  const tab = params.tab as string;
  const id = params.id as string;
  const { data } = useChecklistContext();

  const isCustom = !!data?.isCustom;
  const tabConfig = isCustom ? null : getTabBySlug(tab);
  const customTab = isCustom ? null : getCustomTabBySlug(tab, data?.customTabs);
  const enabledTabs = useMemo(
    () =>
      isCustom
        ? []
        : getEnabledTabs(data?.enabledTabs ?? null, true, data?.tabOrder ?? null, data?.customTabs),
    [isCustom, data?.enabledTabs, data?.tabOrder, data?.customTabs]
  );
  const isEnabled = isCustom || enabledTabs.some((t) => t.slug === tab);

  useEffect(() => {
    if (!isCustom && !customTab && tabConfig && !isEnabled && enabledTabs.length > 0) {
      router.replace(`/admin/checklists/${id}/${enabledTabs[0].slug}`);
    }
  }, [isCustom, customTab, tabConfig, isEnabled, enabledTabs, id, router]);

  useEffect(() => {
    if (isCustom && data?.clientName) {
      document.title = `Custom Checklist - ${data.clientName} | Talkpush Implementation Hub`;
    } else if (customTab && data?.clientName) {
      document.title = `${customTab.label} - ${data.clientName} | Talkpush Implementation Hub`;
    } else if (tabConfig && data?.clientName) {
      document.title = `${tabConfig.label} - ${data.clientName} | Talkpush Implementation Hub`;
    }
  }, [isCustom, tab, tabConfig, customTab, data?.clientName]);

  if (isCustom) {
    return <LazyCustomChecklistForm />;
  }

  if (customTab) {
    if (getCustomTabMode(customTab) === "table") {
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

  if (!isEnabled) {
    return null;
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
