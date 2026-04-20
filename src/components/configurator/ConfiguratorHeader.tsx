"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfiguratorRefreshButton } from "@/components/configurator/ConfiguratorRefreshButton";
import type { ConfiguratorChecklistBlob } from "@/lib/configurator-template";

interface ConfiguratorHeaderProps {
  clientName: string;
  blob: ConfiguratorChecklistBlob;
  stale: boolean;
  onRefresh: () => Promise<void>;
}

export function ConfiguratorHeader({ clientName, blob, stale, onRefresh }: ConfiguratorHeaderProps) {
  const stateMap = new Map(blob.items.map((item) => [item.itemId, item]));
  const total = blob.snapshotItemIds.length;
  const completed = blob.snapshotItemIds.filter((itemId) => {
    const state = stateMap.get(itemId);
    return state && !state.archived && state.status === "completed";
  }).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card className="sticky top-4 z-20 rounded-lg border-emerald-100 shadow-md">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <Link href="/admin">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" aria-label="Back to admin">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                Configurator&apos;s Checklist
              </span>
            </div>
            <h1 className="break-words text-3xl font-bold tracking-tight text-slate-950">{clientName}</h1>
            <p className="mt-1 text-sm text-slate-600">Talkpush admin configuration steps</p>
          </div>

          <div className="w-full max-w-sm">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">Progress</span>
              <span className="font-semibold tabular-nums text-slate-950">
                {completed} / {total}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-800 transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-slate-500 tabular-nums">{percent}% completed</p>
          </div>
        </div>

        {stale && (
          <div className="mt-4 flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <p>Settings changed since this checklist was generated.</p>
            <ConfiguratorRefreshButton onRefresh={onRefresh} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
