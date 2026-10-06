import { applyLayout, layoutProcessMap, positionForNewNote as positionWith, type LayoutResult } from "./layout";
import { layoutLanes } from "./lanes";
import { usesLanes } from "./lane-mode";
import { withLook } from "./tokens";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The one place that decides which layout a Process Map gets: lanes when its steps carry lanes, otherwise the
 * single-row layout. Every caller that arranges a diagram (the connector, the editor's Arrange, new workflows)
 * goes through here.
 */
export function layoutDiagram(nodes: any[], edges: any[], look?: string | null): LayoutResult {
  return withLook(look, () => (usesLanes(nodes) ? layoutLanes(nodes, edges) : layoutProcessMap(nodes, edges)));
}

export function positionForNewNote(nodes: any[], edges: any[], note: any, look?: string | null) {
  return withLook(look, () => positionWith(nodes, edges, note, (n, e) => layoutDiagram(n, e, look)));
}

export { applyLayout, usesLanes };
