"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChecklistData } from "@/lib/types";
import { FIELD_LABELS, type ChecklistJsonField } from "@/lib/types";

function cloneChecklistData(data: ChecklistData): ChecklistData {
  return typeof structuredClone === "function"
    ? structuredClone(data)
    : JSON.parse(JSON.stringify(data)) as ChecklistData;
}

/**
 * What to send on a save. The public client and editor links only need the fields that changed plus the version
 * (the server merges field by field), so a tab edit no longer re-uploads the whole checklist. Staff admin saves and
 * saves with nothing marked dirty keep sending the whole document, as before.
 */
function buildSaveBody(data: ChecklistData, changedFields: string[], mode: "slug" | "token" | "id") {
  if (mode === "id" || changedFields.length === 0) {
    return { ...data, changedFields };
  }
  const body: Record<string, unknown> = { version: data.version, changedFields };
  for (const field of changedFields) {
    body[field] = data[field as keyof ChecklistData];
  }
  return body;
}

/**
 * `initialData` is the checklist already loaded on the server (the client and editor pages do this), so the page
 * shows straight away with no spinner and no second request. When it is missing (not found, or the server could not
 * load it) the hook fetches in the browser exactly as before, which is also how "not found" gets reported.
 */
export function useChecklist(slugOrToken: string, mode: "slug" | "token" | "id" = "slug", initialData: ChecklistData | null = null) {
  const [data, setData] = useState<ChecklistData | null>(initialData);
  const [loading, setLoading] = useState(initialData === null);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  // When the last successful save landed, so the UI can say how long ago.
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const latestDataRef = useRef<ChecklistData | null>(null);
  const lastSavedDataRef = useRef<ChecklistData | null>(null);
  const hasPendingChangesRef = useRef(false);
  const dirtyFieldsRef = useRef<Set<string>>(new Set());
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialData) {
      // Already have it from the server: just set up the save bookkeeping.
      latestDataRef.current = initialData;
      lastSavedDataRef.current = cloneChecklistData(initialData);
      return;
    }
    async function fetchData() {
      try {
        const url = mode === "token"
          ? `/api/checklists/by-token/${slugOrToken}`
          : mode === "id"
            ? `/api/checklists/${slugOrToken}`
            : `/api/checklists?slug=${slugOrToken}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Checklist not found");
        const json = await res.json();
        setData(json);
        latestDataRef.current = json;
        lastSavedDataRef.current = cloneChecklistData(json);
        dirtyFieldsRef.current.clear();
        hasPendingChangesRef.current = false;
        setHasPendingChanges(false);
        setSaveStatus("saved");
        setSaveError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    // initialData is only the starting value; later changes to it must not re-run the load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugOrToken, mode]);

  const save = useCallback(async (updatedData: ChecklistData) => {
    setSaveStatus("saving");
    setSaveError(null);

    // Snapshot dirty fields at save time — more may accumulate during retries
    const fieldsToSave = Array.from(dirtyFieldsRef.current);

    // Retry up to 3 attempts with exponential backoff (0s, 1s, 2s delays)
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= 2; attempt++) {
      if (attempt > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 1000 * attempt));
      }
      try {
        // Always use the most recent data in case edits occurred during retry delay
        const dataToSave = latestDataRef.current ?? updatedData;
        const requestSnapshot = cloneChecklistData(dataToSave);
        // Re-snapshot dirty fields on retry (user may have edited more fields during backoff)
        const currentDirtyFields = attempt === 0 ? fieldsToSave : Array.from(dirtyFieldsRef.current);

        const saveUrl = mode === "token"
          ? `/api/checklists/by-token/${slugOrToken}`
          : mode === "id"
            ? `/api/checklists/${slugOrToken}`
            : `/api/checklists/by-slug/${slugOrToken}`;
        const res = await fetch(saveUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildSaveBody(dataToSave, currentDirtyFields, mode)),
        });
        if (res.status === 409) {
          // Conflict — parse richer response for field-level info
          const conflictBody = await res.json().catch(() => ({}));
          const conflictedFields = conflictBody.conflictedFields as string[] | undefined;

          let message: string;
          if (conflictedFields && conflictedFields.length > 0) {
            const labels = conflictedFields
              .map((f) => FIELD_LABELS[f as ChecklistJsonField] || f)
              .join(", ");
            message = `Your changes to ${labels} conflict with a recent edit. Please reload the page.`;
          } else {
            message = "This checklist was modified elsewhere. Please reload the page.";
          }

          setSaveStatus("error");
          setSaveError(message);
          hasPendingChangesRef.current = true;
          setHasPendingChanges(true);
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          lastError = new Error(body.error || "Save failed");
          continue; // retry
        }
        const saved = await res.json();
        const latestData = latestDataRef.current;
        const stillDirtyFields = Array.from(dirtyFieldsRef.current).filter((field) => {
          if (!currentDirtyFields.includes(field)) return true;
          if (!latestData) return false;

          return JSON.stringify(latestData[field as keyof ChecklistData]) !== JSON.stringify(
            requestSnapshot[field as keyof ChecklistData]
          );
        });

        const persistedSnapshot = {
          ...requestSnapshot,
          version: saved.version,
          updatedAt: saved.updatedAt ?? requestSnapshot.updatedAt,
        };

        lastSavedDataRef.current = cloneChecklistData(persistedSnapshot);
        setLastSavedAt(Date.now());

        const nextData = latestData
          ? {
              ...latestData,
              version: saved.version,
              updatedAt: saved.updatedAt ?? latestData.updatedAt,
            }
          : persistedSnapshot;

        setData(nextData);
        latestDataRef.current = nextData;

        dirtyFieldsRef.current = new Set(stillDirtyFields);
        hasPendingChangesRef.current = stillDirtyFields.length > 0;
        setHasPendingChanges(stillDirtyFields.length > 0);
        setSaveStatus("saved");
        setSaveError(null);
        return; // success
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Save failed");
        // Network error — will retry
      }
    }

    // All attempts exhausted
    setSaveStatus("error");
    setSaveError(lastError?.message ?? "Save failed");
    hasPendingChangesRef.current = true;
    setHasPendingChanges(true);
  }, [mode, slugOrToken]);

  const publishChanges = useCallback(() => {
    if (latestDataRef.current && dirtyFieldsRef.current.size > 0) {
      save(latestDataRef.current);
    }
  }, [save]);

  const discardChanges = useCallback(() => {
    if (!lastSavedDataRef.current) return;

    const restoredData = cloneChecklistData(lastSavedDataRef.current);
    setData(restoredData);
    latestDataRef.current = restoredData;
    dirtyFieldsRef.current.clear();
    hasPendingChangesRef.current = false;
    setHasPendingChanges(false);
    setSaveStatus("saved");
    setSaveError(null);
  }, []);

  const retrySave = useCallback(() => {
    if (latestDataRef.current) {
      save(latestDataRef.current);
    }
  }, [save]);

  const updateField = useCallback(
    <K extends keyof ChecklistData>(field: K, value: ChecklistData[K]) => {
      setData((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, [field]: value };
        latestDataRef.current = updated;
        hasPendingChangesRef.current = true;
        setHasPendingChanges(true);
        dirtyFieldsRef.current.add(field as string);
        setSaveStatus("saved");
        setSaveError(null);

        return updated;
      });
    },
    []
  );

  useEffect(() => {
    if (!data || dirtyFieldsRef.current.size === 0) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      if (latestDataRef.current && dirtyFieldsRef.current.size > 0) {
        save(latestDataRef.current);
      }
    }, 500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [data, save]);

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChangesRef.current || saveStatus === "saving") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [saveStatus]);

  return {
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
  };
}
