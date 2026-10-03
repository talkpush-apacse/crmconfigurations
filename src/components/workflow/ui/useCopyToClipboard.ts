"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "./toast";

type UseCopyToClipboardOptions = {
  successMessage?: string;
  errorMessage?: string;
  resetDelayMs?: number;
};

export function useCopyToClipboard({
  successMessage = "Copied to clipboard",
  errorMessage = "Failed to copy to clipboard",
  resetDelayMs = 2000,
}: UseCopyToClipboardOptions = {}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function copy(text: string, id = "generated") {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success(successMessage);

      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = setTimeout(() => {
        setCopiedId(null);
        resetTimerRef.current = null;
      }, resetDelayMs);
    } catch {
      toast.error(errorMessage);
    }
  }

  return { copiedId, copy };
}
