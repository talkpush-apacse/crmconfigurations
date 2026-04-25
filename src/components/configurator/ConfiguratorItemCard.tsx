"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ConfiguratorContextBox } from "@/components/configurator/ConfiguratorContextBox";
import { ConfiguratorSourceContextBox } from "@/components/configurator/ConfiguratorSourceContextBox";
import { ConfiguratorStatusButtons } from "@/components/configurator/ConfiguratorStatusButtons";
import { ConfiguratorTipBox } from "@/components/configurator/ConfiguratorTipBox";
import { getConfiguratorSourceContext } from "@/lib/configurator-source-context";
import { cn } from "@/lib/utils";
import type {
  ConfiguratorItemState,
  ConfiguratorStatus,
  ConfiguratorTemplateItem,
} from "@/lib/configurator-template";

interface ConfiguratorItemCardProps {
  step: number;
  item: ConfiguratorTemplateItem;
  state: ConfiguratorItemState;
  sourceData: unknown;
  onUpdate: (
    itemId: string,
    patch: { status?: ConfiguratorStatus | null; notes?: string | null; configured?: boolean }
  ) => void;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function accentForStatus(status: ConfiguratorStatus | null): string {
  if (status === "completed") return "border-l-emerald-700";
  if (status === "in_progress") return "border-l-blue-600";
  if (status === "in_progress_with_dependency") return "border-l-amber-500";
  if (status === "blocked") return "border-l-red-600";
  return "border-l-slate-200";
}

function formatRelativeTime(value: string): string {
  const diff = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(value).toLocaleDateString();
}

function updatedByLabel(updatedBy: string | null): string {
  if (!updatedBy) return "";
  if (updatedBy === "mcp") return "MCP";
  return "Admin";
}

export function ConfiguratorItemCard({ step, item, state, sourceData, onUpdate }: ConfiguratorItemCardProps) {
  const [notesOpen, setNotesOpen] = useState(!!state.notes);
  const sourceContexts = getConfiguratorSourceContext(item.id, sourceData);

  return (
    <Card className={cn("rounded-lg border-l-4 shadow-sm", accentForStatus(state.status))}>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-full bg-emerald-800 text-white hover:bg-emerald-800">
            Step <span className="ml-1 tabular-nums">{step}</span>
          </Badge>
          <Badge variant="outline" className="rounded-full">
            {item.section}
          </Badge>
        </div>

        <h2 className="text-base font-semibold leading-6 text-slate-950">{item.title}</h2>

        {item.tip && <ConfiguratorTipBox tip={item.tip} />}
        {item.contextFields && item.contextFields.length > 0 && (
          <ConfiguratorContextBox fields={item.contextFields} sourceData={sourceData} />
        )}
        <ConfiguratorSourceContextBox contexts={sourceContexts} />

        <ConfiguratorStatusButtons
          value={state.status}
          onChange={(status) => onUpdate(state.itemId, { status })}
        />

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          <label
            htmlFor={`configured-${state.itemId}`}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-400"
          >
            <Checkbox
              id={`configured-${state.itemId}`}
              checked={state.configured ?? false}
              onCheckedChange={(checked) => onUpdate(state.itemId, { configured: checked === true })}
            />
            Configured
          </label>
          {state.configured && state.configuredAt && (
            <span className="text-xs text-slate-500">
              Configured {formatDateTime(state.configuredAt)}
              {state.configuredBy ? ` · ${updatedByLabel(state.configuredBy)}` : ""}
            </span>
          )}
        </div>

        {notesOpen ? (
          <div className="space-y-2">
            <label htmlFor={`notes-${state.itemId}`} className="text-sm font-medium text-slate-700">
              Comment
            </label>
            <Textarea
              id={`notes-${state.itemId}`}
              value={state.notes ?? ""}
              onChange={(event) => onUpdate(state.itemId, { notes: event.target.value })}
              placeholder="Add implementation notes, dependencies, or blockers."
              className="min-h-24 rounded-md"
            />
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-md text-slate-600"
            onClick={() => setNotesOpen(true)}
          >
            <MessageSquarePlus className="h-4 w-4" />
            Add comment
          </Button>
        )}

        {state.updatedAt && (
          <p className="text-xs text-slate-500">
            Updated by {updatedByLabel(state.updatedBy)} · {formatRelativeTime(state.updatedAt)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
