import { stripInline } from "./process-map/inline-text";
import { actionTypeOf, personActs, shapeKindOf } from "./process-map/model";
import { computeDecimalNumbers } from "./numbering-decimal";
import { usesLanes } from "./process-map/lane-mode";
import { computeLaneGrid } from "./process-map/lanes";

/**
 * The TA / BPO gap check: questions a recruitment process usually has to answer, asked of THIS diagram. It is rules,
 * not guesswork, and it labels how sure it is. Output is for the person scoping, never text inside a diagram shape.
 *   blocker    = list it and stop: the diagram cannot be built or configured honestly without an answer
 *   assumption = say what you assumed and what changes if it is wrong
 *   nice       = worth knowing
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type GapTier = "blocker" | "assumption" | "nice";

export interface GapFinding {
  tier: GapTier;
  code: string;
  group: "structure" | "operations" | "compliance" | "talkpush";
  message: string;
  /** For assumptions: "Assumed X because Y. If incorrect, Z changes." */
  assumption?: string;
  nodeId?: string;
  confidence: "high" | "medium" | "low";
}

const TERMINAL_KINDS = new Set(["end", "jump", "note", "table", "container", "none"]);
const lbl = (n: any) => stripInline(String(n.data?.label ?? ""));
const text = (n: any) => `${n.data?.label ?? ""} ${n.data?.notes ?? ""}`.toLowerCase();
const has = (nodes: any[], re: RegExp) => nodes.some((n) => re.test(text(n)));
const TIME_WORDS = /\b(minutes?|hours?|days?|weeks?|working day|same day|next day|within|before|after|\d+\s*(h|hr|hrs|d)\b)/i;
/** True when an information note attached to this step states a time. An orange "To confirm" note does not count: it says the time is not known yet. */
const hasTimingNote = (nodes: any[], stepId: string) =>
  nodes.some((x) => shapeKindOf(x) === "note" && x.data?.attachTo === stepId && x.data?.noteKind !== "needs_input" && TIME_WORDS.test(text(x)));

