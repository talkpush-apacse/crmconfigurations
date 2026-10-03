"use client";

import { createContext, useContext } from "react";

interface StepNumberContextValue {
  /** Whether step number badges are currently visible */
  visible: boolean;
}

export const StepNumberContext = createContext<StepNumberContextValue>({
  visible: true,
});

export function useStepNumbers() {
  return useContext(StepNumberContext);
}
