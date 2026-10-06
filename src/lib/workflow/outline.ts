import { stripInline } from "./process-map/inline-text";
/**
 * The "outline": the diagram as a numbered list. It is the phone-friendly and screen-reader-friendly way to read a
 * workflow, and the base of the client's "walk me through this flow" mode. Pure functions, no screen code.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface OutlineItem {
  nodeId: string;
  /** "3", "3a", "3a.1", "U1" or "" for steps without a number (such as the entry channel). */
  number: string;
  label: string;
  /** How deep the number is: 0 for "3", 1 for "3a", 2 for "3a.1". Drives indentation. */
  depth: number;
  type: string;
  actorLabel: string;
  notes: string;
}

const ANNOTATION_TYPES = new Set(["annotation", "dangling_endpoint", "swimlane", "frame", "jump"]);

/** Splits "3a.1" into comparable parts: [3, "a", 1]. Whole numbers sort numerically, letters alphabetically. */
function parts(label: string): (number | string)[] {
  return label.match(/\d+|[a-zA-Z]+/g)?.map((p) => (/^\d+$/.test(p) ? Number(p) : p.toLowerCase())) ?? [];
}

export function compareStepNumbers(a: string, b: string): number {
  const ua = a.startsWith("U");
  const ub = b.startsWith("U");
  if (ua !== ub) return ua ? 1 : -1; // unconnected steps go last
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x - y;
    return String(x) < String(y) ? -1 : 1;
  }
  return 0;
}

function depthOf(label: string): number {
  if (!label || label.startsWith("U")) return 0;
  return Math.max(0, parts(label).length - 1);
}

export function buildOutline(nodes: any[], stepNumbers: Map<string, string>): OutlineItem[] {
  const items: OutlineItem[] = nodes
    .filter((n) => !ANNOTATION_TYPES.has(n.type) && !n.data?.isAnnotation)
    .map((n) => {
      const number = stepNumbers.get(n.id) ?? "";
      return {
        nodeId: n.id,
        number,
        label: stripInline(String(n.data?.label ?? "")),
        depth: depthOf(number),
        type: String(n.data?.type ?? n.type ?? ""),
        actorLabel: String(n.data?.actorLabel ?? ""),
        notes: String(n.data?.notes ?? ""),
      };
    });
  // The entry channel first, then steps by number, then unnumbered ones (end states, notes) last.
  const rank = (i: OutlineItem) => (i.type === "source" ? 0 : i.number ? 1 : 2);
  return items.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (rank(a) === 1) return compareStepNumbers(a.number, b.number);
    return a.label.localeCompare(b.label);
  });
}

export function filterOutline(items: OutlineItem[], query: string): OutlineItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((i) => [i.number, i.label, i.actorLabel, i.notes, i.type].some((t) => t.toLowerCase().includes(q)));
}

// ---- walk-through ------------------------------------------------------------------------------------

export interface WalkChoice {
  edgeId: string;
  targetId: string;
  label: string;
  /** The "things went well" direction: shown first and as the default "Next". */
  isMain: boolean;
}

/** Where can you go from here? The main path first, then branches, then paths that loop back. */
export function walkChoices(nodeId: string, edges: any[]): WalkChoice[] {
  const rank = (e: any) => {
    const d = e.data ?? {};
    if (d.isPrimary === true) return 0;
    if (d.pathSemantic === "happy" || d.isHappyPath === true) return 1;
    if (d.pathSemantic === "recovery" || d.isRecovery === true) return 4;
    if (d.pathSemantic === "failure") return 3;
    return 2;
  };
  return edges
    .filter((e) => e.source === nodeId)
    .map((e) => ({ e, r: rank(e) }))
    .sort((a, b) => a.r - b.r)
    .map(({ e, r }, i) => ({
      edgeId: e.id,
      targetId: e.target,
      label: String(e.data?.label ?? e.label ?? ""),
      isMain: i === 0 && r <= 2,
    }));
}

/** The first step to start a walk-through from: the first numbered step, else the entry node with nothing pointing at it. */
export function walkStart(nodes: any[], edges: any[], stepNumbers: Map<string, string>): string | null {
  const real = nodes.filter((n) => !ANNOTATION_TYPES.has(n.type) && !n.data?.isAnnotation);
  if (real.length === 0) return null;
  const incoming = new Set(edges.map((e) => e.target));
  const entry = real.find((n) => !incoming.has(n.id));
  if (entry) return entry.id;
  const first = real.map((n) => ({ id: n.id, num: stepNumbers.get(n.id) ?? "" })).filter((x) => x.num).sort((a, b) => compareStepNumbers(a.num, b.num))[0];
  return first?.id ?? real[0].id;
}
