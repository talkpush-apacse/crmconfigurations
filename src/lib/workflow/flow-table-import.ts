import { ACTION_TYPES, isActionType } from "./process-map/tokens";

/**
 * Builds a diagram from an APPROVED flow table (Step, Actor, Action, Action Type, Branch / Condition). The table is
 * the contract: it is shown to the person first, and only after an explicit yes is a diagram built from it.
 * Output is in the same shape `create_workflow_from_spec` takes.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface FlowRowInput {
  /** "1", "4.1", "11.1.1" or a circled numeral such as "④". */
  step: string;
  /** Candidate, Talkpush, Recruiter, Referrer/Vendor, or a role. */
  actor: string;
  action: string;
  /** An action type name or key ("Move", "add_data"); blank for a decision or a genuinely manual step. */
  actionType?: string;
  /** What leads into this row when it starts a branch ("No response"). */
  branch?: string;
  /** Default is a step; mark decisions, end states and jump markers. A question mark also makes a decision. */
  kind?: "step" | "decision" | "end" | "jump";
  endKind?: "success" | "failure" | "neutral" | "soft";
  /** For a jump: the step number it points to. */
  jumpTo?: string;
  notes?: string;
  /** When timing: for an automated message, call or alert, when it goes out ("immediately", "1 hour after", "2 days after"). */
  timing?: string;
  /** For an automated message, call or alert: the channel(s), "Email", "SMS", "Email + SMS", "WhatsApp", "Voice call". Free text is kept as typed. */
  channel?: string | string[];
  /** Lanes layout: the row this step sits in. Defaults to the actor. Free text, the client's words. */
  lane?: string;
  /** Lanes layout: the stage band this step starts. Steps after it stay in that stage until the next one that sets a stage. */
  stage?: string;
  /** Lanes layout: this step's lane is another system (assessment platform, HRIS, a vendor). */
  external?: boolean;
  /** For a Send Data or Get Data step: the other system it talks to. A lane with that name is treated as an outside system. */
  system?: string;
}

export type LayoutAsked = "auto" | "lanes" | "spine";
export interface LayoutOptions {
  layout?: string;
  /** Names of lanes that are other systems, for example ["Assessment platform", "HRIS"]. */
  externalLanes?: string[];
  /** Lane names in the order they should appear, top to bottom. Default: the order they first act. */
  laneOrder?: string[];
}
export interface LayoutChoice {
  layout: "lanes" | "spine";
  /** Plain words: why this layout was chosen, to say to the person. */
  reason: string;
  lanes: string[];
  stages: string[];
  externalLanes: string[];
  laneOrder: string[];
  /** Names given as outside systems that no step sits in: they cannot be drawn, so the person should be told. */
  unusedExternal: string[];
}

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const lk = (s: string) => s.trim().toLowerCase();

/**
 * Lanes or the single row? Asked for explicitly, or chosen automatically when the process has 3 or more different
 * actors, any outside system, or stages. Always says why.
 */