export function runGapCheck(nodes: any[], edges: any[]): GapFinding[] {
  const out: GapFinding[] = [];
  const flow = nodes.filter((n) => !["annotation", "dangling_endpoint"].includes(n.type));
  const steps = flow.filter((n) => shapeKindOf(n) === "process" || shapeKindOf(n) === "decision");
  const outgoing = new Map<string, any[]>();
  for (const e of edges) outgoing.set(e.source, [...(outgoing.get(e.source) ?? []), e]);

  // ---- structure ---------------------------------------------------------------------------------------
  if (!flow.some((n) => n.type === "source")) {
    out.push({ tier: "blocker", code: "trigger_ambiguous", group: "structure", confidence: "high", message: "Nothing says how a candidate enters this process (no entry channel)." });
  }
  for (const n of flow.filter((x) => x.type === "decision")) {
    const list = (outgoing.get(n.id) ?? []).filter((e) => !e.data?.isRecovery);
    if (list.length >= 2 && list.some((e) => !String(e.data?.label ?? e.label ?? "").trim())) {
      out.push({ tier: "assumption", code: "decision_criteria_missing", group: "structure", nodeId: n.id, confidence: "high", message: `"${lbl(n)}" has paths without a label, so the decision rule is unclear.`, assumption: `Assumed the unlabeled path is the default. If incorrect, the rule for "${lbl(n)}" needs to be written down.` });
    }
  }
  for (const n of steps) {
    const type = actionTypeOf(n);
    if (n.type === "integration" || type === "send_data" || type === "get_data") {
      if (!n.data?.data?.integrationSystem) {
        out.push({ tier: "assumption", code: "integration_mechanism_missing", group: "structure", nodeId: n.id, confidence: "medium", message: `"${lbl(n)}" talks to another system but does not say which one or how (API, file, manual).`, assumption: "Assumed an API call. If incorrect, the build effort and the owner of the hand-off change." });
      }
    }
    if (shapeKindOf(n) === "process" && personActs(n) && !(n.data?.actorLabel || n.data?.data?.ownerRole)) {
      out.push({ tier: "assumption", code: "ownership_gap", group: "structure", nodeId: n.id, confidence: "high", message: `Nobody is named as responsible for "${lbl(n)}".`, assumption: "Assumed the recruiter does it. If incorrect, the role in brackets and any assignment rule change." });
    }
  }
  for (const n of flow) {
    const kind = shapeKindOf(n);
    if (TERMINAL_KINDS.has(kind) || n.type === "source") continue;
    if ((outgoing.get(n.id) ?? []).length === 0) {
      out.push({ tier: "blocker", code: "dead_end", group: "structure", nodeId: n.id, confidence: "high", message: `"${lbl(n)}" leads nowhere: it is neither an end state nor connected to a next step.` });
    }
  }
  for (const n of flow.filter((x) => x.type === "parallel")) {
    if ((outgoing.get(n.id) ?? []).length < 2) {
      out.push({ tier: "nice", code: "parallel_ambiguous", group: "structure", nodeId: n.id, confidence: "medium", message: `"${lbl(n)}" is marked as parallel but has fewer than two paths. Is it parallel or sequential?` });
    }
  }

  // ---- lanes: an outside system the process sends data to but never hears back from -------------------------------
  if (usesLanes(nodes)) {
    const grid = computeLaneGrid(nodes, edges);
    for (const lane of grid.laneOrder.filter((l) => grid.externalLanes.has(l.toLowerCase()))) {
      const inLane = flow.filter((n) => grid.laneOf.get(n.id)?.toLowerCase() === lane.toLowerCase());
      const returns = edges.some((e) => grid.laneOf.get(e.source)?.toLowerCase() === lane.toLowerCase() && grid.laneOf.has(e.target) && grid.laneOf.get(e.target)?.toLowerCase() !== lane.toLowerCase());
      if (inLane.length > 0 && !returns) {
        out.push({ tier: "nice", code: "external_lane_no_return", group: "structure", nodeId: inLane[0].id, confidence: "medium", message: `Information goes to "${lane}" but nothing comes back from it. Does it return a result, an ID or a status?` });
      }
    }
  }

  // ---- operations --------------------------------------------------------------------------------------
  for (const n of steps) {
    if (shapeKindOf(n) === "process" && personActs(n) && n.data?.actor !== "candidate" && !n.data?.timing && !n.data?.data?.waitDuration && !hasTimingNote(flow, n.id)) {
      out.push({ tier: "assumption", code: "sla_missing", group: "operations", nodeId: n.id, confidence: "medium", message: `No turnaround time is given for the manual step "${lbl(n)}".`, assumption: "Assumed the person acts within one working day. If incorrect, add the real time and a reminder path." });
    }
    const commType = actionTypeOf(n);
    if (shapeKindOf(n) === "process" && !personActs(n) && (commType === "message" || commType === "alert" || commType === "call" || commType === "ai" || n.type === "communication")) {
      const noChannel = !String(n.data?.data?.channel ?? "").trim();
      const noTiming = !String(n.data?.timing ?? "").trim() && !n.data?.data?.waitDuration && !hasTimingNote(flow, n.id);
      if (noChannel || noTiming) {
        const missing = noChannel && noTiming ? "which channel it uses or when it goes out" : noChannel ? "which channel it uses" : "when it goes out";
        const guess = [noChannel ? "by email" : "", noTiming ? "straight away" : ""].filter(Boolean).join(" and ");
        out.push({ tier: "assumption", code: "comm_channel_or_timing_missing", group: "operations", nodeId: n.id, confidence: "high", message: `"${lbl(n)}" goes out automatically but does not say ${missing}.`, assumption: `Assumed it is sent ${guess}. If incorrect, the message template, channel setup and any delay or reminder timing change.` });
      }
    }
    const type = actionTypeOf(n);
    if ((type === "send_data" || type === "get_data" || type === "call") && (outgoing.get(n.id) ?? []).length <= 1) {
      out.push({ tier: "assumption", code: "exception_path_missing", group: "operations", nodeId: n.id, confidence: "medium", message: `"${lbl(n)}" has no path for when it fails (outside system down, no answer, partial data).`, assumption: "Assumed it always succeeds. If incorrect, a failure path and an owner are needed." });
    }
  }
  const numbering = computeDecimalNumbers(flow, edges);
  for (const id of numbering.joinEdges) {
    const e = edges.find((x) => x.id === id);
    if (!e) continue;
    const target = numbering.spineOrder.indexOf(e.target);
    const source = numbering.spineOrder.indexOf(e.source);
    const loopsBack = target >= 0 && (source < 0 || target <= source);
    if (loopsBack && !has(flow, /\b(max|maximum|up to|at most|limit|cap)\b|\b\d+\s*(times|attempts|retries|tries)\b/)) {
      out.push({ tier: "blocker", code: "uncapped_loop", group: "operations", nodeId: e.source, confidence: "medium", message: "A path loops back to an earlier step and nothing limits how many times. A candidate could go round forever.", assumption: "Recommend a maximum number of retries, a cooldown, and an automatic outcome after that." });
      break;
    }
  }
  if (steps.length >= 6 && !has(flow, /volume|per (day|week|month)|\b\d+\s*(candidates|applicants|applications)\b/)) {
    out.push({ tier: "nice", code: "volume_unknown", group: "operations", confidence: "low", message: "The expected volume is not stated anywhere. It affects limits, scheduling and staffing." });
  }

  // ---- compliance --------------------------------------------------------------------------------------
  const voiceAi = flow.filter((n) => actionTypeOf(n) === "ai" || actionTypeOf(n) === "call" || n.data?.data?.talkpushAction === "voice_ai_call" || /voice ai|ai interview|ai call/.test(text(n)));
  if (voiceAi.length && !has(flow, /disclos|consent|recorded|recording|ai assistant|tell(s)? the candidate.*ai/)) {
    out.push({ tier: "blocker", code: "voice_ai_no_disclosure", group: "compliance", nodeId: voiceAi[0].id, confidence: "medium", message: "A voice or AI step has no earlier step that tells the candidate it is AI or asks for recording consent." });
  }
  const collectsData = steps.some((n) => actionTypeOf(n) === "add_data" || actionTypeOf(n) === "candidate");
  if (collectsData && !has(flow, /consent|privacy|data protection|terms/)) {
    out.push({ tier: "assumption", code: "data_consent_missing", group: "compliance", confidence: "low", message: "Nothing in this process captures consent to use the candidate's data.", assumption: "Assumed consent is captured on the application form before this flow starts. If incorrect, add a consent step before the first data is stored." });
  }

  // ---- usual Talkpush patterns --------------------------------------------------------------------------
  if (has(flow, /prescreen|pre-screen|screening/) && !has(flow, /reminder|follow.?up|drop.?off|no response|unresponsive/)) {
    out.push({ tier: "nice", code: "prescreening_dropoff_recovery", group: "talkpush", confidence: "medium", message: "There is a screening step but no recovery for candidates who stop replying (usual: reminders at 1H, 3H, 24H, 36H, 48H, 72H, then Unresponsive after 15 days)." });
  }
  if (has(flow, /schedul|book|interview slot/) && !has(flow, /no.?show|reminder|reschedul/)) {
    out.push({ tier: "nice", code: "no_show_recovery", group: "talkpush", confidence: "medium", message: "Interviews are scheduled but there is no reminder or no-show recovery (usual: a reminder 48 hours before, with a fresh booking link)." });
  }
  if (has(flow, /reprofil|re-profil/) && !has(flow, /max|up to|\b3\b/)) {
    out.push({ tier: "nice", code: "reprofiling_cap", group: "talkpush", confidence: "low", message: "Reprofiling is mentioned without a limit (often capped at 3). Confirm the limit with the client." });
  }
  const rank = { blocker: 0, assumption: 1, nice: 2 } as const;
  return out.sort((a, b) => rank[a.tier] - rank[b.tier]);
}

export function summarizeGaps(findings: GapFinding[]) {
  return {
    blockers: findings.filter((f) => f.tier === "blocker").length,
    assumptions: findings.filter((f) => f.tier === "assumption").length,
    nice: findings.filter((f) => f.tier === "nice").length,
  };
}
