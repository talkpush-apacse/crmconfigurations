"use client";

import LanesPanel, { type LanesPanelProps } from "./LanesPanel";
import { useState } from "react";
import {
  CircleDot,
  Clock,
  GitBranch,
  GitMerge,
  GripVertical,
  Hand,
  Megaphone,
  MessageSquare,
  Plug,
  CornerDownRight,
  Flag,
  Square,
  StretchHorizontal,
  StickyNote,
  Table2,
  UserCheck,
} from "lucide-react";
import { ACTOR_CONFIG, NODE_TYPE_CONFIG, type ActorType, type NodeType } from "@/lib/workflow/types";
import type { AnnotationShapeType } from "@/lib/workflow/types";
import OutlinePanel from "@/components/workflow/client/OutlinePanel";
import type { OutlineItem } from "@/lib/workflow/outline";

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  CircleDot,
  GitBranch,
  Plug,
  MessageSquare,
  GitMerge,
  Clock,
  Hand,
  Megaphone,
  Table2,
  StretchHorizontal,
  Square,
  Flag,
  CornerDownRight,
  StickyNote,
};

type NodeTypeConfigEntry = [keyof typeof NODE_TYPE_CONFIG, (typeof NODE_TYPE_CONFIG)[keyof typeof NODE_TYPE_CONFIG]];

// Workflow step nodes (shown in main palette)
const STEP_NODE_TYPES = (
  Object.entries(NODE_TYPE_CONFIG) as NodeTypeConfigEntry[]
).filter(([type]) => type !== "swimlane" && type !== "frame");

// Container nodes (shown in separate section)
const CONTAINER_NODE_TYPES = (
  Object.entries(NODE_TYPE_CONFIG) as NodeTypeConfigEntry[]
).filter(([type]) => type === "swimlane" || type === "frame");

// Annotation shape items for the palette
const ANNOTATION_SHAPES: { shape: AnnotationShapeType; label: string; preview: React.ReactNode }[] = [
  {
    shape: "rect",
    label: "Box",
    preview: (
      <svg width="22" height="16" viewBox="0 0 22 16">
        <rect x="1" y="1" width="20" height="14" rx="1" fill="#EFF6FF" stroke="#6B7280" strokeWidth="1.5" strokeDasharray="4 2" />
      </svg>
    ),
  },
  {
    shape: "rounded-rect",
    label: "Rounded Box",
    preview: (
      <svg width="22" height="16" viewBox="0 0 22 16">
        <rect x="1" y="1" width="20" height="14" rx="5" fill="#EFF6FF" stroke="#6B7280" strokeWidth="1.5" strokeDasharray="4 2" />
      </svg>
    ),
  },
  {
    shape: "circle",
    label: "Circle",
    preview: (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <ellipse cx="9" cy="9" rx="8" ry="8" fill="#EFF6FF" stroke="#6B7280" strokeWidth="1.5" strokeDasharray="4 2" />
      </svg>
    ),
  },
  {
    shape: "diamond",
    label: "Diamond",
    preview: (
      <svg width="20" height="20" viewBox="0 0 20 20">
        <polygon points="10,1 19,10 10,19 1,10" fill="#EFF6FF" stroke="#6B7280" strokeWidth="1.5" strokeDasharray="4 2" />
      </svg>
    ),
  },
  {
    shape: "text-label",
    label: "Text Label",
    preview: (
      <svg width="22" height="16" viewBox="0 0 22 16">
        <text x="2" y="12" fontSize="10" fill="#374151" fontFamily="sans-serif" fontWeight="600">Aa</text>
      </svg>
    ),
  },
  {
    shape: "divider",
    label: "Divider",
    preview: (
      <svg width="22" height="10" viewBox="0 0 22 10">
        <line x1="1" y1="5" x2="21" y2="5" stroke="#6B7280" strokeWidth="1.5" strokeDasharray="4 2" />
      </svg>
    ),
  },
];

interface NodePaletteProps {
  onAddNode: (type: NodeType, actor?: ActorType) => void;
  onAddAnnotation: (shape: AnnotationShapeType, label: string) => void;
  diagramStyle: "classic" | "process_map";
  onDiagramStyleChange: (style: "classic" | "process_map") => void;
  /** The steps as a numbered, searchable list (the "Outline" tab). */
  outline: OutlineItem[];
  selectedStepId: string | null;
  onSelectStep: (nodeId: string) => void;
  /** Process Map only: the single-row / lanes switch and the lane list. */
  lanePanel?: LanesPanelProps;
}

/** Step kinds that exist only in the Process Map style. */
const PROCESS_MAP_ONLY = new Set(["terminator", "jump", "note"]);

type SidebarTab = "nodes" | "outline" | "layout" | "settings";

const DRAGGABLE_ITEM = "flex items-center gap-1.5 px-1.5 py-1.5 rounded-md border border-transparent hover:border-gray-200 hover:bg-gray-50 cursor-grab active:cursor-grabbing active:opacity-70 group transition-colors";

