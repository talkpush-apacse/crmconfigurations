"use client";

import { Trash2, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BulkActionBarProps {
  count: number;
  itemLabel: string; // e.g. "user", "users"
  onDelete: () => void;
  onDuplicate?: () => void;
  onClear: () => void;
  isBusy?: boolean;
}

/**
 * Sticky action bar shown above a table when 1+ rows are selected.
 * Renders nothing when `count === 0`.
 */
export function BulkActionBar({
  count,
  itemLabel,
  onDelete,
  onDuplicate,
  onClear,
  isBusy = false,
}: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div
      className="sticky top-0 z-20 mb-2 flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 shadow-sm"
      role="toolbar"
      aria-label="Bulk actions"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-teal-600 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
          {count}
        </span>
        <span className="text-sm font-medium text-teal-900">
          {count === 1 ? `${itemLabel} selected` : `${itemLabel} selected`}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {onDuplicate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDuplicate}
            disabled={isBusy}
            className="h-8 border-teal-300 bg-white text-teal-800 hover:bg-teal-100"
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Duplicate
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onDelete}
          disabled={isBusy}
          className="h-8 border-red-300 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={isBusy}
          className="h-8 px-2 text-teal-800 hover:bg-teal-100"
          title="Clear selection"
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Clear selection</span>
        </Button>
      </div>
    </div>
  );
}
