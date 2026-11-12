"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import type { ChecklistData } from "@/lib/types";
import {
  backupKey,
  buildEntry,
  newestSavedAt,
  planRestore,
  readEntries,
  withEntry,
  withoutWriters,
  writeEntries,
  type BackupEntry,
} from "@/lib/unsaved-backup";
import { LINK_OFF_MESSAGE } from "@/lib/edit-history/types";
import { FIELD_LABELS, type ChecklistJsonField } from "@/lib/types";
import { rebaseOntoServer } from "@/lib/save-conflict-merge";
import { cancelAllDrafts, flushAllDrafts, hasPendingDrafts, subscribeDrafts } from "@/lib/draft-commit";

/** Where the full checklist is read from, for the first load and for catching up after a rejected save. */
function loadUrl(mode: "slug" | "token" | "id", slugOrToken: string) {
  return mode === "token"
    ? `/api/checklists/by-token/${slugOrToken}`
    : mode === "id"
      ? `/api/checklists/${slugOrToken}`
      : `/api/checklists?slug=${slugOrToken}`;
}

/** How many times one save may catch up with newer server changes before it gives up and asks for a reload. */
const MAX_CONFLICT_MERGES = 3;

/** How long after an edit the on-device copy of unsaved typing is written (leaving the page writes it at once). */
const BACKUP_WRITE_DELAY_MS = 300;

/** What the page needs to offer unsaved typing from an earlier visit back to the person. */
export interface UnsavedBackupOffer {
  /** When the newest unsaved edit was kept, in ms since 1970. */
  savedAt: number;
  /** Set when the last restore attempt failed, so the banner can say so and let them try again. */
  error: string | null;
  /** True while a restore is running. */
  busy: boolean;
}

