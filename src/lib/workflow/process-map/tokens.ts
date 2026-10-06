/**
 * The "Process Map" look: the Lucid diagrams Jolo builds for clients, as data. Colors were measured from his
 * two reference diagrams (MyPal v3, Teleperformance v5.1). Sizes are the working numbers from his Lucid skill.
 * Shared by the on-screen diagram and every export, so they cannot drift apart.
 */

/**
 * Two looks for a Process Map. A map stores which one it uses (WorkflowProject.look):
 *   "original"  the look every map had before the readability pass. Existing maps keep it, exactly.
 *   "readable"  bigger text, calmer colour, an accent main path and Inter. New maps get this.
 * All the numbers below are the "original" ones; PM_READABLE changes only what it lists.
 */
const ORIGINAL = {
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
    /** The main path and every other path. In the original look they are the same dark line. */
    accent: "#333333",
    branchLine: "#333333",
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
    /** Font sizes in px. */
    body: 11,
    small: 11,
    numeral: 15,
    branch: 9,
    edgeLabel: 13,
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
  /** The lanes grid. */
  lane: {
    colPitch: 330,
    subH: 190,
    /** Distance from the top of a sub-row to the centre of the shapes in it (leaves room for the badge above). */
    centerY: 102,
    labelW: 56,
    sidePad: 30,
    stageHead: 38,
    stageGap: 64,
    markerD: 100,
  },
  /** Connectors. Widths and arrowhead sizes; the colours are accent / branchLine above. */
  edge: {
    mainWidth: 1.25,
    branchWidth: 1.25,
    externalWidth: 1.4,
    /** Arrowhead size (an arrowhead grows with its line, so a thick line needs a smaller one). */
    mainMarker: 9,
    mainLabelBold: false,
    mainLabelAccent: false,
    labelCharW: 7.4,
    labelPad: 14,
    labelBaseline: 15,
  },
  /** Font sizes and text-width guesses for everything that is not a step box. */
  ui: {
    containerTitle: 14,
    laneName: 13,
    laneSub: 10,
    laneSubColor: "#DDE7F3",
    laneFit: 7.2,
    marker: 11,
    tabText: 12,
    tabTextY: 16,
    tabCharW: 7.6,
    keyTabW: 92,
    legendText: 11,
    titleCharW: 9.5,
    tableCaption: 13,
    tableSub: 10,
    tableHead: 11,
    tableCell: 10.5,
    tableCellY: 19,
    tableCharW: 7,
    tableLineH: 17,
    tableRowPad: 14,
    tableHeaderH: 34,
  },
  font: `"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif`,
};

export type Tokens = typeof ORIGINAL;
export type Look = "original" | "readable";
export const LOOKS: readonly Look[] = ["original", "readable"];
export const isLook = (value: unknown): value is Look => value === "original" || value === "readable";

type Patch<T> = { [K in keyof T]?: T[K] extends object ? Patch<T[K]> : T[K] };
function merge<T extends object>(base: T, patch: Patch<T>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    const current = (base as Record<string, unknown>)[key];
    out[key] = value && typeof value === "object" && current && typeof current === "object" ? merge(current as object, value as never) : value;
  }
  return out as T;
}

export const PM_ORIGINAL: Tokens = ORIGINAL;

export const PM_READABLE: Tokens = merge(ORIGINAL, {
  colors: {
    // Colour is kept for who acts and for the end states. Decisions, jump markers and the plain notes are quiet greys so the
    // eye goes to the steps; the orange "To confirm" note is the one call-out that stays loud.
    decision: "#EEF3F6",
    note: "#F5F5F5",
    noteStroke: "#9E9E9E",
    jump: "#F5F5F5",
    jumpStroke: "#757575",
    noteRejection: "#FDECEC",
    noteRejectionStroke: "#E57373",
    noteOutOfScope: "#F5F5F5",
    noteOutOfScopeStroke: "#9E9E9E",
    containerTab: "#5F6B73",
    laneLabel: "#56626B", // white text on this is about 5.8:1 (the original #8A8A8A was about 3.3:1)
    badgeData: "#00ACC1", // one badge colour for every icon
    /** The main path: thick and in the one accent colour. Every other path is thin and grey. */
    accent: "#007A87",
    branchLine: "#6B7780",
  },
  size: { processW: 264, processMinH: 96, decisionW: 290, decisionH: 160, terminatorW: 244, terminatorH: 68, jumpD: 92, noteW: 264 },
  type: { charW: 7.5, lineH: 21, body: 13, small: 12, numeral: 17, branch: 11, edgeLabel: 14, titleSize: 18, metaSize: 11 },
  layout: { spineGap: 130 },
  lane: { colPitch: 350, subH: 210, centerY: 112 },
  edge: { mainWidth: 3.2, branchWidth: 1.4, externalWidth: 1.6, mainMarker: 3.4, mainLabelBold: true, mainLabelAccent: true, labelCharW: 8.2, labelPad: 16, labelBaseline: 16 },
  ui: {
    containerTitle: 15,
    laneName: 14,
    laneSub: 11,
    laneSubColor: "#EAF1F8",
    laneFit: 7.8,
    marker: 12,
    tabText: 13,
    tabTextY: 17,
    tabCharW: 8.4,
    keyTabW: 104,
    legendText: 12,
    titleCharW: 10.5,
    tableCaption: 14,
    tableSub: 11,
    tableHead: 12,
    tableCell: 12,
    tableCellY: 21,
    tableCharW: 7.5,
    tableLineH: 19,
    tableRowPad: 16,
    tableHeaderH: 36,
  },
  font: `var(--font-inter), "Inter", system-ui, -apple-system, "Segoe UI", sans-serif`,
});

export function tokensFor(look: unknown): Tokens {
  return look === "readable" ? PM_READABLE : PM_ORIGINAL;
}

/**
 * The look that the drawing code reads right now. Everything that works out sizes, colours or positions (boxes, layout, the
 * scene, the layout check) is synchronous, so a map's look is switched on for the length of one call with `withLook` and then
 * put back. Anything that forgets to say gets the original look, which is the safe one for an existing map.
 * React components do not use this: they read the look from their scene or from `LookProvider`, because they draw later.
 */
let active: Tokens = PM_ORIGINAL;
export function withLook<R>(look: unknown, fn: () => R): R {
  const before = active;
  active = tokensFor(look);
  try {
    return fn();
  } finally {
    active = before;
  }
}

const live = <K extends keyof Tokens>(key: K): Tokens[K] => new Proxy({} as object, { get: (_t, prop) => (active[key] as Record<string | symbol, unknown>)[prop] }) as Tokens[K];

/** The tokens of the look that is switched on (see withLook). Reads like a constant: PM.colors.text, PM.size.processW. */
export const PM: Tokens = {
  colors: live("colors"),
  size: live("size"),
  type: live("type"),
  layout: live("layout"),
  lane: live("lane"),
  edge: live("edge"),
  ui: live("ui"),
  get font() {
    return active.font;
  },
};

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

/** The lanes grid numbers of the look that is switched on. */
export const LANE = PM.lane;
