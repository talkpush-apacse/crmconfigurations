import { computeDecimalNumbers } from "../numbering-decimal";
import { actionTypeOf, personActs, shapeKindOf } from "./model";
import { ACTION_TYPES, circled } from "./tokens";

/**
 * The flow table: the diagram written out as rows (Step, Actor, Action, Action Type, Branch / Condition). It is the
 * thing a person approves BEFORE a diagram is built, and the thing handed to the CRM configuration afterwards.
 * Derived from the diagram, so it can never drift from it.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export const FLOW_TABLE_ACTORS = ["Candidate", "Talkpush", "Recruiter", "Referrer/Vendor"] as const;

export interface FlowTableRow {
  step: string;
  /** What to draw next to the row: the circled numeral for main-path steps, the decimal for branches. */
  stepDisplay: string;
  actor: string;
  action: string;
  actionType: string;
  branch: string;
  nodeId: string;
}

export interface FlowTable {
  columns: string[];
  rows: FlowTableRow[];
  /** Steps whose actor is not one of the four standard words: worth a look, not an error. */
  unusualActors: { nodeId: string; actor: string }[];
}

function actorWord(node: any): string {
  const d = node.data ?? {};
  if (d.actor === "candidate" || actionTypeOf(node) === "candidate") return "Candidate";
  if (!personActs(node)) return "Talkpush";
  const role = String(d.actorLabel || d.data?.ownerRole || "").trim();
  if (!role) return "Recruiter";
  if (/vendor|referr/i.test(role)) return "Referrer/Vendor";
  if (/recruit/i.test(role)) return "Recruiter";
  return role;
}

export function deriveFlowTable(nodes: any[], edges: any[]): FlowTable {
  const numbering = computeDecimalNumbers(nodes, edges);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rows: FlowTableRow[] = [];
  const unusualActors: FlowTable["unusualActors"] = [];

  const numbered = nodes
    .filter((n) => numbering.stepNumbers.has(n.id) && ["process", "decision"].includes(shapeKindOf(n)))
    .map((n) => ({ n, num: numbering.stepNumbers.get(n.id)! }));
  const cmp = (a: string, b: string) => {
    const pa = a.match(/\d+/g)?.map(Number) ?? [];
    const pb = b.match(/\d+/g)?.map(Number) ?? [];
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? -1) !== (pb[i] ?? -1)) return (pa[i] ?? -1) - (pb[i] ?? -1);
    return 0;
  };
  numbered.sort((a, b) => {
    const au = a.num.startsWith("U");
    const bu = b.num.startsWith("U");
    return au !== bu ? (au ? 1 : -1) : cmp(a.num, b.num) || (a.n.position?.y ?? 0) - (b.n.position?.y ?? 0);
  });

  for (const { n, num } of numbered) {
    const kind = shapeKindOf(n);
    const type = kind === "decision" ? null : actionTypeOf(n);
    const incoming = edges.find((e) => numbering.enteredVia.get(n.id) === e.id);
    const edgeLabel = incoming ? (numbering.edgeLabels.get(incoming.id) ?? String(incoming.data?.label ?? "").trim()) : "";
    const actor = kind === "decision" ? actorWordForDecision(n) : actorWord(n);
    if (!FLOW_TABLE_ACTORS.includes(actor as (typeof FLOW_TABLE_ACTORS)[number])) unusualActors.push({ nodeId: n.id, actor });
    const spine = numbering.spineNumbers.get(n.id);
    rows.push({
      step: num,
      stepDisplay: spine !== undefined ? circled(spine) : num,
      actor,
      action: [String(n.data?.label ?? "").trim(), String(n.data?.notes ?? "").trim()].filter(Boolean).join(". "),
      actionType: type ? ACTION_TYPES[type].label : "",
      branch: edgeLabel || "—",
      nodeId: n.id,
    });
  }
  void byId;
  return { columns: ["Step", "Actor", "Action", "Action Type", "Branch / Condition"], rows, unusualActors };
}

function actorWordForDecision(node: any): string {
  const d = node.data ?? {};
  if (d.actorLabel) return actorWord({ ...node, data: { ...d, personActs: true } });
  return personActs(node) ? actorWord(node) : "Talkpush";
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV that opens cleanly in Excel (UTF-8 with a byte-order mark). */
export function flowTableCsv(table: FlowTable): string {
  const lines = [table.columns.join(",")];
  for (const r of table.rows) lines.push([r.stepDisplay, r.actor, r.action, r.actionType, r.branch].map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
