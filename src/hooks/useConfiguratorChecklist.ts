"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ConfiguratorChecklistBlob, ConfiguratorItemState, ConfiguratorStatus, ConfiguratorTemplateItem } from '@/lib/configurator-template';

export type SaveStatus = 'saved' | 'saving' | 'error' | 'conflict';

interface PendingUpdate {
  itemId: string;
  status: ConfiguratorStatus | null;
  notes: string | null;
}

interface ConfiguratorResponse {
  blob: ConfiguratorChecklistBlob | null;
  applicableItems: ConfiguratorTemplateItem[];
  isStale: boolean;
  version: number;
}

export function useConfiguratorChecklist(checklistId: string, initialVersion: number) {
  const [blob, setBlob] = useState<ConfiguratorChecklistBlob | null>(null);
  const [applicableItems, setApplicableItems] = useState<ConfiguratorTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const versionRef = useRef<number>(initialVersion);
  const blobRef = useRef<ConfiguratorChecklistBlob | null>(null);
  const pendingRef = useRef<PendingUpdate | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  const applyResponse = useCallback((data: ConfiguratorResponse) => {
    setBlob(data.blob);
    blobRef.current = data.blob;
    setApplicableItems(data.applicableItems ?? []);
    setIsStale(data.isStale ?? false);
    versionRef.current = data.version ?? versionRef.current;
  }, []);

  const fetchBlob = useCallback(async (): Promise<ConfiguratorResponse> => {
    const res = await fetch(`/api/checklists/${checklistId}/configurator`);
    if (!res.ok) throw new Error('Failed to load configurator');
    return res.json();
  }, [checklistId]);

  const generateBlob = useCallback(async (): Promise<ConfiguratorResponse> => {
    const res = await fetch(`/api/checklists/${checklistId}/configurator`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to generate configurator');
    return res.json();
  }, [checklistId]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        setLoading(true);
        let data = await fetchBlob();
        if (!data.blob) {
          data = await generateBlob();
        }
        if (!cancelled) applyResponse(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [checklistId, fetchBlob, generateBlob, applyResponse]);

  const doSave = useCallback(async (update: PendingUpdate, isRetry = false): Promise<void> => {
    isSavingRef.current = true;
    setSaveStatus('saving');

    try {
      const res = await fetch(`/api/checklists/${checklistId}/configurator`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...update, version: versionRef.current }),
      });

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        if (!isRetry && body.blob) {
          // Rebase: apply our pending change on top of the server's current state
          versionRef.current = body.currentVersion;
          const serverBlob = body.blob as ConfiguratorChecklistBlob;
          const rebasedItems = serverBlob.items.map((item: ConfiguratorItemState) =>
            item.itemId === update.itemId
              ? { ...item, status: update.status, notes: update.notes, updatedAt: new Date().toISOString() }
              : item
          );
          const rebasedBlob = { ...serverBlob, items: rebasedItems };
          setBlob(rebasedBlob);
          blobRef.current = rebasedBlob;
          isSavingRef.current = false;
          await doSave(update, true);
        } else {
          // Second 409 — surface error
          setSaveStatus('conflict');
          setSaveError('Someone else updated this checklist — refresh to see changes');
          isSavingRef.current = false;
        }
        return;
      }

      if (!res.ok) {
        setSaveStatus('error');
        setSaveError('Save failed — please try again');
        isSavingRef.current = false;
        return;
      }

      const saved = await res.json();
      versionRef.current = saved.version;

      // Update the blob with the server-confirmed item state
      setBlob(prev => {
        if (!prev) return prev;
        const items = prev.items.map(item =>
          item.itemId === update.itemId ? { ...item, ...saved.item } : item
        );
        const next = { ...prev, items };
        blobRef.current = next;
        return next;
      });

      setSaveStatus('saved');
      setSaveError(null);
      pendingRef.current = null;
    } catch {
      setSaveStatus('error');
      setSaveError('Save failed — check your connection');
    } finally {
      isSavingRef.current = false;
    }
  }, [checklistId]);

  const updateItem = useCallback((
    itemId: string,
    patch: { status?: ConfiguratorStatus | null; notes?: string | null }
  ) => {
    // Optimistic update
    setBlob(prev => {
      if (!prev) return prev;
      const items = prev.items.map(item =>
        item.itemId === itemId
          ? { ...item, ...patch, updatedAt: new Date().toISOString() }
          : item
      );
      const next = { ...prev, items };
      blobRef.current = next;
      return next;
    });

    // Build pending update with latest state
    const currentItem = blobRef.current?.items.find(i => i.itemId === itemId);
    const pending: PendingUpdate = {
      itemId,
      status: patch.status !== undefined ? patch.status : (currentItem?.status ?? null),
      notes: patch.notes !== undefined ? patch.notes : (currentItem?.notes ?? null),
    };
    pendingRef.current = pending;

    // Debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (pendingRef.current) doSave(pendingRef.current);
    }, 500);
  }, [doSave]);

  const flushPendingSaves = useCallback(async (): Promise<void> => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (pendingRef.current) {
      await doSave(pendingRef.current);
    }
  }, [doSave]);

  const refresh = useCallback(async (): Promise<void> => {
    const res = await fetch(`/api/checklists/${checklistId}/configurator/refresh`, { method: 'POST' });
    if (!res.ok) throw new Error('Refresh failed');
    const data: ConfiguratorResponse = await res.json();
    applyResponse(data);
  }, [checklistId, applyResponse]);

  // Attempt flush on page unload (best-effort)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingRef.current || saveStatus === 'saving') {
        flushPendingSaves();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus, flushPendingSaves]);

  return {
    blob,
    applicableItems,
    loading,
    error,
    saveStatus,
    saveError,
    isStale,
    updateItem,
    flushPendingSaves,
    refresh,
  };
}
