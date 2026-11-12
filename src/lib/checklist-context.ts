"use client";

import { createContext, useContext } from "react";
import type { ChecklistData } from "./types";

interface ChecklistContextType {
  data: ChecklistData;
  /**
   * Replaces a field. Pass a function to build the new value from the NEWEST copy of the field instead of the one
   * from the last render: edits that land close together (a typed cell and a merged-in server change, two cells
   * handed over in the same moment) then stack instead of the later one erasing the earlier.
   */
  updateField: <K extends keyof ChecklistData>(
    field: K,
    value: ChecklistData[K] | ((current: ChecklistData[K]) => ChecklistData[K])
  ) => void;
  saveStatus: "saved" | "saving" | "error";
  saveError: string | null;
  hasPendingChanges: boolean;
  /** Epoch ms of the last successful save, or null if nothing has saved yet. */
  lastSavedAt?: number | null;
  retrySave: () => void;
  publishChanges: () => void;
  discardChanges: () => void;
  isReadOnly: boolean;
  userRole: string | null;
  includeAdminTabs?: boolean;
  /** Route prefix for building tab links, e.g. "/client/exl" or "/editor/abc123" */
  basePath: string;
}

export const ChecklistContext = createContext<ChecklistContextType | null>(null);

export function useChecklistContext() {
  const context = useContext(ChecklistContext);
  if (!context) throw new Error("useChecklistContext must be used within ChecklistContext.Provider");
  return context;
}
