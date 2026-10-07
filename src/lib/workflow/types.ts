// ─── Node & Actor Types ─────────────────────────────────────────────

export type NodeType =
  | "stage"
  | "decision"
  | "integration"
  | "communication"
  | "parallel"
  | "wait"
  | "manual_action"
  | "source"
  | "table"
  | "swimlane"
  | "frame"
  | "annotation"
  | "dangling_endpoint"
  // Process Map style only:
  | "terminator"
  | "jump"
  | "note";

// ─── Annotation Shape Types ──────────────────────────────────────────

export type AnnotationShapeType =
  | "rect"          // Standard rectangle / box
  | "rounded-rect"  // Rounded corners box
  | "circle"        // Circle or ellipse
  | "diamond"       // Diamond (rhombus)
  | "text-label"    // Floating text only, no border
  | "divider";      // Horizontal or vertical line separator

export interface AnnotationNodeData extends Record<string, unknown> {
  isAnnotation: true;
  shape: AnnotationShapeType;
  label: string;
  fillColor: string;        // hex or 'transparent'
  borderColor: string;      // hex or 'none'
  borderStyle: "solid" | "dashed" | "none";
  fontSize: number;         // 12 | 14 | 16 | 20 | 24
  textAlign: "left" | "center" | "right";
  opacity: number;          // 0.1 to 1.0, default 1.0
  bold: boolean;
  italic: boolean;
  zIndex: number;           // default -1 so they render behind workflow nodes
}

export type WorkflowNodeType = Exclude<NodeType, "swimlane" | "frame" | "annotation" | "dangling_endpoint">;

export type ActorType =
  | "automated"
  | "manual"
  | "integration"
  | "candidate"
  | "source";

export type FeasibilityLevel = "confirmed" | "likely" | "needs_review";
export type CommunicationChannel =
  | "sms"
  | "email"
  | "whatsapp"
  | "messenger"
  | "voice"
  | "web"
  | "line";
export type CampaignType =
  | "job_application"
  | "inquiry"
  | "broadcast"
  | "onboarding"
  | "exit_interview";
export type IntegrationDirection = "push" | "pull" | "bidirectional";
export type ScopingArtifactKind =
  | "assumption"
  | "open_question"
  | "risk"
  | "decision"
  | "call_note"
  | "customer_summary";
export type ScopingArtifactStatus =
  | "open"
  | "confirmed"
  | "resolved"
  | "dismissed";
export type ScopingArtifactSeverity =
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical";
export type ScopingArtifactSource =
  | "mcp"
  | "manual"
  | "transcript"
  | "validation";

// ─── Node / Edge Data ───────────────────────────────────────────────

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  type: NodeType;
  actor?: ActorType;
  actorLabel?: string;
  notes: string;
  feasibility: FeasibilityLevel;
  feasibilityNote?: string;
  /** Staff-only notes. Never sent to clients, exports or client-side editors. `notes` stays client-visible. */
  internalNotes?: string;
  /** "internal" hides the step (and its connectors) from every client view. Default "client". */
  visibility?: "client" | "internal";
  stepNumber?: string;
  hasWarning?: boolean;
  /** True when this node exceeds the max numbering depth (depth > 3) */
  isOverflow?: boolean;
  /** True when this node is a merge point (multiple incoming edges claim it) */
  isMerge?: boolean;
  isEditingLabel?: boolean;
  customColor?: NodeCustomColor | null;
  onLabelChange?: (nodeId: string, label: string) => void;
  onOpenSuggestion?: (request: NodeSuggestionOpenRequest) => void;
  data: {
    talkpushStage?: string;
    talkpushAction?: string;
    waitDuration?: string;
    targetFolder?: string;
    channel?: CommunicationChannel;
    messageTemplate?: string;
    campaignType?: CampaignType;
    integrationSystem?: string;
    integrationDirection?: IntegrationDirection;
    ownerRole?: string;
    customFields?: Record<string, string>;
    [key: string]: string | Record<string, string> | undefined;
  };
}

