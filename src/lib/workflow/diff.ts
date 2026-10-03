/**
 * "What changed between two versions", in plain language first and structure second. Used to show someone what the
 * workflow looks like now compared with what they approved, and before Claude overwrites anything a person edited.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DiffPage {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
}

export interface VersionDiff {
  added: { nodeId: string; label: string; page: string }[];
  removed: { nodeId: string; label: string; page: string }[];
  changed: { nodeId: string; label: string; page: string; fields: { field: string; from: unknown; to: unknown }[] }[];
  moved: number;
  edgesAdded: { edgeId: string; from: string; to: string; label: string }[];
  edgesRemoved: { edgeId: string; from: string; to: string; label: string }[];
  pagesAdded: string[];
  pagesRemoved: string[];
  /** Short sentences a person can read. */
  lines: string[];
  identical: boolean;
}

const COMPARED = ["label", "notes", "actorLabel", "actor", "type", "actionType", "personActs", "endKind", "noteKind", "timing", "jumpToNodeId", "feasibility", "visibility"];
const FRIENDLY: Record<string, string> = { label: "name", notes: "notes", actorLabel: "who does it", actor: "actor", type: "kind of step", actionType: "tag", personActs: "whether a person acts", endKind: "kind of ending", noteKind: "kind of note", timing: "timing", jumpToNodeId: "jump target", feasibility: "feasibility", visibility: "who can see it" };

export function diffPages(before: DiffPage[], after: DiffPage[]): VersionDiff {
  const out: VersionDiff = { added: [], removed: [], changed: [], moved: 0, edgesAdded: [], edgesRemoved: [], pagesAdded: [], pagesRemoved: [], lines: [], identical: true };
  const beforeById = new Map(before.map((p) => [p.id, p]));
  const afterById = new Map(after.map((p) => [p.id, p]));
  out.pagesAdded = after.filter((p) => !beforeById.has(p.id)).map((p) => p.name);
  out.pagesRemoved = before.filter((p) => !afterById.has(p.id)).map((p) => p.name);
  const labelOf = (n: any) => String(n?.data?.label ?? n?.id ?? "");

  for (const page of after) {
    const old = beforeById.get(page.id);
    const oldNodes = new Map((old?.nodes ?? []).map((n: any) => [n.id, n]));
    const newNodes = new Map(page.nodes.map((n: any) => [n.id, n]));
    for (const n of page.nodes) {
      const prev = oldNodes.get(n.id);
      if (!prev) {
        out.added.push({ nodeId: n.id, label: labelOf(n), page: page.name });
        continue;
      }
      const fields = COMPARED.filter((f) => JSON.stringify(prev.data?.[f] ?? prev[f] ?? null) !== JSON.stringify(n.data?.[f] ?? n[f] ?? null)).map((f) => ({ field: f, from: prev.data?.[f] ?? prev[f], to: n.data?.[f] ?? n[f] }));
      if (fields.length) out.changed.push({ nodeId: n.id, label: labelOf(n), page: page.name, fields });
      if (Math.abs((prev.position?.x ?? 0) - (n.position?.x ?? 0)) > 2 || Math.abs((prev.position?.y ?? 0) - (n.position?.y ?? 0)) > 2) out.moved += 1;
    }
    for (const n of old?.nodes ?? []) if (!newNodes.has(n.id)) out.removed.push({ nodeId: n.id, label: labelOf(n), page: page.name });

    const oldEdges = new Map((old?.edges ?? []).map((e: any) => [e.id, e]));
    const newEdgeIds = new Set(page.edges.map((e: any) => e.id));
    const name = (nodes: any[], id: string) => labelOf(nodes.find((n) => n.id === id) ?? { id });
    for (const e of page.edges) if (!oldEdges.has(e.id)) out.edgesAdded.push({ edgeId: e.id, from: name(page.nodes, e.source), to: name(page.nodes, e.target), label: String(e.data?.label ?? "") });
    for (const e of old?.edges ?? []) if (!newEdgeIds.has(e.id)) out.edgesRemoved.push({ edgeId: e.id, from: name(old!.nodes, e.source), to: name(old!.nodes, e.target), label: String(e.data?.label ?? "") });
  }
  for (const page of before) {
    if (afterById.has(page.id)) continue;
    for (const n of page.nodes) out.removed.push({ nodeId: n.id, label: labelOf(n), page: page.name });
  }

  const quote = (s: string) => `"${s}"`;
  for (const p of out.pagesAdded) out.lines.push(`Page ${quote(p)} was added.`);
  for (const p of out.pagesRemoved) out.lines.push(`Page ${quote(p)} was removed.`);
  for (const a of out.added) out.lines.push(`Added the step ${quote(a.label)}.`);
  for (const r of out.removed) out.lines.push(`Removed the step ${quote(r.label)}.`);
  for (const c of out.changed) out.lines.push(`Changed ${quote(c.label)}: ${c.fields.map((f) => FRIENDLY[f.field] ?? f.field).join(", ")}.`);
  if (out.moved) out.lines.push(`${out.moved} step${out.moved === 1 ? " was" : "s were"} moved.`);
  for (const e of out.edgesAdded) out.lines.push(`Connected ${quote(e.from)} to ${quote(e.to)}${e.label ? ` (${e.label})` : ""}.`);
  for (const e of out.edgesRemoved) out.lines.push(`Disconnected ${quote(e.from)} from ${quote(e.to)}.`);
  out.identical = out.lines.length === 0;
  if (out.identical) out.lines.push("No differences.");
  return out;
}
