"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Download, ChevronLeft, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { ConfiguratorHeader } from '@/components/configurator/ConfiguratorHeader';
import { ConfiguratorFilterBar, type FilterValue } from '@/components/configurator/ConfiguratorFilterBar';
import { ConfiguratorItemCard } from '@/components/configurator/ConfiguratorItemCard';
import { ConfiguratorRefreshButton } from '@/components/configurator/ConfiguratorRefreshButton';
import { useConfiguratorChecklist } from '@/hooks/useConfiguratorChecklist';
import type { ChecklistData } from '@/lib/types';

interface ChecklistMeta {
  id: string;
  clientName: string;
  version: number;
  // Full data for context field resolution
  [key: string]: unknown;
}

export default function ConfiguratorPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [checklist, setChecklist] = useState<ChecklistMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all');
  const [beforeYouBeginOpen, setBeforeYouBeginOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Fetch checklist by slug
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/checklists?slug=${slug}`);
        if (res.status === 401) { router.push('/admin/login'); return; }
        if (!res.ok) throw new Error('Checklist not found');
        const data: ChecklistData = await res.json();
        setChecklist(data as unknown as ChecklistMeta);
      } catch (err) {
        setMetaError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setMetaLoading(false);
      }
    }
    load();
  }, [slug, router]);

  const {
    blob,
    applicableItems,
    loading: blobLoading,
    error: blobError,
    saveStatus,
    saveError,
    isStale,
    updateItem,
    flushPendingSaves,
    refresh,
  } = useConfiguratorChecklist(checklist?.id ?? '', checklist?.version ?? 0);

  const loading = metaLoading || (!!checklist && blobLoading);
  const error = metaError || blobError;

  // Compute progress from snapshot
  const { completedCount, totalCount } = useMemo(() => {
    if (!blob) return { completedCount: 0, totalCount: 0 };
    const snapshotSet = new Set(blob.snapshotItemIds);
    const total = blob.snapshotItemIds.length;
    const completed = blob.items.filter(
      s => snapshotSet.has(s.itemId) && !s.archived && s.status === 'completed'
    ).length;
    return { completedCount: completed, totalCount: total };
  }, [blob]);

  // Build template map for rendering
  const templateMap = useMemo(
    () => new Map(applicableItems.map(t => [t.id, t])),
    [applicableItems]
  );

  // Active (non-archived) items in snapshot order
  const activeStates = useMemo(() => {
    if (!blob) return [];
    const stateMap = new Map(blob.items.map(s => [s.itemId, s]));
    return blob.snapshotItemIds
      .map(id => stateMap.get(id))
      .filter(s => s && !s.archived) as typeof blob.items;
  }, [blob]);

  // Filtered items
  const filteredStates = useMemo(() => {
    if (activeFilter === 'all') return activeStates;
    return activeStates.filter(s =>
      activeFilter === 'blocked'
        ? s.status === 'blocked'
        : s.status === activeFilter
    );
  }, [activeStates, activeFilter]);

  // Group by section
  const sections = useMemo(() => {
    const grouped = new Map<string, typeof filteredStates>();
    for (const state of filteredStates) {
      const tmpl = templateMap.get(state.itemId);
      if (!tmpl) continue;
      if (!grouped.has(tmpl.section)) grouped.set(tmpl.section, []);
      grouped.get(tmpl.section)!.push(state);
    }
    return grouped;
  }, [filteredStates, templateMap]);

  // Step number is based on position in the full active list (not filtered)
  const stepNumbers = useMemo(() => {
    const map = new Map<string, number>();
    activeStates.forEach((s, idx) => map.set(s.itemId, idx + 1));
    return map;
  }, [activeStates]);

  async function handleExport() {
    if (!checklist) return;
    setExportLoading(true);
    await flushPendingSaves();
    try {
      const res = await fetch(`/api/checklists/${checklist.id}/configurator/export`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('Content-Disposition') ?? '';
      const fnMatch = cd.match(/filename="([^"]+)"/);
      a.download = fnMatch?.[1] ?? 'configurator-checklist.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — user can retry
    } finally {
      setExportLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <AdminHeader />
        <div className="flex flex-1 overflow-hidden">
          <AdminSidebar />
          <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
            <div className="mx-auto max-w-3xl space-y-4">
              <div className="h-48 animate-pulse rounded-xl bg-white" />
              {[1, 2, 3].map(i => <div key={i} className="h-32 animate-pulse rounded-lg bg-white" />)}
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !checklist) {
    return (
      <div className="flex min-h-screen flex-col">
        <AdminHeader />
        <div className="flex flex-1 overflow-hidden">
          <AdminSidebar />
          <main className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <p className="font-medium text-gray-700">{error ?? 'Checklist not found'}</p>
              <Link href="/admin">
                <Button variant="outline" className="mt-4">Back to admin</Button>
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AdminHeader />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="mx-auto max-w-3xl p-6">

            {/* Back link */}
            <Link
              href="/admin"
              className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to all checklists
            </Link>

            {/* Header card */}
            {blob && (
              <ConfiguratorHeader
                clientName={checklist.clientName}
                completedCount={completedCount}
                totalCount={totalCount}
                generatedAt={blob.generatedAt}
                isStale={isStale}
                onRefresh={refresh}
              />
            )}

            {/* Before You Begin */}
            {blob && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => setBeforeYouBeginOpen(o => !o)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <span className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-gray-400" />
                    Before You Begin
                  </span>
                  <span className="text-gray-400">{beforeYouBeginOpen ? '▲' : '▼'}</span>
                </button>
                {beforeYouBeginOpen && (
                  <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
                    This checklist was generated from <strong>{checklist.clientName}</strong>&apos;s
                    configuration requirements at{' '}
                    {new Date(blob.generatedAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    . Each step is a Talkpush admin action. Settings changes don&apos;t affect this
                    checklist until you click &ldquo;Refresh from settings&rdquo;.
                  </div>
                )}
              </div>
            )}

            {/* Save status bar */}
            {(saveStatus === 'error' || saveStatus === 'conflict') && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveError}
              </div>
            )}

            {/* Toolbar */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <ConfiguratorFilterBar active={activeFilter} onChange={setActiveFilter} />
              <div className="flex items-center gap-2 shrink-0">
                {!isStale && blob && (
                  <ConfiguratorRefreshButton onRefresh={refresh} />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={exportLoading || !blob}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {exportLoading ? 'Exporting…' : 'Export to Excel'}
                </Button>
              </div>
            </div>

            {/* Items grouped by section */}
            {sections.size === 0 && (
              <div className="mt-8 py-12 text-center">
                <p className="text-sm text-gray-500">
                  {activeFilter === 'all'
                    ? 'No items to show. Try refreshing from settings.'
                    : `No items with status "${activeFilter.replace(/_/g, ' ')}".`}
                </p>
                {activeFilter !== 'all' && (
                  <button
                    type="button"
                    className="mt-2 text-sm text-teal-600 underline-offset-2 hover:underline"
                    onClick={() => setActiveFilter('all')}
                  >
                    Clear filter
                  </button>
                )}
              </div>
            )}

            {Array.from(sections.entries()).map(([section, states]) => (
              <div key={section} className="mt-6">
                <h2 className="mb-3 text-base font-semibold text-gray-900">{section}</h2>
                <div className="space-y-3">
                  {states.map(state => {
                    const tmpl = templateMap.get(state.itemId);
                    if (!tmpl) return null;
                    return (
                      <ConfiguratorItemCard
                        key={state.itemId}
                        step={stepNumbers.get(state.itemId) ?? 0}
                        template={tmpl}
                        state={state}
                        checklistData={checklist as unknown as Record<string, unknown>}
                        onUpdate={updateItem}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Bottom padding */}
            <div className="h-16" />
          </div>
        </main>
      </div>
    </div>
  );
}
