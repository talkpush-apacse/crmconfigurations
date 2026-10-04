"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { LaneSummary } from "@/lib/workflow/process-map/lane-edit";

/**
 * The sidebar's Layout block for a Process Map: choose the classic single row or lanes, and, once lanes are on, rename,
 * reorder and mark lanes as another system. Every change goes through the editor, which says how many steps will move
 * before moving them and can be undone.
 */
export interface LanesPanelProps {
  lanesMode: boolean;
  lanes: LaneSummary[];
  onSetMode: (mode: "spine" | "lanes") => void;
  onRename: (from: string, to: string) => void;
  onToggleExternal: (lane: string, external: boolean) => void;
  onMove: (lane: string, delta: -1 | 1) => void;
}

function LaneRow({ lane, first, last, onRename, onToggleExternal, onMove }: { lane: LaneSummary; first: boolean; last: boolean } & Pick<LanesPanelProps, "onRename" | "onToggleExternal" | "onMove">) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const next = (draft ?? "").trim();
    setDraft(null);
    if (next && next !== lane.name) onRename(lane.name, next);
  };
  return (
    <li className={`rounded-md border px-2 py-1.5 ${lane.external ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white"}`} data-lane={lane.name}>
      <div className="flex items-center gap-1">
        {draft === null ? (
          <button type="button" className="flex-1 truncate text-left text-[12px] font-medium text-gray-800 hover:text-teal-700" title="Click to rename this lane" onClick={() => setDraft(lane.name)}>
            {lane.name}
          </button>
        ) : (
          <input
            autoFocus
            aria-label={`Rename the lane ${lane.name}`}
            className="min-w-0 flex-1 rounded border border-gray-300 px-1.5 py-0.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={draft}
            maxLength={60}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setDraft(null);
            }}
          />
        )}
        <span className="shrink-0 text-[10px] text-gray-400">{lane.steps}</span>
        <button type="button" aria-label={`Move ${lane.name} up`} disabled={first} onClick={() => onMove(lane.name, -1)} className="rounded p-0.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button type="button" aria-label={`Move ${lane.name} down`} disabled={last} onClick={() => onMove(lane.name, 1)} className="rounded p-0.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
      <label className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-600">
        <input type="checkbox" checked={lane.external} onChange={(e) => onToggleExternal(lane.name, e.target.checked)} />
        Another system (assessment platform, HRIS, a vendor)
      </label>
    </li>
  );
}

export default function LanesPanel({ lanesMode, lanes, onSetMode, onRename, onToggleExternal, onMove }: LanesPanelProps) {
  return (
    <div className="border-b border-gray-200 p-2 shrink-0" data-testid="lanes-panel">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Layout</p>
      <div role="group" aria-label="Layout" className="flex overflow-hidden rounded-md border border-gray-200 text-[11px]">
        {([["spine", "Single row"], ["lanes", "Lanes"]] as const).map(([value, label]) => {
          const on = (value === "lanes") === lanesMode;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => (on ? undefined : onSetMode(value))}
              className={`flex-1 py-1.5 font-medium ${on ? "bg-teal-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {!lanesMode && <p className="mt-1.5 text-[11px] leading-snug text-gray-400">One row for the main path. Use Lanes when several actors or another system are involved.</p>}
      {lanesMode && (
        <>
          <p className="mb-1 mt-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Lanes, top to bottom</p>
          <ul className="space-y-1">
            {lanes.map((lane, i) => (
              <LaneRow key={lane.name} lane={lane} first={i === 0} last={i === lanes.length - 1} onRename={onRename} onToggleExternal={onToggleExternal} onMove={onMove} />
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] leading-snug text-gray-400">Click a name to rename it. Set a step&apos;s lane and stage in its properties.</p>
        </>
      )}
    </div>
  );
}