export function chooseLayout(rows: FlowRowInput[], opts: LayoutOptions = {}): LayoutChoice {
  const asked: LayoutAsked = opts.layout === "lanes" || opts.layout === "spine" ? opts.layout : "auto";
  const steps = rows.filter((r) => r.kind !== "end" && r.kind !== "jump");
  const seen = new Map<string, string>();
  for (const r of steps) {
    const name = clean(r.lane) || clean(r.actor);
    if (name && !seen.has(lk(name))) seen.set(lk(name), name);
  }
  const lanes = [...seen.values()];
  const stages: string[] = [];
  for (const r of rows) {
    const s = clean(r.stage);
    if (s && !stages.includes(s)) stages.push(s);
  }
  const external = new Map<string, string>();
  for (const n of opts.externalLanes ?? []) if (clean(n)) external.set(lk(n), clean(n));
  for (const r of steps) {
    const name = clean(r.lane) || clean(r.actor);
    if (r.external === true && name) external.set(lk(name), seen.get(lk(name)) ?? name);
  }
  // a lane named like a system a Send Data / Get Data step talks to is that system's lane
  const systems = new Set(rows.filter((r) => clean(r.system)).map((r) => lk(clean(r.system))));
  for (const l of lanes) if (systems.has(lk(l))) external.set(lk(l), l);
  const externalLanes = lanes.filter((l) => external.has(lk(l)));
  const unusedExternal = [...new Set((opts.externalLanes ?? []).map(clean).filter((n) => n && !seen.has(lk(n))))];
  const base = { lanes, stages, externalLanes, laneOrder: (opts.laneOrder ?? []).map(clean).filter(Boolean), unusedExternal };
  if (asked === "spine") return { layout: "spine", reason: "You asked for the single-row layout.", ...base };
  if (asked === "lanes") return { layout: "lanes", reason: "You asked for lanes.", ...base };
  const why: string[] = [];
  if (lanes.length >= 3) why.push(`${lanes.length} different actors (${lanes.join(", ")})`);
  if (externalLanes.length) why.push(`outside system${externalLanes.length > 1 ? "s" : ""} (${externalLanes.join(", ")})`);
  if (stages.length) why.push(`${stages.length} stage${stages.length > 1 ? "s" : ""} (${stages.join("; ")})`);
  return why.length
    ? { layout: "lanes", reason: `Lanes, because the process has ${why.join(", and ")}.`, ...base }
    : { layout: "spine", reason: `Single row, because the process has ${lanes.length} actor${lanes.length === 1 ? "" : "s"}, no outside system and no stages.`, ...base };
}

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
export function normalizeStep(step: string): string {
  const s = String(step).trim();
  return s.replace(/[①-⑳]/g, (c) => String(CIRCLED.indexOf(c) + 1)).replace(/\s+/g, "").replace(/\.$/, "");
}

function actionTypeKey(value?: string) {
  if (!value) return undefined;
  const v = value.trim().toLowerCase().replace(/[\[\]]/g, "").replace(/\s+/g, "_");
  if (isActionType(v)) return v;
  const byLabel = Object.entries(ACTION_TYPES).find(([, a]) => a.label.toLowerCase() === value.trim().toLowerCase() || a.tag.toLowerCase().replace(/[\[\]]/g, "") === value.trim().toLowerCase());
  return byLabel?.[0];
}

export interface FlowTableGraph {
  nodes: any[];
  edges: any[];
  problems: string[];
}

