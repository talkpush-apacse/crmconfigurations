"use client";

import { createContext, useContext } from "react";
import type { ChecklistData } from "./types";

interface ChecklistContextType {
  data: ChecklistData;
  updateField: <K extends keyof ChecklistData>(field: K, value: ChecklistData[K]) => void;
  saveStatus: "saved" | "saving" | "error";
  saveError: string | null;
  hasPendingChanges: boolean;
  retrySave: () => void;
  publishChanges: () => void;
  discardChanges: () => void;
  isReadOnly: boolean;
  userRole: string | null;
  /** Route prefix for building tab links, e.g. "/client/exl" or "/editor/abc123" */
  basePath: string;
}

export const ChecklistContext = createContext<ChecklistContextType | null>(null);

export function useChecklistContext() {
  const context = useContext(ChecklistContext);
  if (!context) throw new Error("useChecklistContext must be used within ChecklistContext.Provider");
  return context;
}
