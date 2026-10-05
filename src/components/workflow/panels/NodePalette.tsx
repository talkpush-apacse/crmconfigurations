"use client";

import LanesPanel, { type LanesPanelProps } from "./LanesPanel";
import { useState } from "react";
import {
  ChevronDown,
  CircleDot,
  Clock,
  GitBranch,
  GitMerge,
  GripVertical,
  Hand,
  Megaphone,
  MessageSquare,
  Plug,
  Plus,
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
        <text x="2" y="12" fontSize="11" fill="#374151" fontFamily="sans-serif" fontWeight="600">Aa</text>
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

type SidebarTab = "outline" | "layout" | "shapes";

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "outline", label: "Outline" },
  { id: "layout", label: "Layout" },
  { id: "shapes", label: "Shapes" },
];

const DRAGGABLE_ITEM = "flex min-h-11 items-center gap-1.5 px-1.5 py-1.5 rounded-md border border-transparent hover:border-border hover:bg-secondary cursor-grab active:cursor-grabbing active:opacity-70 group transition-colors md:min-h-0";
const SECTION_LABEL = "text-[11px] font-semibold uppercase tracking-widest text-muted-foreground";

export default function NodePalette({ onAddNode, onAddAnnotation, diagramStyle, onDiagramStyleChange, outline, selectedStepId, onSelectStep, lanePanel }: NodePaletteProps) {
  const candidateActorConfig = ACTOR_CONFIG["candidate"];
  const [activeTab, setActiveTab] = useState<SidebarTab>("outline");
  // The step list is closed until it is needed. Quick Add (below the canvas) and Cmd/Ctrl+K add steps too.
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      {/* Add a step: closed by default so the panel is not a wall of node types */}
      <div className="shrink-0 border-b border-border p-2">
        <button
          type="button"
          onClick={() => setAddOpen((v) => !v)}
          aria-expanded={addOpen}
          aria-controls="add-step-list"
          className="flex min-h-11 w-full items-center gap-2 rounded-md border border-border bg-card px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add step
          <ChevronDown className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform ${addOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        {addOpen && (
          <div id="add-step-list" className="mt-2 flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            <p className="mb-1 px-1 text-[11px] text-muted-foreground">Click to add, drag to place</p>
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
                  <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                    style={{ background: config.bg, border: `1.5px solid ${config.border}` }}
                  >
                    <Icon className="h-3 w-3" style={{ color: config.border }} />
                  </div>
                  <span className="text-[13px] font-medium text-foreground/85 group-hover:text-foreground">{config.label}</span>
                </div>
              );
            })}

            {/* Candidate Action shortcut */}
            <div className="mt-2 border-t border-border/50 pt-2">
              <p className={`${SECTION_LABEL} mb-1 px-1`}>Shortcut</p>
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
              <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                style={{ background: "#FFF7ED", border: `1.5px solid ${candidateActorConfig.color}` }}
              >
                <UserCheck className="h-3 w-3" style={{ color: candidateActorConfig.color }} />
              </div>
              <span className="text-[13px] font-medium text-foreground/85 group-hover:text-foreground">Candidate Action</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs: three equal segments */}
      <div role="tablist" aria-label="Left panel" className="m-2 grid shrink-0 grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`panel-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-tabpanel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-11 rounded-md px-1 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8 ${
              activeTab === tab.id ? "bg-card text-foreground shadow-sm" : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel" id={`panel-tabpanel-${activeTab}`} aria-labelledby={`panel-tab-${activeTab}`} className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {/* ── Outline tab: the diagram as a numbered, searchable list ── */}
        {activeTab === "outline" && (
          <div className="-mx-2 h-[calc(100vh-20rem)] min-h-64">
            <OutlinePanel items={outline} selectedId={selectedStepId} commentCounts={new Map()} onSelect={onSelectStep} />
          </div>
        )}

        {/* ── Layout tab: diagram style, lanes, containers ── */}
        {activeTab === "layout" && (
          <>
            <div className="mb-2">
              <p className={`${SECTION_LABEL} mb-1`}>Diagram style</p>
              <div role="group" aria-label="Diagram style" className="flex overflow-hidden rounded-md border border-border text-xs">
                {([["process_map", "Process map"], ["classic", "Classic"]] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={diagramStyle === value}
                    onClick={() => onDiagramStyleChange(value)}
                    className={`min-h-11 flex-1 py-1.5 font-medium md:min-h-8 ${diagramStyle === value ? "bg-primary text-primary-foreground" : "bg-card text-foreground/70 hover:bg-secondary"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {diagramStyle === "process_map" && lanePanel && (
              <div className="-mx-2 mb-2">
                <LanesPanel {...lanePanel} />
              </div>
            )}

            <p className={`${SECTION_LABEL} mb-1`}>Containers</p>
            <p className="mb-1 px-1 text-[11px] text-muted-foreground">Click to add, drag to place</p>
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
                  <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                    style={{ background: type === "frame" ? "#F9FAFB" : config.bg, border: `1.5px dashed ${config.border}` }}
                  >
                    <Icon className="h-3 w-3" style={{ color: config.border }} />
                  </div>
                  <span className="text-[13px] font-medium text-foreground/85 group-hover:text-foreground">{config.label}</span>
                </div>
              );
            })}
          </>
        )}

        {/* ── Shapes tab: annotations and the connector key ── */}
        {activeTab === "shapes" && (
          <>
            <p className={`${SECTION_LABEL} mb-0.5 px-1`}>Annotations</p>
            <p className="mb-1 px-1 text-[11px] text-muted-foreground">Click to add, drag to place</p>
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
                <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                <div className="flex h-6 w-6 shrink-0 items-center justify-center">{preview}</div>
                <span className="text-xs font-medium text-foreground/85 group-hover:text-foreground">{label}</span>
              </div>
            ))}

            {/* Connector types legend */}
            <div className="mt-3 border-t border-border/50 px-1 pt-3">
              <p className={`${SECTION_LABEL} mb-2`}>Connector types</p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <svg width="40" height="12" aria-hidden>
                    <line x1="2" y1="6" x2="38" y2="6" stroke="#00BFA5" strokeWidth="2" />
                  </svg>
                  <span className="text-[11px] text-muted-foreground">Primary path</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg width="40" height="12" aria-hidden>
                    <line x1="2" y1="6" x2="38" y2="6" stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.7" />
                  </svg>
                  <span className="text-[11px] text-muted-foreground">Branch or alternate</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
