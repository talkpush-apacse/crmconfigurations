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
  timing?: string;
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

export function graphFromFlowTable(rows: FlowRowInput[]): FlowTableGraph {
  const problems: string[] = [];
  const nodes: any[] = [];
  const edges: any[] = [];
  const lastOfGroup = new Map<string, string>(); // step key -> tempId of the last row seen with that key
  const firstOfGroup = new Map<string, string>();
  const idByStep = new Map<string, string>();
  const spineOrder: string[] = [];
  let n = 0;

  const isMain = (key: string) => /^\d+$/.test(key);
  const parentKey = (key: string) => key.split(".").slice(0, -1).join(".");
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
    if (row.kind === "end") node = { tempId, type: "terminator", label: row.action, endKind: row.endKind ?? "neutral" };
    else if (row.kind === "jump") node = { tempId, type: "jump", label: "Go to step", jumpToNodeId: row.jumpTo ? normalizeStep(row.jumpTo) : "" };
    else if (isDecision) node = { tempId, type: "decision", label: row.action, actor: isSystem || !actor ? "automated" : "manual", ...(actor && !isSystem ? { actorLabel: actor } : {}) };
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
