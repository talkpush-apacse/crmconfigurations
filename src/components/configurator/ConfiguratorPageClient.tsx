"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ConfiguratorFilterBar, type ConfiguratorFilter } from "@/components/configurator/ConfiguratorFilterBar";
import { ConfiguratorHeader } from "@/components/configurator/ConfiguratorHeader";
import { ConfiguratorItemCard } from "@/components/configurator/ConfiguratorItemCard";
import { ConfiguratorSummaryTable } from "@/components/configurator/ConfiguratorSummaryTable";
import { useConfiguratorChecklist } from "@/hooks/useConfiguratorChecklist";

interface ConfiguratorPageClientProps {
  checklistId: string;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ConfiguratorPageClient({ checklistId }: ConfiguratorPageClientProps) {
  const {
    meta,
    loading,
    error,
    saveStatus,
    saveError,
    updateItem,
    refreshFromSettings,
    flushPendingSaves,
  } = useConfiguratorChecklist(checklistId);
  const [filter, setFilter] = useState<ConfiguratorFilter>("all");
  const [beforeOpen, setBeforeOpen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const activeItems = useMemo(() => {
    if (!meta?.blob) return [];
    const stateMap = new Map(meta.blob.items.map((state) => [state.itemId, state]));
    const templateMap = new Map(meta.templateItems.map((item) => [item.id, item]));

    return meta.blob.snapshotItemIds
      .map((itemId) => {
        const state = stateMap.get(itemId);
        const item = templateMap.get(itemId);
        if (!state || !item || state.archived) return null;
        return { item, state };
      })
      .filter((entry): entry is NonNullable<typeof entry> => {
        if (!entry) return false;
        if (filter === "all") return true;
        return entry.state.status === filter;
      });
  }, [filter, meta?.blob, meta?.templateItems]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, typeof activeItems>();
    for (const entry of activeItems) {
      groups.set(entry.item.section, [...(groups.get(entry.item.section) ?? []), entry]);
    }
    return Array.from(groups.entries());
  }, [activeItems]);

  const handleRefresh = async () => {
    setRefreshError(null);
    try {
      await refreshFromSettings();
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : "Failed to refresh");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await flushPendingSaves();
      window.open(`/api/checklists/${checklistId}/configurator/export`, "_blank");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading configurator checklist...
        </div>
      </div>
    );
  }

  if (error || !meta?.blob) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md rounded-lg">
          <CardContent className="p-6 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-600" />
            <p className="font-semibold text-slate-950">Configurator checklist unavailable</p>
            <p className="mt-2 text-sm text-slate-600">{error || "The checklist could not be loaded."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <ConfiguratorHeader
          clientName={meta.clientName}
          blob={meta.blob}
          stale={meta.stale}
          onRefresh={handleRefresh}
        />

        {(saveStatus === "error" || saveStatus === "conflict" || saveError || refreshError) && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {saveError || refreshError || "Changes could not be saved."}
          </div>
        )}

        <Collapsible open={beforeOpen} onOpenChange={setBeforeOpen}>
          <Card className="rounded-lg">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="font-semibold text-slate-950">Before You Begin</span>
                {beforeOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="border-t px-5 py-4 text-sm leading-6 text-slate-600">
                This checklist was generated from {meta.clientName}&apos;s configuration requirements at{" "}
                {formatDateTime(meta.blob.generatedAt)}. Each step is a Talkpush admin action.
                Settings changes don&apos;t affect this checklist until you click &quot;Refresh from settings&quot;.
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <ConfiguratorSummaryTable
          sourceData={meta.sourceData}
          onExport={handleExport}
          exporting={exporting}
        />

        <ConfiguratorFilterBar
          value={filter}
          onChange={setFilter}
          onExport={handleExport}
          exporting={exporting}
        />

        {groupedItems.length === 0 ? (
          <Card className="rounded-lg">
            <CardContent className="p-10 text-center text-sm text-slate-600">
              No checklist items match this filter.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {groupedItems.map(([section, entries]) => (
              <section key={section} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-950">{section}</h2>
                  <span className="text-sm text-slate-500 tabular-nums">{entries.length} items</span>
                </div>
                <div className="space-y-3">
                  {entries.map((entry) => {
                    const step = meta.blob!.snapshotItemIds.indexOf(entry.item.id) + 1;
                    return (
                      <ConfiguratorItemCard
                        key={entry.item.id}
                        step={step}
                        item={entry.item}
                        state={entry.state}
                        sourceData={meta.sourceData}
                        onUpdate={updateItem}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
