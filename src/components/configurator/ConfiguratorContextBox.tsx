"use client";

import { resolveContextPath } from '@/lib/configurator-filter';

interface ContextField {
  label: string;
  path: string;
}

interface ConfiguratorContextBoxProps {
  fields: ContextField[];
  checklistData: Record<string, unknown>;
}

export function ConfiguratorContextBox({ fields, checklistData }: ConfiguratorContextBoxProps) {
  return (
    <div className="mt-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
        From source checklist
      </p>
      <dl className="space-y-0.5">
        {fields.map(field => {
          const value = resolveContextPath(checklistData, field.path);
          return (
            <div key={field.path} className="flex gap-2 text-xs">
              <dt className="shrink-0 font-medium text-orange-800">{field.label}:</dt>
              <dd className={value === '—' ? 'text-orange-400 italic' : 'text-orange-900'}>{value}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
