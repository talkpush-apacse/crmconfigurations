"use client";

import { AlertTriangle } from 'lucide-react';
import { ConfiguratorRefreshButton } from './ConfiguratorRefreshButton';

interface ConfiguratorHeaderProps {
  clientName: string;
  completedCount: number;
  totalCount: number;
  generatedAt: string;
  isStale: boolean;
  onRefresh: () => Promise<void>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ConfiguratorHeader({
  clientName,
  completedCount,
  totalCount,
  generatedAt,
  isStale,
  onRefresh,
}: ConfiguratorHeaderProps) {
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Configurator&apos;s Checklist
          </p>
          <h1 className="mt-1 text-[28px] font-bold text-gray-900 leading-tight truncate">
            {clientName}
          </h1>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-bold tabular-nums text-gray-900">
            {completedCount}
            <span className="text-lg font-normal text-gray-400"> / {totalCount}</span>
          </p>
          <p className="text-xs text-gray-500">tasks completed</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-green-600 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs text-gray-500">{pct}%</p>
      </div>

      {/* Stale snapshot banner */}
      {isStale && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              Settings changed since this checklist was generated.
            </p>
          </div>
          <ConfiguratorRefreshButton onRefresh={onRefresh} />
        </div>
      )}

      {/* Generated at */}
      <p className="mt-3 text-xs text-gray-400">
        Generated {formatDate(generatedAt)}
      </p>
    </div>
  );
}