export interface NodeCustomColor {
  background: string;
  border: string;
  name?: string;
}

export type PathSemantic = "happy" | "failure" | "recovery" | "neutral";

export interface WorkflowEdgeData extends Record<string, unknown> {
  label?: string;
  lineType: EdgeLineType;
  markerStart: EdgeMarkerType;
  markerEnd: EdgeMarkerType;
  strokeColor?: string;
  strokeWidth?: number;
  animated?: boolean;
  isHappyPath: boolean;   // legacy — kept for export compat; derived from pathSemantic
  isRecovery: boolean;    // legacy — kept for export compat; derived from pathSemantic
  recoveryLabel?: string;
  /** Marks this as the primary (main-flow) outgoing edge from its source node.
   * Auto-assigned on edge creation: first outgoing = true, subsequent = false.
   * Used by Re-number to give whole-number steps to the main path and decimal
   * suffixes to branch paths. Falls back to isHappyPath for backward compat. */
  isPrimary?: boolean;
  /** Semantic path classification. Drives edge color. Supersedes isHappyPath/isRecovery. */
  pathSemantic?: PathSemantic;
  /** Explicit intermediate bend points for orthogonal (step/smoothstep) edges.
   * When set, the edge routes through these points instead of using auto-routing.
   * Empty or absent = auto-routed. Populated when user drags a segment. */
  waypoints?: Array<{ x: number; y: number }>;
}

export type EdgeLineType = "bezier" | "straight" | "step" | "smoothstep";
export type EdgeMarkerType = "none" | "arrow" | "arrowclosed";

export const DEFAULT_EDGE_DATA: WorkflowEdgeData = {
  lineType: "smoothstep",
  markerStart: "none",
  markerEnd: "arrowclosed",
  strokeColor: "#6B7280",
  strokeWidth: 1,
  animated: false,
  isHappyPath: false,
  isRecovery: false,
};

export interface TableColumn {
  id: string;
  label: string;
  width?: number;
}

export interface TableNodeData {
  label: string;
  columns: TableColumn[];
  rows: Record<string, string>[];
  headerColor: string;
  compact: boolean;
}

export const DEFAULT_TABLE_DATA: TableNodeData = {
  label: "Data Table",
  columns: [
    { id: "col1", label: "Column A" },
    { id: "col2", label: "Column B" },
  ],
  rows: [
    { col1: "", col2: "" },
    { col1: "", col2: "" },
  ],
  headerColor: "#475569",
  compact: false,
};

export interface NodeSuggestionState {
  open: boolean;
  position: { x: number; y: number };
  popupPosition: { x: number; y: number };
  sourceNodeId: string | null;
  sourceNodeType: WorkflowNodeType | null;
  sourceHandle: string | null;
}

export interface NodeSuggestionOpenRequest {
  sourceNodeId: string;
  sourceNodeType: WorkflowNodeType;
  sourceHandle: string;
  clientX: number;
  clientY: number;
}

// ─── Project / Template / Feedback ──────────────────────────────────

export type WorkflowStatus =
  | "draft"
  | "shared"
  | "approved"
  | "changes_requested"
  | "modified_since_approval";

// A single page (canvas tab) inside a WorkflowProject. Each page has its
// own nodes/edges/viewport so SEs can split a workflow across multiple
// canvases (e.g. "Sourcing", "Screening", "Onboarding").
export interface WorkflowPage {
  id: string;
  name: string;
  nodes: WorkflowNodeData[];
  edges: WorkflowEdgeData[];
  viewport: { x: number; y: number; zoom: number };
}

