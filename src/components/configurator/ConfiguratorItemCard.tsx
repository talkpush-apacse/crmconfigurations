"use client";

import { useState } from 'react';
import type { ConfiguratorItemState, ConfiguratorStatus, ConfiguratorTemplateItem } from '@/lib/configurator-template';
import { ConfiguratorStatusButtons } from './ConfiguratorStatusButtons';
import { ConfiguratorTipBox } from './ConfiguratorTipBox';
import { ConfiguratorContextBox } from './ConfiguratorContextBox';

const ACCENT_COLORS: Record<ConfiguratorStatus, string> = {
  completed: 'border-l-green-600',
  in_progress: 'border-l-blue-500',
  in_progress_with_dependency: 'border-l-amber-500',
  blocked: 'border-l-red-500',
};

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface ConfiguratorItemCardProps {
  step: number;
  template: ConfiguratorTemplateItem;
  state: ConfiguratorItemState;
  checklistData: Record<string, unknown>;
  onUpdate: (itemId: string, patch: { status?: ConfiguratorStatus | null; notes?: string | null }) => void;
}

export function ConfiguratorItemCard({
  step,
  template,
  state,
  checklistData,
  onUpdate,
}: ConfiguratorItemCardProps) {
  const [notesOpen, setNotesOpen] = useState(!!state.notes);
  const accentClass = state.status ? ACCENT_COLORS[state.status] : 'border-l-gray-200';

  return (
    <div
      className={`rounded-lg border border-gray-200 border-l-[3px] bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${accentClass}`}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-green-700 px-2 py-0.5 text-[10px] font-semibold text-white">
          Step {step}
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
          {template.section}
        </span>
      </div>

      {/* Title */}
      <p className="mt-2 text-sm font-semibold text-gray-800">{template.title}</p>

      {/* Tip */}
      {template.tip && <ConfiguratorTipBox tip={template.tip} />}

      {/* Context */}
      {template.contextFields && template.contextFields.length > 0 && (
        <ConfiguratorContextBox fields={template.contextFields} checklistData={checklistData} />
      )}

      {/* Status buttons */}
      <ConfiguratorStatusButtons
        current={state.status}
        onSelect={status => onUpdate(state.itemId, { status })}
      />

      {/* Notes toggle */}
      <div className="mt-3">
        {!notesOpen ? (
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            + Add comment
          </button>
        ) : (
          <textarea
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            rows={2}
            placeholder="Add a comment or note…"
            value={state.notes ?? ''}
            onChange={e => onUpdate(state.itemId, { notes: e.target.value || null })}
          />
        )}
      </div>

      {/* Footer: updated by */}
      {state.updatedAt && (
        <p className="mt-2 text-[10px] text-gray-400">
          Updated by{' '}
          <span className="font-medium">
            {state.updatedBy ? state.updatedBy.split('@')[0] : 'unknown'}
          </span>
          {' · '}
          {relativeTime(state.updatedAt)}
        </p>
      )}
    </div>
  );
}
