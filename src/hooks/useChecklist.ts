"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChecklistData } from "@/lib/types";

export function useChecklist(slug: string) {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestDataRef = useRef<ChecklistData | null>(null);
  const hasPendingChanges = useRef(false);

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
    try {
      const res = await fetch(`/api/checklists/${updatedData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });
      if (res.status === 409) {
        setSaveStatus("error");
        setSaveError("This checklist was modified elsewhere. Please reload the page.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Save failed");
      }
      const saved = await res.json();
      // Update version from server response for optimistic locking
      setData((prev) => prev ? { ...prev, version: saved.version } : prev);
      if (latestDataRef.current) {
        latestDataRef.current = { ...latestDataRef.current, version: saved.version };
      }
      hasPendingChanges.current = false;
      setSaveStatus("saved");
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
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

  return { data, loading, error, saveStatus, saveError, updateField, retrySave };
}
