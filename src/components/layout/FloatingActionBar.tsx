"use client";

import { UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FloatingActionBarProps {
  visible: boolean;
  isSaving: boolean;
  onDiscard: () => void;
  onPublish: () => void;
}

export function FloatingActionBar({
  visible,
  isSaving,
  onDiscard,
  onPublish,
}: FloatingActionBarProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-xl items-center justify-between gap-3 rounded-[24px] border border-white/70 bg-white/[0.92] p-3 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Unpublished changes</p>
          <p className="text-sm text-slate-500">
            Review your edits, then discard or publish them to the checklist.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDiscard}
            disabled={isSaving}
            className="h-11 rounded-xl border-slate-200 bg-white px-4 text-slate-700 shadow-none hover:bg-slate-50 active:scale-95"
          >
            <X className="h-4 w-4" />
            Discard Changes
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onPublish}
            disabled={isSaving}
            className="h-11 rounded-xl bg-[#00BFA5] px-4 text-white shadow-[0_18px_32px_-22px_rgba(0,191,165,0.85)] hover:bg-[#00a896] active:scale-95"
          >
            <UploadCloud className="h-4 w-4" />
            {isSaving ? "Publishing..." : "Publish Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
