"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChecklistData } from "@/lib/types";
import { FIELD_LABELS, type ChecklistJsonField } from "@/lib/types";

export function useChecklist(slug: string) {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestDataRef = useRef<ChecklistData | null>(null);
  const hasPendingChanges = useRef(false);
  const dirtyFieldsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/checklists?slug=${slug}`);
        if (!res.ok) throw new Error("Checklist not found");
        const json = await res.json();
        setData(json);
        latestDataRef.current = json;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [slug]);

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
        // Re-snapshot dirty fields on retry (user may have edited more fields during backoff)
        const currentDirtyFields = attempt === 0 ? fieldsToSave : Array.from(dirtyFieldsRef.current);

        const res = await fetch(`/api/checklists/by-slug/${slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...dataToSave,
            changedFields: currentDirtyFields,
          }),
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
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          lastError = new Error(body.error || "Save failed");
          continue; // retry
        }
        const saved = await res.json();
        // Update version from server response for optimistic locking
        setData((prev) => prev ? { ...prev, version: saved.version } : prev);
        if (latestDataRef.current) {
          latestDataRef.current = { ...latestDataRef.current, version: saved.version };
        }
        // Clear dirty fields only on success
        dirtyFieldsRef.current.clear();
        hasPendingChanges.current = false;
        setSaveStatus("saved");
        return; // success
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Save failed");
        // Network error — will retry
      }
    }

    // All attempts exhausted
    setSaveStatus("error");
    setSaveError(lastError?.message ?? "Save failed");
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
        hasPendingChanges.current = true;
        dirtyFieldsRef.current.add(field as string);

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          if (latestDataRef.current) save(latestDataRef.current);
        }, 2000);

        return updated;
      });
    },
    [save]
  );

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges.current || saveTimeoutRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return { data, loading, error, saveStatus, saveError, updateField, retrySave, hasPendingChangesRef: hasPendingChanges };
}
