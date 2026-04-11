"use client";

import { useCallback } from "react";
import { useChecklistContext } from "@/lib/checklist-context";
import type { TabUploadFile, TabUploadMeta, TabUploadMetaMap } from "@/lib/types";

const EMPTY_META: TabUploadMeta = { uploadedFiles: [], isSkipped: false };

/**
 * Per-tab access to the shared `tabUploadMeta` JSON column. Each tab is
 * keyed by the data field name (e.g. "users", "campaigns") so that one
 * column on the Checklist row holds upload state for every tab.
 */
export function useTabUpload(tabKey: string) {
  const { data, updateField } = useChecklistContext();

  const map = (data.tabUploadMeta as TabUploadMetaMap | null) ?? null;
  const meta = map?.[tabKey] ?? EMPTY_META;

  const writeMeta = useCallback(
    (next: TabUploadMeta) => {
      const current = (data.tabUploadMeta as TabUploadMetaMap | null) ?? {};
      const updated: TabUploadMetaMap = { ...current, [tabKey]: next };
      updateField("tabUploadMeta", updated);
    },
    [data.tabUploadMeta, tabKey, updateField]
  );

  const setUploadedFiles = useCallback(
    (files: TabUploadFile[]) => {
      writeMeta({ uploadedFiles: files, isSkipped: meta.isSkipped });
    },
    [meta.isSkipped, writeMeta]
  );

  const setIsSkipped = useCallback(
    (isSkipped: boolean) => {
      writeMeta({ uploadedFiles: meta.uploadedFiles, isSkipped });
    },
    [meta.uploadedFiles, writeMeta]
  );

  return {
    uploadedFiles: meta.uploadedFiles,
    isSkipped: meta.isSkipped,
    setUploadedFiles,
    setIsSkipped,
  };
}