export interface WorkflowProject {
  id: string;
  clientName: string;
  /** The company it is filed under (staff screens only). */
  account?: { id: string; name: string } | null;
  workflowName: string;
  description?: string | null;
  status: WorkflowStatus;
  templateId?: string | null;
  nodes: WorkflowNodeData[];
  edges: WorkflowEdgeData[];
  viewport: { x: number; y: number; zoom: number };
  pages?: WorkflowPage[];
  shareToken?: string | null;
  currentVersion?: number;
  /** Goes up by one on every saved change; the editor sends it back so a clash with another save is noticed. */
  revision?: number;
  /** How the diagram is drawn: the original look, or the Lucid-style Process Map. */
  diagramStyle?: "classic" | "process_map";
  /** "original" is how every map looked before the readability pass; new maps are "readable". */
  look?: "original" | "readable";
  numberingScheme?: "letters" | "decimal";
  shareVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
  feedback?: WorkflowFeedback[];
  versions?: WorkflowVersion[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string | null;
  industry: "bpo" | "retail" | "general";
  nodes: WorkflowNodeData[];
  edges: WorkflowEdgeData[];
  createdAt: string;
}

export interface WorkflowFeedback {
  id: string;
  workflowId: string;
  action: "approved" | "changes_requested";
  reviewerName: string;
  comment?: string | null;
  createdAt: string;
}

export type VersionTrigger = "status_change" | "manual" | "restore";

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  versionNumber: number;
  label?: string | null;
  status: WorkflowStatus;
  triggeredBy: VersionTrigger;
  triggerDetail?: string | null;
  createdByName?: string | null;
  nodes: WorkflowNodeData[];
  edges: WorkflowEdgeData[];
  viewport?: { x: number; y: number; zoom: number } | null;
  pages?: WorkflowPage[] | null;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
}

export interface SharedWorkflowPinnedVersion {
  versionNumber: number;
  createdAt: string;
  status: WorkflowStatus;
  label?: string | null;
}

export interface SharedWorkflowResponse extends WorkflowProject {
  pinnedVersion?: SharedWorkflowPinnedVersion | null;
}

// ─── SE Scoping Copilot ────────────────────────────────────────────

export interface WorkflowScopingArtifact {
  id: string;
  workflowId: string;
  kind: ScopingArtifactKind;
  title: string;
  detail: string;
  status: ScopingArtifactStatus;
  severity: ScopingArtifactSeverity;
  owner?: string | null;
  source: ScopingArtifactSource;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowValidationFinding {
  code: string;
  severity: ScopingArtifactSeverity;
  message: string;
  nodeId?: string;
  edgeId?: string;
  recommendation?: string;
}

export interface WorkflowSpecNodeInput {
  tempId: string;
  type: WorkflowNodeType;
  label: string;
  actor?: ActorType;
  actorLabel?: string;
  notes?: string;
  feasibility?: FeasibilityLevel;
  feasibilityNote?: string;
  position?: { x: number; y: number };
  customColor?: NodeCustomColor | null;
  data?: WorkflowNodeData["data"];
  /** Process Map settings: actionType, personActs, endKind, noteKind, jumpToNodeId, attachTo, timing... */
  extra?: Record<string, unknown>;
}

export interface WorkflowSpecEdgeInput {
  tempId?: string;
  sourceTempId: string;
  targetTempId: string;
  label?: string;
  isHappyPath?: boolean;
  isRecovery?: boolean;
  isPrimary?: boolean;
  pathSemantic?: PathSemantic;
  data?: Partial<WorkflowEdgeData>;
}

export interface WorkflowSpecArtifactInput {
  kind: ScopingArtifactKind;
  title: string;
  detail: string;
  status?: ScopingArtifactStatus;
  severity?: ScopingArtifactSeverity;
  owner?: string;
  source?: ScopingArtifactSource;
  metadata?: Record<string, unknown>;
}

export interface WorkflowSpecInput {
  clientName: string;
  workflowName: string;
  description?: string;
  nodes: WorkflowSpecNodeInput[];
  edges: WorkflowSpecEdgeInput[];
  artifacts?: WorkflowSpecArtifactInput[];
  summary?: string;
  autoLayout?: boolean;
  layoutDirection?: "TB" | "LR";
  /** Defaults to the Process Map style. */
  diagramStyle?: "classic" | "process_map";
  /** Defaults to "readable" for a new workflow. */
  look?: "original" | "readable";
}

// ─── Status Config ──────────────────────────────────────────────────

export const WORKFLOW_STATUS_CONFIG: Record<
  WorkflowStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-[#F3F4F6] text-[#6B7280]",
  },
  shared: {
    label: "Shared",
    className: "bg-blue-100 text-blue-700",
  },
  approved: {
    label: "Approved",
    className: "bg-green-600 text-white",
  },
  changes_requested: {
    label: "Changes Requested",
    className: "bg-[#FEF3C7] text-[#92400E]",
  },
  modified_since_approval: {
    label: "Changed since approval",
    className: "bg-[#FEF3C7] text-[#92400E]",
  },
};

