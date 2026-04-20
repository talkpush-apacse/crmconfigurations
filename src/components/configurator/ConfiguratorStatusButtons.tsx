"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConfiguratorStatus } from "@/lib/configurator-template";

const OPTIONS: Array<{ value: ConfiguratorStatus; label: string; className: string; activeClassName: string }> = [
  {
    value: "completed",
    label: "Completed",
    className: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
    activeClassName: "bg-emerald-700 text-white hover:bg-emerald-800",
  },
  {
    value: "in_progress",
    label: "In Progress",
    className: "border-blue-200 text-blue-700 hover:bg-blue-50",
    activeClassName: "bg-blue-700 text-white hover:bg-blue-800",
  },
  {
    value: "in_progress_with_dependency",
    label: "In Progress w/ Dependency",
    className: "border-amber-200 text-amber-700 hover:bg-amber-50",
    activeClassName: "bg-amber-600 text-white hover:bg-amber-700",
  },
  {
    value: "blocked",
    label: "Blocked",
    className: "border-red-200 text-red-700 hover:bg-red-50",
    activeClassName: "bg-red-700 text-white hover:bg-red-800",
  },
];

interface ConfiguratorStatusButtonsProps {
  value: ConfiguratorStatus | null;
  onChange: (status: ConfiguratorStatus) => void;
}

export function ConfiguratorStatusButtons({ value, onChange }: ConfiguratorStatusButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            variant={active ? "default" : "outline"}
            size="sm"
            className={cn("h-9 rounded-md", active ? option.activeClassName : option.className)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
