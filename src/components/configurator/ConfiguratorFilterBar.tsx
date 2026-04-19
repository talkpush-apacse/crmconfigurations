"use client";

import type { ConfiguratorStatus } from '@/lib/configurator-template';

export type FilterValue = 'all' | ConfiguratorStatus;

const FILTERS: Array<{ value: FilterValue; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_progress_with_dependency', label: 'In Progress w/ Dep.' },
  { value: 'blocked', label: 'Blocked' },
];

interface ConfiguratorFilterBarProps {
  active: FilterValue;
  onChange: (value: FilterValue) => void;
}

export function ConfiguratorFilterBar({ active, onChange }: ConfiguratorFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map(f => (
        <button
          key={f.value}
          type="button"
          onClick={() => onChange(f.value)}
          className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
            active === f.value
              ? 'border-teal-600 bg-teal-600 text-white'
              : 'border-gray-300 bg-white text-gray-600 hover:border-teal-400 hover:text-teal-700'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
