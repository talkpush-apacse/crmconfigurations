"use client";

import { X } from "lucide-react";
import { type Edge } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EDGE_LINE_TYPES,
  EDGE_MARKER_TYPES,
  EDGE_STROKE_COLORS,
} from "@/lib/workflow/constants";
import {
  DEFAULT_EDGE_DATA,
  type EdgeLineType,
  type EdgeMarkerType,
  type PathSemantic,
  type WorkflowEdgeData,
} from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

interface EdgePropertiesProps {
  edge: Edge;
  onChange: (id: string, updates: Partial<WorkflowEdgeData>) => void;
  onClose: () => void;
}

function normalizeData(data: unknown): WorkflowEdgeData {
  return {
    ...DEFAULT_EDGE_DATA,
    ...((data ?? {}) as Partial<WorkflowEdgeData>),
  };
}

function LinePreview({ type }: { type: EdgeLineType }) {
  if (type === "straight") {
    return (
      <svg viewBox="0 0 48 20" className="h-4 w-10" aria-hidden>
        <path d="M6 16 L42 4" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    );
  }

  if (type === "step") {
    return (
      <svg viewBox="0 0 48 20" className="h-4 w-10" aria-hidden>
        <path d="M6 4 H24 V16 H42" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    );
  }

  if (type === "smoothstep") {
    return (
      <svg viewBox="0 0 48 20" className="h-4 w-10" aria-hidden>
        <path d="M6 4 H20 Q24 4 24 8 V12 Q24 16 28 16 H42" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 20" className="h-4 w-10" aria-hidden>
      <path d="M6 16 C18 2 30 2 42 16" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

export default function EdgeProperties({
  edge,
  onChange,
  onClose,
}: EdgePropertiesProps) {
  const data = normalizeData(edge.data);

  return (
    <div className="w-80 h-full bg-card border-l border-border flex flex-col overflow-hidden max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-30 max-md:!w-[min(20rem,90vw)] max-md:shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold text-foreground">Edge Properties</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-11 w-11 p-0 text-muted-foreground hover:text-foreground/70 md:h-7 md:w-7"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <section>
          <label className="text-sm font-medium text-foreground/85 mb-2 block">
            Line Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {EDGE_LINE_TYPES.map((lineType) => {
              const active = data.lineType === lineType.value;
              return (
                <button
                  key={lineType.value}
                  type="button"
                  onClick={() =>
                    onChange(edge.id, { lineType: lineType.value })
                  }
                  title={lineType.description}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-card text-foreground/70 hover:border-brand-lavender hover:bg-brand-lavender-lightest hover:text-foreground"
                  )}
                >
                  <LinePreview type={lineType.value} />
                  <span>{lineType.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3 border-t border-border/50 pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Markers
          </p>
          <div>
            <label className="text-sm font-medium text-foreground/85 mb-1 block">
              Start Point
            </label>
            <Select
              value={data.markerStart}
              onValueChange={(value) =>
                onChange(edge.id, { markerStart: value as EdgeMarkerType })
              }
            >
              <SelectTrigger className="border border-input bg-card focus:ring-2 focus:ring-ring">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDGE_MARKER_TYPES.map((marker) => (
                  <SelectItem key={marker.value} value={marker.value}>
                    {marker.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground/85 mb-1 block">
              End Point
            </label>
            <Select
              value={data.markerEnd}
              onValueChange={(value) =>
                onChange(edge.id, { markerEnd: value as EdgeMarkerType })
              }
            >
              <SelectTrigger className="border border-input bg-card focus:ring-2 focus:ring-ring">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDGE_MARKER_TYPES.map((marker) => (
                  <SelectItem key={marker.value} value={marker.value}>
                    {marker.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="border-t border-border/50 pt-4">
          <label className="text-sm font-medium text-foreground/85 mb-1 block">
            Edge Label
          </label>
          <Input
            value={data.label ?? ""}
            onChange={(event) => onChange(edge.id, { label: event.target.value })}
            placeholder="e.g. Yes, No, If qualified..."
            className="border border-input bg-card focus:ring-2 focus:ring-ring focus:border-ring"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Labels appear on the connector line
          </p>
        </section>

        <section className="border-t border-border/50 pt-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Path Type
          </p>
          <Select
            value={data.pathSemantic ?? "neutral"}
            onValueChange={(value) =>
              onChange(edge.id, { pathSemantic: value as PathSemantic })
            }
          >
            <SelectTrigger className="border border-input bg-card focus:ring-2 focus:ring-ring">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="happy">Happy Path</SelectItem>
              <SelectItem value="failure">Failure</SelectItem>
              <SelectItem value="recovery">Recovery</SelectItem>
            </SelectContent>
          </Select>

          {data.pathSemantic === "recovery" && (
            <div>
              <label className="text-sm font-medium text-foreground/85 mb-1 block">
                Recovery Label
              </label>
              <Input
                value={data.recoveryLabel ?? ""}
                onChange={(e) => onChange(edge.id, { recoveryLabel: e.target.value })}
                placeholder="e.g. Return to screening"
                className="border border-input bg-card focus:ring-2 focus:ring-ring focus:border-ring"
              />
            </div>
          )}

          <button
            type="button"
            role="switch"
            aria-checked={data.isPrimary !== false}
            onClick={() => onChange(edge.id, { isPrimary: data.isPrimary === false })}
            className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left transition-colors hover:bg-secondary"
          >
            <div>
              <span className="text-sm font-medium text-foreground/85 block">
                Primary path
              </span>
              <span className="text-xs text-muted-foreground">
                Main hiring flow. Gets whole step numbers when re-numbered.
              </span>
            </div>
            <span
              className={cn(
                "relative ml-3 h-5 w-9 shrink-0 rounded-full transition-colors",
                data.isPrimary !== false ? "bg-primary" : "bg-muted-foreground/40"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform",
                  data.isPrimary !== false ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </span>
          </button>
          {data.isPrimary === false && (
            <p className="mt-1 text-xs text-muted-foreground">
              Branch edges receive decimal suffixes (e.g. 4.1, 4.2) when Re-numbered.
            </p>
          )}
        </section>

        <section className="space-y-4 border-t border-border/50 pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Appearance
          </p>
          <div>
            <label className="text-sm font-medium text-foreground/85 mb-2 block">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {EDGE_STROKE_COLORS.map((color) => {
                const active = data.strokeColor === color.value;
                return (
                  <button
                    key={color.value}
                    type="button"
                    title={color.label}
                    aria-label={color.label}
                    onClick={() => onChange(edge.id, { strokeColor: color.value })}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 border-white shadow-sm transition",
                      active && "ring-2 ring-foreground ring-offset-1"
                    )}
                    style={{ backgroundColor: color.value }}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/85 mb-2 block">
              Width
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map((width) => {
                const active = data.strokeWidth === width;
                return (
                  <button
                    key={width}
                    type="button"
                    onClick={() => onChange(edge.id, { strokeWidth: width })}
                    className={cn(
                      "h-8 w-10 rounded-md border text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-card text-foreground/70 hover:border-brand-lavender hover:bg-brand-lavender-lightest"
                    )}
                  >
                    {width}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={Boolean(data.animated)}
            onClick={() => onChange(edge.id, { animated: !data.animated })}
            className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left transition-colors hover:bg-secondary"
          >
            <span className="text-sm font-medium text-foreground/85">
              Animated (dashed)
            </span>
            <span
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                data.animated ? "bg-primary" : "bg-muted-foreground/40"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform",
                  data.animated ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </span>
          </button>
        </section>
      </div>
    </div>
  );
}