function newWriterId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

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
  // Text typed into a cell that has not been handed to the page yet (a few hundred ms at most). It counts as an
  // unsaved change, so the Save button, the Discard button and the leave-page warning all know about it.
  const [draftsPending, setDraftsPending] = useState(false);
  // Saves currently in flight, so the "tab hidden" handler does not start a second one on top of a running save.
  const savesInFlightRef = useRef(0);
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
        const res = await fetch(loadUrl(mode, slugOrToken));
        if (res.status === 410) throw new Error(LINK_OFF_MESSAGE); // a named link staff turned off
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

  useEffect(() => {
    setDraftsPending(hasPendingDrafts());
    return subscribeDrafts(() => setDraftsPending(hasPendingDrafts()));
  }, []);

  // ---- A copy of unsaved typing kept on this device (see lib/unsaved-backup.ts) ----
  // Public client and editor links only. The staff admin page saves the whole document and is not covered.
  const backupEnabled = mode !== "id";
  const storageKey = backupKey(mode, slugOrToken);
  // Names this open page's entry, so two tabs on the same link never delete each other's copy.
  const [writerId] = useState(newWriterId);
  const [storageProblem, setStorageProblem] = useState(false);
  const [offer, setOffer] = useState<UnsavedBackupOffer | null>(null);
  const offeredRef = useRef<BackupEntry[]>([]);
  const offerCheckedRef = useRef(false);
  const wroteBackupRef = useRef(false);

  /** Brings the stored copy in line with what is unsaved right now. Returns false if the browser refused the write. */
  const writeBackupNow = useCallback((): boolean => {
    if (!backupEnabled || typeof window === "undefined") return true;
    const mine = latestDataRef.current;
    const base = lastSavedDataRef.current;
    const entry =
      mine && base
        ? buildEntry({ writerId, now: Date.now(), base, mine, dirtyFields: Array.from(dirtyFieldsRef.current) })
        : null;
    if (!entry && !wroteBackupRef.current) {
      setStorageProblem(false);
      return true; // nothing unsaved and nothing of ours stored: leave storage alone
    }
    let storage: Storage;
    try {
      storage = window.localStorage;
    } catch {
      setStorageProblem(entry !== null);
      return false;
    }
    const existing = readEntries(storage, storageKey, Date.now());
    const next = entry ? withEntry(existing, entry) : withoutWriters(existing, [writerId]);
    const result = writeEntries(storage, storageKey, next);
    if (result.ok) {
      wroteBackupRef.current = entry !== null;
      setStorageProblem(false);
      return true;
    }
    // Full or blocked storage. Saving to the server still works, so only the safety net is missing: say so.
    setStorageProblem(entry !== null);
    return false;
  }, [backupEnabled, storageKey, writerId]);

  /** Hand over typing that is still in a cell right now (state included), then write the copy before the page goes. */
  const flushDraftsNow = useCallback(() => {
    try {
      // flushSync makes the hand-over reach the page's data immediately instead of on the next render, so the copy
      // written below includes the last characters typed.
      flushSync(() => flushAllDrafts());
    } catch {
      flushAllDrafts();
    }
    writeBackupNow();
  }, [writeBackupNow]);

  // Keep the copy current a moment after every change (and remove it once everything is saved).
  useEffect(() => {
    if (!backupEnabled) return;
    const timer = setTimeout(writeBackupNow, BACKUP_WRITE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [data, backupEnabled, writeBackupNow]);

  // First time the checklist is on screen: is there unsaved typing from an earlier visit worth offering back?
  useEffect(() => {
    if (!backupEnabled || !data || offerCheckedRef.current) return;
    offerCheckedRef.current = true;
    let storage: Storage;
    try {
      storage = window.localStorage;
    } catch {
      return;
    }
    const now = Date.now();
    const entries = readEntries(storage, storageKey, now).filter((e) => e.writerId !== writerId);
    if (entries.length === 0) return;
    if (planRestore(entries, data).fields.length === 0) {
      // Everything in these copies is already saved (or was overtaken by newer saved answers): tidy up quietly.
      writeEntries(storage, storageKey, withoutWriters(readEntries(storage, storageKey, now), entries.map((e) => e.writerId)));
      return;
    }
    offeredRef.current = entries;
    setOffer({ savedAt: newestSavedAt(entries), error: null, busy: false });
  }, [data, backupEnabled, storageKey, writerId]);

  const forgetOffered = useCallback(() => {
    const ids = offeredRef.current.map((e) => e.writerId);
    offeredRef.current = [];
    try {
      const storage = window.localStorage;
      writeEntries(storage, storageKey, withoutWriters(readEntries(storage, storageKey, Date.now()), ids));
    } catch {
      // Could not tidy up: the copy would simply be offered again next visit.
    }
  }, [storageKey]);

  const discardUnsaved = useCallback(() => {
    forgetOffered();
    setOffer(null);
  }, [forgetOffered]);

  const restoreUnsaved = useCallback(async () => {
    const entries = offeredRef.current;
    if (entries.length === 0) {
      setOffer(null);
      return;
    }
    const fail = (message: string) => setOffer((o) => (o ? { ...o, busy: false, error: message } : o));

    // Typing or a save in progress would have to be merged with the old copy. Waiting a second is simpler and safer.
    if (hasPendingDrafts() || dirtyFieldsRef.current.size > 0) {
      fail("Your latest changes are still saving. Try again in a moment.");
      return;
    }
    setOffer((o) => (o ? { ...o, busy: true, error: null } : o));
    try {
      const res = await fetch(loadUrl(mode, slugOrToken));
      if (res.status === 410) {
        fail(LINK_OFF_MESSAGE);
        return;
      }
      if (!res.ok) {
        fail("Could not load the latest checklist. Check your connection and try again.");
        return;
      }
      const fresh = (await res.json()) as ChecklistData;

      // Typing that started while the request was out is newer than the old copy: do not mix the two.
      if (hasPendingDrafts() || dirtyFieldsRef.current.size > 0) {
        fail("Your latest changes are still saving. Try again in a moment.");
        return;
      }

      const plan = planRestore(entries, fresh);
      if (plan.fields.length > 0) {
        const next = { ...fresh, ...plan.changes } as ChecklistData;
        lastSavedDataRef.current = cloneChecklistData(fresh);
        latestDataRef.current = next;
        dirtyFieldsRef.current = new Set(plan.fields);
        hasPendingChangesRef.current = true;
        setHasPendingChanges(true);
        setData(next); // the normal autosave sends it from here
        // Keep this page's own copy first; only then let go of the old ones, so a crash right now loses nothing.
        if (!writeBackupNow()) {
          setOffer(null);
          offeredRef.current = [];
          return;
        }
      }
      forgetOffered();
      setOffer(null);
    } catch {
      fail("Could not restore. Check your connection and try again.");
    }
  }, [forgetOffered, mode, slugOrToken, writeBackupNow]);

  const saveOnce = useCallback(async (updatedData: ChecklistData) => {
    setSaveStatus("saving");
    setSaveError(null);

    // Snapshot dirty fields at save time — more may accumulate during retries
    const fieldsToSave = Array.from(dirtyFieldsRef.current);

    /**
     * Someone else saved the same part of the checklist since this page loaded, so the server refused. Instead of
     * telling the person to reload (which throws their typing away), fetch the latest copy and replay their unsaved
     * edits on top of it. "retry" means the page now holds the merged copy and the save should be sent again.
     */
    async function catchUpWithServer(conflictedFields: string[]): Promise<"retry" | "link_off" | "failed"> {
      try {
        const res = await fetch(loadUrl(mode, slugOrToken));
        if (res.status === 410) return "link_off";
        if (!res.ok) return "failed";
        const theirs = (await res.json()) as ChecklistData;

        // Read the screen state only now, after the wait, so anything typed in the meantime is included.
        const mine = latestDataRef.current;
        const base = lastSavedDataRef.current;
        if (!mine || !base) return "failed";

        const rebased = rebaseOntoServer({
          base,
          mine,
          theirs,
          dirtyFields: Array.from(dirtyFieldsRef.current),
          conflictedFields,
        });
        if (!rebased.ok) return "failed";

        lastSavedDataRef.current = cloneChecklistData(theirs);
        latestDataRef.current = rebased.next;
        setData(rebased.next);
        return "retry";
      } catch {
        return "failed";
      }
    }

    // Retry up to 3 attempts with exponential backoff (0s, 1s, 2s delays)
    let lastError: Error | null = null;
    let conflictMerges = 0;
    let skipDelay = false;
    for (let attempt = 0; attempt <= 2; attempt++) {
      if (attempt > 0 && !skipDelay) {
        await new Promise<void>((resolve) => setTimeout(resolve, 1000 * attempt));
      }
      skipDelay = false;
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

          if (conflictedFields && conflictedFields.length > 0 && conflictMerges < MAX_CONFLICT_MERGES) {
            conflictMerges += 1;
            const outcome = await catchUpWithServer(conflictedFields);
            if (outcome === "retry") {
              attempt -= 1; // catching up is not a failed attempt, and needs no waiting
              skipDelay = true;
              continue;
            }
            if (outcome === "link_off") {
              setSaveStatus("error");
              setSaveError(LINK_OFF_MESSAGE);
              hasPendingChangesRef.current = true;
              setHasPendingChanges(true);
              return;
            }
            // "failed": fall through to the reload message below, with the person's edits still on screen.
          }

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
        if (res.status === 410) {
          // Staff turned this link off while the page was open. Retrying cannot help; say so and keep the edits on screen.
          setSaveStatus("error");
          setSaveError(LINK_OFF_MESSAGE);
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

  const save = useCallback(
    async (updatedData: ChecklistData) => {
      savesInFlightRef.current += 1;
      try {
        await saveOnce(updatedData);
      } finally {
        savesInFlightRef.current -= 1;
      }
    },
    [saveOnce]
  );

  const publishChanges = useCallback(() => {
    // Pressing Save while still typing: hand the typed text over first, then save once it has landed in the page.
    // (The hand-over reaches the page's state a moment later, so the save itself waits one tick.)
    const hadDrafts = hasPendingDrafts();
    flushAllDrafts();
    const run = () => {
      if (latestDataRef.current && dirtyFieldsRef.current.size > 0) {
        save(latestDataRef.current);
      }
    };
    if (hadDrafts) setTimeout(run, 0);
    else run();
  }, [save]);

  const discardChanges = useCallback(() => {
    // Text still being typed is part of what is being discarded; left alone it would be handed over afterwards.
    cancelAllDrafts();
    if (!lastSavedDataRef.current) return;

    const restoredData = cloneChecklistData(lastSavedDataRef.current);
    setData(restoredData);
    latestDataRef.current = restoredData;
    dirtyFieldsRef.current.clear();
    hasPendingChangesRef.current = false;
    setHasPendingChanges(false);
    setSaveStatus("saved");
    setSaveError(null);
    // Discarded on purpose: the device copy must go too, or it would be offered back next visit.
    writeBackupNow();
  }, [writeBackupNow]);

  const retrySave = useCallback(() => {
    if (latestDataRef.current) {
      save(latestDataRef.current);
    }
  }, [save]);

  const updateField = useCallback(
    <K extends keyof ChecklistData>(
      field: K,
      value: ChecklistData[K] | ((current: ChecklistData[K]) => ChecklistData[K])
    ) => {
      setData((prev) => {
        if (!prev) return prev;
        // A function is applied to the newest copy of the field (see checklist-context.ts).
        const next =
          typeof value === "function"
            ? (value as (current: ChecklistData[K]) => ChecklistData[K])(prev[field])
            : value;
        const updated = { ...prev, [field]: next };
        latestDataRef.current = updated;
        hasPendingChangesRef.current = true;
        setHasPendingChanges(true);
        dirtyFieldsRef.current.add(field as string);
        // Deliberately NOT resetting the save status here. A failed save must stay visible until a save succeeds:
        // clearing it on every edit made a save that kept failing look healthy, and with edits now handed over
        // while typing that would have happened constantly.

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
      // Text typed in a cell but not yet handed to the page counts too: check before handing it over, because the
      // hand-over reaches the page's state a moment later than this check.
      const typing = hasPendingDrafts();
      flushDraftsNow();
      if (typing || hasPendingChangesRef.current || saveStatus === "saving") {
        e.preventDefault();
        // Some browsers only show the leave-page prompt when returnValue is set.
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [saveStatus, flushDraftsNow]);

  // Tab hidden, app switched, page being put away (a phone locking is the usual case): hand over what is being
  // typed and send it at once instead of waiting for the autosave timer, which a hidden page may never run.
  // This is a best effort: a page that is closed before the request completes still loses it, which is why the
  // pause before hand-over is short.
  useEffect(() => {
    const handleHide = (event: Event) => {
      // visibilitychange fires when the page is hidden AND when it comes back; only the first matters here.
      // pagehide always means the page is being put away.
      if (event.type === "visibilitychange" && document.visibilityState !== "hidden") return;
      // Writes the on-device copy first (instant), then tries the network, which a closing page may not finish.
      flushDraftsNow();
      setTimeout(() => {
        if (
          latestDataRef.current &&
          dirtyFieldsRef.current.size > 0 &&
          savesInFlightRef.current === 0
        ) {
          save(latestDataRef.current);
        }
      }, 0);
    };
    document.addEventListener("visibilitychange", handleHide);
    window.addEventListener("pagehide", handleHide);
    return () => {
      document.removeEventListener("visibilitychange", handleHide);
      window.removeEventListener("pagehide", handleHide);
    };
  }, [save, flushDraftsNow]);

  return {
    data,
    loading,
    error,
    saveStatus,
    saveError,
    hasPendingChanges: hasPendingChanges || draftsPending,
    lastSavedAt,
    updateField,
    retrySave,
    publishChanges,
    discardChanges,
    hasPendingChangesRef,
    /** Unsaved typing found from an earlier visit (null when none), and what to do about it. */
    unsavedBackup: {
      offer,
      restore: restoreUnsaved,
      discard: discardUnsaved,
      /** True while unsaved edits exist that the browser would not let us copy to this device. */
      storageProblem,
    },
  };
}
