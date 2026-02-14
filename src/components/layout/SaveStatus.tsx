"use client";

import { Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SaveStatusProps {
  status: "saved" | "saving" | "error";
}

export function SaveStatus({ status }: SaveStatusProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        status === "saved" && "bg-green-50 text-green-700",
        status === "saving" && "bg-yellow-50 text-yellow-700",
        status === "error" && "bg-red-50 text-red-700"
      )}
    >
      {status === "saved" && (
        <>
          <Check className="h-3 w-3" />
          Saved
        </>
      )}
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving...
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="h-3 w-3" />
          Error saving
        </>
      )}
    </div>
  );
}
