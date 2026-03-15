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
}

export function SaveStatus({ status, errorMessage, onRetry }: SaveStatusProps) {
  if (status === "error") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
          >
            <AlertCircle className="h-3 w-3" />
            Error saving
            {onRetry && <RefreshCw className="h-3 w-3 ml-0.5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">{errorMessage || "Save failed. Click to retry."}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-gray-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving...
      </span>
    );
  }

  // saved — plain text label, not a button
  return (
    <span className="flex items-center gap-1 text-xs text-green-600">
      <Check className="h-3 w-3" />
      Saved
    </span>
  );
}