export default function NodePalette({ onAddNode, onAddAnnotation, diagramStyle, onDiagramStyleChange, outline, selectedStepId, onSelectStep, lanePanel }: NodePaletteProps) {
  const candidateActorConfig = ACTOR_CONFIG["candidate"];
  const [activeTab, setActiveTab] = useState<SidebarTab>("nodes");

  return (
    <div className="flex flex-col h-full">
      {/* Diagram style: the original look or the Lucid-style Process Map */}
      <div className="border-b border-gray-200 p-2 shrink-0">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Diagram style</p>
        <div role="group" aria-label="Diagram style" className="flex overflow-hidden rounded-md border border-gray-200 text-[11px]">
          {([["process_map", "Process Map"], ["classic", "Classic"]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={diagramStyle === value}
              onClick={() => onDiagramStyleChange(value)}
              className={`flex-1 py-1.5 font-medium ${diagramStyle === value ? "bg-teal-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {diagramStyle === "process_map" && lanePanel && <LanesPanel {...lanePanel} />}

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 shrink-0">
        {(["nodes", "outline", "layout", "settings"] as SidebarTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
              activeTab === tab
                ? "text-teal-700 border-b-2 border-teal-500 -mb-px bg-teal-50/40"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab === "nodes" ? "Nodes" : tab === "outline" ? "Outline" : tab === "layout" ? "Layout" : "Settings"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex flex-col gap-0.5 p-2 overflow-y-auto flex-1">

        {/* ── Nodes tab ── */}
        {activeTab === "nodes" && (
          <>
            <p className="text-[10px] text-gray-400 px-1 mb-1">Click to add · Drag to place</p>
            {STEP_NODE_TYPES.filter(([type]) => diagramStyle === "process_map" || !PROCESS_MAP_ONLY.has(type)).map(([type, config]) => {
              const Icon = TYPE_ICONS[config.icon] ?? CircleDot;
              return (
                <div
                  key={type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/reactflow/type", type);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => onAddNode(type)}
                  className={DRAGGABLE_ITEM}
                  title={`Add ${config.label} node`}
                >
                  <GripVertical className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                    style={{ background: config.bg, border: `1.5px solid ${config.border}` }}
                  >
                    <Icon className="w-3 h-3" style={{ color: config.border }} />
                  </div>
                  <span className="text-[13px] text-gray-700 group-hover:text-gray-900 font-medium">
                    {config.label}
                  </span>
                </div>
              );
            })}

            {/* Candidate Action shortcut */}
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-1 mb-1">Shortcut</p>
            </div>
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/reactflow/type", "manual_action");
                e.dataTransfer.setData("application/reactflow/actor", "candidate");
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => onAddNode("manual_action", "candidate")}
              className={DRAGGABLE_ITEM}
              title="Add Candidate Action node"
            >
              <GripVertical className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              <div
                className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                style={{ background: "#FFF7ED", border: `1.5px solid ${candidateActorConfig.color}` }}
              >
                <UserCheck className="w-3 h-3" style={{ color: candidateActorConfig.color }} />
              </div>
              <span className="text-[13px] text-gray-700 group-hover:text-gray-900 font-medium">
                Candidate Action
              </span>
            </div>
          </>
        )}

        {/* ── Layout tab ── */}
        {activeTab === "layout" && (
          <>
            <p className="text-[10px] text-gray-400 px-1 mb-1">Click to add · Drag to place</p>
            {CONTAINER_NODE_TYPES.map(([type, config]) => {
              const Icon = TYPE_ICONS[config.icon] ?? Square;
              return (
                <div
                  key={type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/reactflow/type", type);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => onAddNode(type)}
                  className={DRAGGABLE_ITEM}
                  title={`Add ${config.label}`}
                >
                  <GripVertical className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                    style={{ background: type === "frame" ? "#F9FAFB" : config.bg, border: `1.5px dashed ${config.border}` }}
                  >
                    <Icon className="w-3 h-3" style={{ color: config.border }} />
                  </div>
                  <span className="text-[13px] text-gray-700 group-hover:text-gray-900 font-medium">
                    {config.label}
                  </span>
                </div>
              );
            })}
          </>
        )}

        {/* ── Outline tab: the diagram as a numbered, searchable list ── */}
        {activeTab === "outline" && (
          <div className="-m-2 h-[calc(100vh-14rem)] min-h-64">
            <OutlinePanel items={outline} selectedId={selectedStepId} commentCounts={new Map()} onSelect={onSelectStep} />
          </div>
        )}

        {/* ── Settings tab ── */}
        {activeTab === "settings" && (
          <>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-1 mb-0.5">Annotations</p>
            <p className="text-[10px] text-gray-400 px-1 mb-1">Click to add · Drag to place</p>
            {ANNOTATION_SHAPES.map(({ shape, label, preview }) => (
              <div
                key={shape}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/reactflow/type", "annotation");
                  e.dataTransfer.setData("application/reactflow/annotation-shape", shape);
                  e.dataTransfer.setData("application/reactflow/annotation-label", label);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => onAddAnnotation(shape, label)}
                className={DRAGGABLE_ITEM}
                title={`Add ${label} annotation`}
              >
                <GripVertical className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  {preview}
                </div>
                <span className="text-xs text-gray-700 group-hover:text-gray-900 font-medium">
                  {label}
                </span>
              </div>
            ))}

            {/* Connector Types legend */}
            <div className="mt-3 pt-3 border-t border-gray-100 px-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Connector Types</p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <svg width="40" height="12" aria-hidden>
                    <line x1="2" y1="6" x2="38" y2="6" stroke="#00BFA5" strokeWidth="2" />
                  </svg>
                  <span className="text-[10px] text-gray-500">Primary path</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg width="40" height="12" aria-hidden>
                    <line x1="2" y1="6" x2="38" y2="6" stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.7" />
                  </svg>
                  <span className="text-[10px] text-gray-500">Branch / alternate</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
