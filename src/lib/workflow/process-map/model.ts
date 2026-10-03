import { ACTION_TYPES, isActionType, type ActionType, type EndKind, type NoteKind, PM } from "./tokens";

/**
 * What a stored step MEANS in the Process Map style: its shape, its fill, its tag, its role. The fill follows who
 * does the step (never the tag): no person needed = green, a person acts = white.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type ShapeKind = "start" | "end" | "process" | "decision" | "jump" | "note" | "table" | "container" | "none";

/** Step types that exist only in the Process Map style. */
export const PROCESS_MAP_ONLY_TYPES = new Set(["terminator", "jump", "note"]);

export function shapeKindOf(node: any): ShapeKind {
  const t = node?.type ?? node?.data?.type;
  if (t === "source") return "start";
  if (t === "terminator") return "end";
  if (t === "jump") return "jump";
  if (t === "decision") return "decision";
  if (t === "note") return "note";
  if (t === "table") return "table";
  if (t === "swimlane" || t === "frame") return "container";
  if (t === "annotation" || t === "dangling_endpoint") return "none";
  return "process";
}

/** Is a person doing this step? Mixed steps (person acts, then the system does something) are still one white box. */
export function personActs(node: any): boolean {
  const d = node?.data ?? {};
  if (typeof d.personActs === "boolean") return d.personActs;
  return d.actor === "manual" || d.actor === "candidate";
}

export function fillFor(node: any): { fill: string; stroke: string; dashed: boolean; textColor: string } {
  const d = node?.data ?? {};
  const c = PM.colors;
  switch (shapeKindOf(node)) {
    case "decision":
      return { fill: c.decision, stroke: c.stroke, dashed: false, textColor: c.text };
    case "start":
      return { fill: c.person, stroke: c.stroke, dashed: false, textColor: c.text };
    case "end": {
      const kind: EndKind = d.endKind ?? "neutral";
      const fill = kind === "success" ? c.endSuccess : kind === "failure" ? c.endFailure : kind === "soft" ? c.endSoft : c.endNeutral;
      return { fill, stroke: c.stroke, dashed: false, textColor: kind === "success" ? "#FFFFFF" : c.text };
    }
    case "jump":
      return { fill: c.jump, stroke: c.jumpStroke, dashed: false, textColor: c.text };
    case "note": {
      const kind: NoteKind = d.noteKind ?? "info";
      if (kind === "rejection") return { fill: c.noteRejection, stroke: c.noteRejectionStroke, dashed: true, textColor: c.text };
      if (kind === "needs_input") return { fill: c.noteOrange, stroke: c.noteOrangeStroke, dashed: true, textColor: c.text };
      if (kind === "out_of_scope") return { fill: c.noteOutOfScope, stroke: c.noteOutOfScopeStroke, dashed: true, textColor: c.text };
      return { fill: c.note, stroke: c.noteStroke, dashed: true, textColor: c.text };
    }
    default:
      // A step that logs why someone was rejected is drawn as the pink dashed "rejection reason" box, in the flow.
      if (actionTypeOf(node) === "rejection_reason") return { fill: c.noteRejection, stroke: c.noteRejectionStroke, dashed: true, textColor: c.text };
      return personActs(node)
        ? { fill: c.person, stroke: c.stroke, dashed: false, textColor: c.text }
        : { fill: c.system, stroke: c.stroke, dashed: false, textColor: c.text };
  }
}

const TALKPUSH_ACTION_TO_TYPE: Record<string, ActionType> = {
  move_candidate: "move",
  create_application: "add_data",
  add_data: "add_data",
  voice_ai_call: "call",
  assign_labels: "add_data",
  send_question_set: "system",
  share_profile: "share_profile",
  send_messenger: "message",
  send_email: "message",
  send_sms: "message",
  send_whatsapp: "message",
  trigger_lead_scoring: "system",
};

/**
 * The Action Type of a step: the one set on it, otherwise a best guess from older data so an existing Classic
 * workflow still reads sensibly in the new style. Decisions, terminators, jumps and notes have none, and neither
 * does a genuinely manual step (a person decides or acts, nothing else).
 */
export function actionTypeOf(node: any): ActionType | null {
  const kind = shapeKindOf(node);
  if (kind !== "process") return kind === "note" && node?.data?.noteKind === "rejection" ? "rejection_reason" : null;
  const d = node?.data ?? {};
  if (isActionType(d.actionType)) return d.actionType;
  if (d.actionType === null || d.actionType === "none") return null;
  const meta = d.data ?? {};
  if (meta.talkpushAction && TALKPUSH_ACTION_TO_TYPE[meta.talkpushAction]) return TALKPUSH_ACTION_TO_TYPE[meta.talkpushAction];
  switch (d.type ?? node.type) {
    case "communication":
      return meta.ownerRole || /recruiter|handler|lead|admin/i.test(String(d.label ?? "")) ? "alert" : "message";
    case "integration":
      return meta.integrationDirection === "pull" ? "get_data" : "send_data";
    case "wait":
      return "wait";
    case "manual_action":
      return d.actor === "candidate" ? "candidate" : null;
    default:
      return personActs(node) ? null : "system";
  }
}

export function tagOf(node: any): string | null {
  const t = actionTypeOf(node);
  return t ? ACTION_TYPES[t].tag : null;
}

/** The acting role for a white box, in capitals and brackets: "[RECRUITER]". */
export function roleBracket(node: any): string | null {
  if (!personActs(node)) return null;
  const d = node?.data ?? {};
  const raw = String(d.actorLabel || d.data?.ownerRole || (d.actor === "candidate" ? "Candidate" : "")).trim();
  return raw ? `[${raw.toUpperCase()}]` : null;
}
