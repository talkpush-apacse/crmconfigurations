/**
 * The "Process Map" look: the Lucid diagrams Jolo builds for clients, as data. Colors were measured from his
 * two reference diagrams (MyPal v3, Teleperformance v5.1). Sizes are the working numbers from his Lucid skill.
 * Shared by the on-screen diagram and every export, so they cannot drift apart.
 */

export const PM = {
  colors: {
    system: "#C8E6C9",
    person: "#FFFFFF",
    decision: "#BBDEFB",
    note: "#FFF9C4",
    noteStroke: "#666666",
    jump: "#E1BEE7",
    jumpStroke: "#6A1B9A",
    endSuccess: "#2E7D32",
    endFailure: "#EF9A9A",
    endNeutral: "#ECEFF1",
    endSoft: "#C8E6C9",
    noteOrange: "#FFE0B2",
    noteOrangeStroke: "#EF6C00",
    noteRejection: "#FFCDD2",
    noteRejectionStroke: "#C62828",
    noteOutOfScope: "#ECEFF1",
    noteOutOfScopeStroke: "#78909C",
    stroke: "#333333",
    muted: "#757575",
    tableHeader: "#ECEFF1",
    tableHighlight: "#FFE0B2",
    containerBorder: "#CFCFCF",
    containerTab: "#8A8A8A",
    containerTabText: "#1A1A1A",
    laneA: "#FAFAFA",
    laneB: "#F3F3F3",
    laneExternal: "#E3EAF2",
    laneLabel: "#8A8A8A",
    laneLabelExternal: "#37608F",
    stageHead: "#546E7A",
    externalLine: "#1565C0",
    badgeSystem: "#00ACC1", // cyan: people / gear
    badgeData: "#7E57C2", // purple: tag / message
    text: "#1A1A1A",
    line: "#333333",
  },
  size: {
    processW: 240,
    processMinH: 90,
    decisionW: 260,
    decisionH: 150,
    terminatorW: 220,
    terminatorH: 64,
    jumpD: 84,
    noteW: 240,
    badgeH: 40,
    tabH: 24,
  },
  type: {
    /** px per character used to decide where a line breaks (the skill's formula). */
    charW: 7,
    lineH: 18,
    pad: 16,
    titleSize: 16,
    metaSize: 9,
  },
  layout: {
    /** Horizontal gap between boxes on the main path: about half a box width. */
    spineGap: 120,
    /** Vertical gap in a stacked branch chain; at least 100 so a badge never sits on the connector above. */
    chainGap: 110,
    /** Space between the decision and the first shape of a branch. */
    dropGap: 110,
    /** Space between side-by-side branches. */
    branchGap: 70,
    containerPad: 90,
    containerGap: 70,
  },
} as const;

export type EndKind = "success" | "failure" | "neutral" | "soft";
export type NoteKind = "info" | "rejection" | "needs_input" | "out_of_scope";

export type ActionType =
  | "candidate"
  | "move"
  | "call"
  | "ai"
  | "message"
  | "alert"
  | "system"
  | "add_data"
  | "read_data"
  | "get_data"
  | "send_data"
  | "rejection_reason"
  | "export"
  | "share_profile"
  | "wait";

/** Strict 1:1 between Action Type, bracket tag and icon (spec appendix A). `icon` names a lucide-react icon. */
export const ACTION_TYPES: Record<ActionType, { tag: string; label: string; icon: string; group: "person" | "data" | "system"; use: string }> = {
  candidate: { tag: "[CANDIDATE]", label: "Candidate", icon: "Users", group: "person", use: "The candidate answers, submits or chooses. Takes precedence even when AI facilitates." },
  move: { tag: "[MOVE]", label: "Move", icon: "FolderInput", group: "system", use: "Any folder move, including an automatic move to Rejected. Never [SYSTEM]." },
  call: { tag: "[CALL]", label: "Call", icon: "Phone", group: "system", use: "A phone call or a retry." },
  ai: { tag: "[AI]", label: "AI interview", icon: "Bot", group: "system", use: "An AI-conducted interview only (a chatbot prescreening is [SYSTEM])." },
  message: { tag: "[MESSAGE]", label: "Message", icon: "MessageSquare", group: "data", use: "An email or SMS to a candidate or other outside person." },
  alert: { tag: "[ALERT]", label: "Alert", icon: "MessageSquare", group: "data", use: "A system notification to an internal person (handler, lead, recruiter, super admin)." },
  system: { tag: "[SYSTEM]", label: "System", icon: "Cog", group: "system", use: "Any other automated step (never a folder move)." },
  add_data: { tag: "[Add Data]", label: "Add data", icon: "Tag", group: "data", use: "Writing an attribute, assigning a label or owner, creating a profile." },
  read_data: { tag: "[READ DATA]", label: "Read data", icon: "Search", group: "system", use: "Reading an existing attribute, internal only." },
  get_data: { tag: "[GET DATA]", label: "Get data", icon: "Download", group: "system", use: "Pull from an outside system into Talkpush." },
  send_data: { tag: "[SEND DATA]", label: "Send data", icon: "ArrowLeftRight", group: "system", use: "Push from Talkpush to an outside system." },
  rejection_reason: { tag: "[REJECTION REASON]", label: "Rejection reason", icon: "Tag", group: "data", use: "The reason logged on a rejection (red dashed note)." },
  export: { tag: "[EXPORT]", label: "Export", icon: "Table", group: "system", use: "A data export." },
  share_profile: { tag: "[SHARE PROFILE]", label: "Share profile", icon: "Share2", group: "system", use: "Sharing a candidate profile." },
  wait: { tag: "[WAIT]", label: "Wait", icon: "Clock", group: "system", use: "A pure delay drawn as its own step." },
};

export const ACTION_TYPE_KEYS = Object.keys(ACTION_TYPES) as ActionType[];

export function isActionType(value: unknown): value is ActionType {
  return typeof value === "string" && value in ACTION_TYPES;
}

/** Circled numerals: 1-20 are ①-⑳, 21-35 are ㉑-㉟, 36-50 are ㊱-㊿, then "(51)". */
export function circled(n: number): string {
  if (n >= 1 && n <= 20) return String.fromCodePoint(0x2460 + n - 1);
  if (n >= 21 && n <= 35) return String.fromCodePoint(0x3251 + n - 21);
  if (n >= 36 && n <= 50) return String.fromCodePoint(0x32b1 + n - 36);
  return `(${n})`;
}
