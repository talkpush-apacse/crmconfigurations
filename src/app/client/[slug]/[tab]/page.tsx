"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  getTabBySlug,
  getEnabledTabs,
  getCustomTabBySlug,
  excludeTalkpushTabs,
} from "@/lib/tab-config";
import { useChecklistContext } from "@/lib/checklist-context";
import { getCustomTabMode } from "@/lib/custom-tab-service";
import { sheetComponents, LazyCustomChecklistForm, LazyCustomTabSheet } from "@/components/sheets/lazy-sheets";

export default function TabPage() {
  const params = useParams();
  const router = useRouter();
  const tab = params.tab as string;
  const slug = params.slug as string;
  const { data } = useChecklistContext();

  const isCustom = !!data?.isCustom;
  const tabConfig = isCustom ? null : getTabBySlug(tab);
  const customTab = isCustom ? null : getCustomTabBySlug(tab, data?.customTabs);

  // Mirrors the sidebar: Talkpush-filled tabs aren't reachable from the client
  // route, so a bookmarked or hand-typed URL redirects rather than rendering a
  // tab the client isn't meant to see.
  const enabledTabs = isCustom
    ? []
    : excludeTalkpushTabs(
        getEnabledTabs(
          data?.enabledTabs ?? null,
          false,
          data?.tabOrder ?? null,
          data?.customTabs,
          (data?.tabFilledBy as Record<string, "talkpush" | "client"> | null) ?? null,
        ),
      );
  const isEnabled = isCustom || enabledTabs.some((t) => t.slug === tab);

  // Auto-redirect to first enabled tab if current tab is disabled
  useEffect(() => {
    if (!isCustom && !customTab && tabConfig && !isEnabled && enabledTabs.length > 0) {
      router.replace(`/client/${slug}/${enabledTabs[0].slug}`);
    }
  }, [isCustom, customTab, tabConfig, isEnabled, enabledTabs, slug, router]);

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

  if (isCustom) {
    return <LazyCustomChecklistForm />;
  }

  // Custom tab on a standard checklist
  if (customTab) {
    // Table-based tabs (created via MCP) have columns defined
    if (getCustomTabMode(customTab) === "table") {
      return <LazyCustomTabSheet customTab={customTab} />;
    }
    // Form-based tabs (created via admin UI) use the legacy renderer
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
