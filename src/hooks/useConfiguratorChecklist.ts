"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ConfiguratorChecklistBlob,
  ConfiguratorItemState,
  ConfiguratorStatus,
  ConfiguratorTemplateItem,
} from "@/lib/configurator-template";

export interface ConfiguratorMeta {
  id: string;
  slug: string;
  clientName: string;
  version: number;
  generated: boolean;
  blob: ConfiguratorChecklistBlob | null;
  applicableItems: ConfiguratorTemplateItem[];
  templateItems: ConfiguratorTemplateItem[];
  stale: boolean;
  sourceData: unknown;
}

type SaveStatus = "saved" | "saving" | "error" | "conflict";

interface PendingChange {
  itemId: string;
  status: ConfiguratorStatus | null;
  notes: string | null;
}

function cloneBlob(blob: ConfiguratorChecklistBlob): ConfiguratorChecklistBlob {
  return typeof structuredClone === "function"
    ? structuredClone(blob)
    : JSON.parse(JSON.stringify(blob)) as ConfiguratorChecklistBlob;
}

export function useConfiguratorChecklist(checklistId: string) {
  const [meta, setMeta] = useState<ConfiguratorMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const metaRef = useRef<ConfiguratorMeta | null>(null);
  const pendingRef = useRef<Map<string, PendingChange>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const applyMeta = useCallback((nextMeta: ConfiguratorMeta) => {
    setMeta(nextMeta);
    metaRef.current = nextMeta;
  }, []);

  const fetchMeta = useCallback(async () => {
    const response = await fetch(`/api/checklists/${checklistId}/configurator`);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Failed to load configurator checklist");
    }
    const body = await response.json() as ConfiguratorMeta;
    applyMeta(body);
    return body;
  }, [applyMeta, checklistId]);

  const generate = useCallback(async () => {
    const response = await fetch(`/api/checklists/${checklistId}/configurator`, {
      method: "POST",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Failed to generate configurator checklist");
    }
    const body = await response.json() as ConfiguratorMeta;
    applyMeta(body);
    return body;
  }, [applyMeta, checklistId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const loaded = await fetchMeta();
        if (!cancelled && !loaded.generated) {
          await generate();
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [fetchMeta, generate]);

  const sendChange = useCallback(async (change: PendingChange, retryOnConflict = true): Promise<void> => {
    const current = metaRef.current;
    if (!current?.blob) return;

    const response = await fetch(`/api/checklists/${checklistId}/configurator`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: change.itemId,
        status: change.status,
        notes: change.notes,
        version: current.version,
      }),
    });

    if (response.status === 409) {
      const latest = await fetchMeta();
      if (retryOnConflict && latest.blob) {
        setSaveStatus("conflict");
        return sendChange(change, false);
      }
      setSaveStatus("conflict");
      setSaveError("Someone else updated this checklist — refresh to see changes");
      throw new Error("Conflict");
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Failed to save configurator item");
    }

    const body = await response.json() as { item: ConfiguratorItemState; version: number };
    const latest = metaRef.current;
    if (!latest?.blob) return;

    const nextBlob = cloneBlob(latest.blob);
    const itemIndex = nextBlob.items.findIndex((item) => item.itemId === body.item.itemId);
    if (itemIndex >= 0) {
      nextBlob.items[itemIndex] = body.item;
    }
    applyMeta({ ...latest, version: body.version, blob: nextBlob });
  }, [applyMeta, checklistId, fetchMeta]);

  const flushPendingSaves = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (inFlightRef.current) {
      await inFlightRef.current;
    }

    const changes = Array.from(pendingRef.current.values());
    if (changes.length === 0) return;
    pendingRef.current.clear();

    setSaveStatus("saving");
    setSaveError(null);
    const savePromise = (async () => {
      for (const change of changes) {
        await sendChange(change);
      }
    })();

    inFlightRef.current = savePromise;
    try {
      await savePromise;
      setSaveStatus("saved");
    } catch (err) {
      const isConflict = err instanceof Error && err.message === "Conflict";
      setSaveStatus(isConflict ? "conflict" : "error");
      setSaveError(isConflict ? "Someone else updated this checklist — refresh to see changes" : err instanceof Error ? err.message : "Failed to save");
      throw err;
    } finally {
      inFlightRef.current = null;
    }
  }, [sendChange]);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flushPendingSaves().catch(() => undefined);
    }, 500);
  }, [flushPendingSaves]);

  const updateItem = useCallback((
    itemId: string,
    patch: { status?: ConfiguratorStatus | null; notes?: string | null }
  ) => {
    setMeta((current) => {
      if (!current?.blob) return current;

      const nextBlob = cloneBlob(current.blob);
      const itemIndex = nextBlob.items.findIndex((item) => item.itemId === itemId);
      if (itemIndex === -1) return current;

      const existing = nextBlob.items[itemIndex];
      const nextItem = {
        ...existing,
        status: patch.status !== undefined ? patch.status : existing.status,
        notes: patch.notes !== undefined ? patch.notes : existing.notes,
      };
      nextBlob.items[itemIndex] = nextItem;

      pendingRef.current.set(itemId, {
        itemId,
        status: nextItem.status,
        notes: nextItem.notes,
      });
      setSaveStatus("saving");
      setSaveError(null);
      scheduleFlush();

      const nextMeta = { ...current, blob: nextBlob };
      metaRef.current = nextMeta;
      return nextMeta;
    });
  }, [scheduleFlush]);

  const refreshFromSettings = useCallback(async () => {
    await flushPendingSaves();
    const response = await fetch(`/api/checklists/${checklistId}/configurator/refresh`, {
      method: "POST",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Failed to refresh configurator checklist");
    }
    const body = await response.json() as ConfiguratorMeta;
    applyMeta(body);
    return body;
  }, [applyMeta, checklistId, flushPendingSaves]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingRef.current.size > 0) {
        flushPendingSaves().catch(() => undefined);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [flushPendingSaves]);

  return {
    meta,
    loading,
    error,
    saveStatus,
    saveError,
    updateItem,
    refreshFromSettings,
    flushPendingSaves,
    refetch: fetchMeta,
  };
}
