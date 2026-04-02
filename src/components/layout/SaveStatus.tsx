"use client";

import { Check, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SaveStatusProps {
  status: "saved" | "saving" | "error";
  errorMessage?: string | null;
  onRetry?: () => void;
  hasPendingChanges?: boolean;
}

export function SaveStatus({ status, errorMessage, onRetry, hasPendingChanges = false }: SaveStatusProps) {
  if (status === "error") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50/90 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            <AlertCircle className="h-3 w-3" />
            Publish failed
            {onRetry && <RefreshCw className="h-3 w-3 ml-0.5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">{errorMessage || "Publishing failed. Click to retry."}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50/90 px-3 py-1 text-xs font-medium text-blue-700">
        <Loader2 className="h-3 w-3 animate-spin" />
        Publishing...
      </span>
    );
  }

  if (hasPendingChanges) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/90 px-3 py-1 text-xs font-medium text-amber-700">
        <AlertCircle className="h-3 w-3" />
        Unsaved changes
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1 text-xs font-medium text-emerald-700">
      <Check className="h-3 w-3" />
      Published
    </span>
  );
}
