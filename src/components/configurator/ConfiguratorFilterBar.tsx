"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfiguratorFilter = "all" | "completed" | "in_progress" | "in_progress_with_dependency" | "blocked";

const FILTERS: Array<{ value: ConfiguratorFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_progress_with_dependency", label: "In Progress with Dependency" },
  { value: "blocked", label: "Blocked/Has Dependency" },
];

interface ConfiguratorFilterBarProps {
  value: ConfiguratorFilter;
  onChange: (value: ConfiguratorFilter) => void;
  onExport: () => Promise<void>;
  exporting: boolean;
}

export function ConfiguratorFilterBar({ value, onChange, onExport, exporting }: ConfiguratorFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => onChange(filter.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              value === filter.value
                ? "border-emerald-800 bg-emerald-800 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <Button type="button" variant="outline" onClick={onExport} disabled={exporting} className="rounded-md">
        <Download className="h-4 w-4" />
        {exporting ? "Preparing..." : "Export to Excel"}
      </Button>
    </div>
  );
}
