/**
 * Lanes and stages: what a step says about WHERE it belongs. Kept tiny and free of imports from the layout, so the
 * numbering can ask "is this a lanes diagram?" without a circular import.
 *
 * Stored on the step itself (no database change), so it travels with snapshots, versions, suggestions, client pages
 * and exports:
 *   data.lane      the row this step sits in, in the client's words ("Candidate", "Recruiter", "HRIS")
 *   data.stage     the band it belongs to ("2. Assessment"); a step without one continues the stage before it
 *   data.laneKind  "external" marks a lane that is another system (assessment platform, HRIS, a vendor)
 *   data.laneRank  optional number to put a lane earlier or later than its first appearance
 * Nothing here is a fixed list: any text is a lane, any text is a stage.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Steps that can carry a lane (notes follow the step they are attached to; tables and annotations have none). */
const LANE_TYPES = new Set(["note", "table", "annotation", "dangling_endpoint", "swimlane", "frame"]);

export const laneText = (node: any): string => text(node?.data?.lane);
export const stageText = (node: any): string => text(node?.data?.stage);
export const laneKey = (name: string): string => name.trim().toLowerCase();

/** A diagram is drawn as lanes when at least one step carries a lane. Otherwise it keeps the single-row layout. */
export function usesLanes(nodes: any[]): boolean {
  return nodes.some((n) => !LANE_TYPES.has(n?.type ?? n?.data?.type) && laneText(n) !== "");
}