// ─── Node Type Config ───────────────────────────────────────────────

export const NODE_TYPE_CONFIG = {
  stage: { label: "Stage", icon: "CircleDot", bg: "#F0FDFA", border: "#00BFA5" },
  decision: { label: "Decision", icon: "GitBranch", bg: "#FFFBEB", border: "#F59E0B" },
  integration: { label: "Integration", icon: "Plug", bg: "#F5F3FF", border: "#8B5CF6" },
  communication: { label: "Communication", icon: "MessageSquare", bg: "#EFF6FF", border: "#3B82F6" },
  parallel: { label: "Parallel", icon: "GitMerge", bg: "#FDF2F8", border: "#EC4899" },
  wait: { label: "Wait / Delay", icon: "Clock", bg: "#F9FAFB", border: "#6B7280" },
  manual_action: { label: "Manual Action", icon: "Hand", bg: "#FFF7ED", border: "#F97316" },
  source: { label: "Source Channel", icon: "Megaphone", bg: "#ECFDF5", border: "#10B981" },
  table: { label: "Table", icon: "Table2", bg: "#F8FAFC", border: "#475569" },
  swimlane: { label: "Swimlane", icon: "StretchHorizontal", bg: "#F0F9FF", border: "#0EA5E9" },
  frame: { label: "Frame", icon: "Square", bg: "transparent", border: "#9CA3AF" },
  terminator: { label: "End state", icon: "Flag", bg: "#ECEFF1", border: "#333333" },
  jump: { label: "Jump marker", icon: "CornerDownRight", bg: "#E1BEE7", border: "#6A1B9A" },
  note: { label: "Note", icon: "StickyNote", bg: "#FFF9C4", border: "#666666" },
} as const;

// ─── Actor Config ───────────────────────────────────────────────────

export const ACTOR_CONFIG = {
  automated: { label: "Talkpush Automation", icon: "Bot", color: "#00BFA5" },
  manual: { label: "Talkpush User", icon: "UserRound", color: "#F97316" },
  integration: { label: "Integration", icon: "Plug", color: "#8B5CF6" },
  candidate: { label: "Candidate", icon: "UserCheck", color: "#3B82F6" },
  source: { label: "Source", icon: "Megaphone", color: "#10B981" },
} as const;

// ─── Talkpush Autoflow Actions ──────────────────────────────────────

export const TALKPUSH_ACTIONS = [
  { value: "move_candidate", label: "Move Candidate" },
  { value: "create_application", label: "Create Application" },
  { value: "add_data", label: "Add Data" },
  { value: "voice_ai_call", label: "Voice AI Call" },
  { value: "assign_labels", label: "Assign Labels" },
  { value: "send_question_set", label: "Send Question Set" },
  { value: "share_profile", label: "Share Profile" },
  { value: "send_messenger", label: "Send Messenger" },
  { value: "send_email", label: "Send Email" },
  { value: "send_sms", label: "Send SMS" },
  { value: "send_whatsapp", label: "Send WhatsApp" },
  { value: "trigger_lead_scoring", label: "Trigger Lead Scoring" },
] as const;