export function graphFromFlowTable(rows: FlowRowInput[], choice?: LayoutChoice): FlowTableGraph {
  const problems: string[] = [];
  const nodes: any[] = [];
  const edges: any[] = [];
  const lastOfGroup = new Map<string, string>(); // step key -> tempId of the last row seen with that key
  const firstOfGroup = new Map<string, string>();
  const idByStep = new Map<string, string>();
  const spineOrder: string[] = [];
  let n = 0;
  const lanesOn = choice?.layout === "lanes";
  const laneDisplay = new Map<string, string>();
  for (const l of choice?.lanes ?? []) laneDisplay.set(lk(l), l);
  const externalKeys = new Set((choice?.externalLanes ?? []).map(lk));
  const rankOf = new Map((choice?.laneOrder ?? []).map((l, i) => [lk(l), i]));
  /** lane / stage / outside-system fields for a row, only when the diagram is drawn as lanes */
  const laneFields = (row: FlowRowInput): Record<string, unknown> => {
    if (!lanesOn) return {};
    const out: Record<string, unknown> = {};
    if (row.kind !== "end" && row.kind !== "jump") {
      const name = clean(row.lane) || clean(row.actor);
      if (name) {
        const shown = laneDisplay.get(lk(name)) ?? name;
        out.lane = shown;
        if (externalKeys.has(lk(shown))) out.laneKind = "external";
        if (rankOf.has(lk(shown))) out.laneRank = rankOf.get(lk(shown));
      }
    }
    if (clean(row.stage)) out.stage = clean(row.stage);
    return out;
  };

  const isMain = (key: string) => /^\d+$/.test(key);
  const parentKey = (key: string) => key.split(".").slice(0, -1).join(".");
  const channelOf = (row: FlowRowInput) => (Array.isArray(row.channel) ? row.channel.map((c) => String(c).trim()).filter(Boolean).join(" + ") : String(row.channel ?? "").trim());
  /** The connector label for a row: its branch text without a leading step number ("3.1 · No" -> "No"). */
  const branchLabel = (row: FlowRowInput) => String(row.branch ?? "").replace(/^\s*\d+(\.\d+)*\s*[·.\-:]?\s*/, "").trim();

  for (const row of rows) {
    const key = normalizeStep(row.step);
    if (!key) {
      problems.push(`A row has no step number ("${row.action}").`);
      continue;
    }
    n += 1;
    const tempId = `r${n}`;
    const actor = String(row.actor ?? "").trim();
    const actionKey = actionTypeKey(row.actionType);
    const isDecision = row.kind === "decision" || (row.kind !== "end" && row.kind !== "jump" && /\?\s*$/.test(row.action));
    const isCandidate = /^candidate$/i.test(actor);
    const isSystem = /^(talkpush|system|automation|automated)$/i.test(actor);
    const person = !isSystem && !isDecision && row.kind !== "end" && row.kind !== "jump";

    let node: any;
    if (row.kind === "end") node = { tempId, type: "terminator", label: row.action, endKind: row.endKind ?? "neutral", ...laneFields(row) };
    else if (row.kind === "jump") node = { tempId, type: "jump", label: "Go to step", jumpToNodeId: row.jumpTo ? normalizeStep(row.jumpTo) : "", ...laneFields(row) };
    else if (isDecision) node = { tempId, type: "decision", label: row.action, actor: isSystem || !actor ? "automated" : "manual", ...(actor && !isSystem ? { actorLabel: actor } : {}), ...laneFields(row) };
    else {
      const type = actionKey === "message" || actionKey === "alert" ? "communication" : actionKey === "send_data" || actionKey === "get_data" ? "integration" : actionKey === "wait" ? "wait" : person ? "manual_action" : "stage";
      node = {
        tempId,
        type,
        label: row.action,
        notes: row.notes ?? "",
        actor: isCandidate ? "candidate" : person ? "manual" : "automated",
        actorLabel: person ? actor : "",
        personActs: person,
        ...(actionKey ? { actionType: actionKey } : person ? { actionType: null } : {}),
        ...(row.timing ? { timing: row.timing } : {}),
        ...(channelOf(row) || clean(row.system) ? { data: { ...(channelOf(row) ? { channel: channelOf(row) } : {}), ...(clean(row.system) ? { integrationSystem: clean(row.system) } : {}) } } : {}),
        ...laneFields(row),
      };
    }
    nodes.push(node);
    if (!idByStep.has(key)) idByStep.set(key, tempId);

    // connect to what comes before
    const isFirstInGroup = !lastOfGroup.has(key);
    if (isFirstInGroup && isMain(key)) {
      const prev = spineOrder[spineOrder.length - 1];
      if (prev) edges.push({ sourceTempId: prev, targetTempId: tempId, isPrimary: true, isHappyPath: true, label: branchLabel(row) });
      spineOrder.push(tempId);
    } else if (isFirstInGroup) {
      const parentGroupKey = parentKey(key);
      const parent = isMain(parentGroupKey) ? idByStep.get(parentGroupKey) : lastOfGroup.get(parentGroupKey);
      if (!parent) problems.push(`Step ${key} ("${row.action}") has no step ${parentGroupKey} to branch from.`);
      else edges.push({ sourceTempId: parent, targetTempId: tempId, label: branchLabel(row) });
      firstOfGroup.set(key, tempId);
    } else {
      edges.push({ sourceTempId: lastOfGroup.get(key)!, targetTempId: tempId, label: "" });
    }
    lastOfGroup.set(key, tempId);
  }

  // jump targets are given as step numbers; point them at the step they name
  for (const node of nodes) {
    if (node.type === "jump" && node.jumpToNodeId) {
      const target = idByStep.get(node.jumpToNodeId);
      if (target) node.jumpToNodeId = target;
      else {
        problems.push(`A jump points to step ${node.jumpToNodeId}, which is not in the table.`);
        node.jumpToNodeId = "";
      }
    }
  }
  return { nodes, edges, problems };
}
