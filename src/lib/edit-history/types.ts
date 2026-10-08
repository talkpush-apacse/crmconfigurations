/**
 * Shared shapes for named edit links and the edit history. No server imports, so screens can use them.
 */

/** Who made a change, as the server knows it (never taken from anything the browser sends). */
export type EditActorType = "link" | "legacy_link" | "slug" | "admin" | "mcp" | "system";

export interface EditActor {
  type: EditActorType;
  /** Shown in the history. For a named link this is the link's name, copied onto each event. */
  name: string;
  /** Set only for a named link. */
  linkId?: string | null;
}

/** What the editor shows when a link has been turned off. No checklist details are given away. */
export const LINK_OFF_MESSAGE = "This link has been turned off. Ask your Talkpush contact for a new one.";
/** The second half of that message, shown under a heading that already says the link is off. */
export const LINK_OFF_HELP = "Ask your Talkpush contact for a new one.";

export const LEGACY_LINK_NAME = "Original shared link (unnamed)";
export const SLUG_LINK_NAME = "Client form link (unnamed)";
export const MCP_ACTOR_NAME = "Claude (MCP)";

export const LEGACY_ACTOR: EditActor = { type: "legacy_link", name: LEGACY_LINK_NAME };
export const SLUG_ACTOR: EditActor = { type: "slug", name: SLUG_LINK_NAME };
export const MCP_ACTOR: EditActor = { type: "mcp", name: MCP_ACTOR_NAME };

export type EditChangeType =
  | "edited"
  | "added"
  | "deleted"
  | "restored"
  | "reordered"
  | "replaced"
  | "setup"
  | "file"
  | "system"
  /** Bookkeeping, never shown: "this save looked at this section and nothing changed". */
  | "checked";

/** One change worked out from a before/after pair. Not stored until it is given an actor and a version. */
export interface DraftEvent {
  tabKey: string;
  tabLabel: string;
  rowId: string | null;
  rowLabel: string | null;
  fieldKey: string | null;
  fieldLabel: string | null;
  changeType: EditChangeType;
  summary: string;
  /** JSON-safe, already shortened. Absent when the value is hidden (passwords) or was too much to keep. */
  before?: unknown;
  after?: unknown;
  /** True when a value was cut short or left out. */
  truncated: boolean;
  /** Identifies "the same cell" for the 10-minute merge. */
  subject: string;
}

/** What a staff screen gets back for one recorded change. */
export interface EditEventRow {
  id: string;
  actorType: EditActorType;
  actorName: string;
  linkId: string | null;
  tabKey: string;
  tabLabel: string;
  rowId: string | null;
  rowLabel: string | null;
  fieldKey: string | null;
  fieldLabel: string | null;
  changeType: EditChangeType;
  summary: string;
  truncated: boolean;
  checklistVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** A named link as the staff "Edit links" screen sees it. The link text is only sent to this screen. */
export interface EditLinkRow {
  id: string;
  name: string;
  token: string;
  createdByLabel: string | null;
  createdAt: string;
  firstOpenedAt: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

/** One entry in the "who" filter. */
export interface EditPerson {
  key: string;
  label: string;
  actorType: EditActorType;
  count: number;
}

export interface EditTabOption {
  tabKey: string;
  tabLabel: string;
  count: number;
}

/** Kinds of change that one person can make again within the merge window. */
export const COALESCE_WINDOW_MS = 10 * 60 * 1000;

/** Longest single value kept (characters). AI call scripts run to a few thousand characters. */
export const MAX_VALUE_CHARS = 20_000;
/** Most cell-level changes kept for one field in one save; more than this becomes one "replaced" line. */
export const MAX_CELL_EVENTS_PER_FIELD = 25;
/** Most before/after text kept for one save, all events together. */
export const MAX_CHARS_PER_SAVE = 400_000;

/** "Who else has been changing this tab": how recent a change still counts. */
export const OTHERS_WINDOW_MS = 10 * 60 * 1000;

/** Another person who changed the tab you are on, named the way the viewer is allowed to see them. */
export interface OtherEditor {
  name: string;
  /** When their latest change to this tab was saved (ISO). */
  at: string;
}

/** What the banner is built from. */
export interface TabActivity {
  /** True when this tab was saved by someone since the page was opened, so the viewer's next save of it would be refused. */
  changedSinceYouOpened: boolean;
  /** Others who saved a change to this tab in the last 10 minutes (at most 3, newest first). Never includes the viewer. */
  others: OtherEditor[];
}
