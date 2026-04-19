"use client";

import type { ConfiguratorStatus } from '@/lib/configurator-template';

interface ConfiguratorStatusButtonsProps {
  current: ConfiguratorStatus | null;
  onSelect: (status: ConfiguratorStatus | null) => void;
}

const STATUSES: Array<{
  value: ConfiguratorStatus;
  label: string;
  activeClass: string;
  inactiveClass: string;
}> = [
  {
    value: 'completed',
    label: 'Completed',
    activeClass: 'bg-green-600 text-white border-green-600',
    inactiveClass: 'border-gray-300 text-gray-600 hover:border-green-400 hover:text-green-600',
  },
  {
    value: 'in_progress',
    label: 'In Progress',
    activeClass: 'bg-blue-600 text-white border-blue-600',
    inactiveClass: 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600',
  },
  {
    value: 'in_progress_with_dependency',
    label: 'In Progress w/ Dep.',
    activeClass: 'bg-amber-500 text-white border-amber-500',
    inactiveClass: 'border-gray-300 text-gray-600 hover:border-amber-400 hover:text-amber-600',
  },
  {
    value: 'blocked',
    label: 'Blocked',
    activeClass: 'bg-red-600 text-white border-red-600',
    inactiveClass: 'border-gray-300 text-gray-600 hover:border-red-400 hover:text-red-600',
  },
];

export function ConfiguratorStatusButtons({ current, onSelect }: ConfiguratorStatusButtonsProps) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {STATUSES.map(s => (
        <button
          key={s.value}
          type="button"
          onClick={() => onSelect(current === s.value ? null : s.value)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
            current === s.value ? s.activeClass : s.inactiveClass
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
