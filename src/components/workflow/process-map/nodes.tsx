"use client";

import { Handle, Position, type EdgeProps, type NodeProps, type Node } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { fillFor, shapeKindOf } from "@/lib/workflow/process-map/model";
import type { Scene, SceneShape } from "@/lib/workflow/process-map/scene";
import { boxFor } from "@/lib/workflow/process-map/text-fit";
import { pathFromPoints } from "@/lib/workflow/process-map/route";
import { ArrowDefs, ContainerBody, EdgeBody, LegendBody, ShapeBody, TableBody, TitleBody } from "./shapes";
import { useProcessMapScene } from "./context";

/* eslint-disable @typescript-eslint/no-explicit-any */
const DOT = "!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:!bg-teal-500";

/** The scene's shape for a step; for a step that is not in the scene yet (a suggested addition) a standalone one. */
function shapeFor(scene: Scene | null, id: string, node: any): SceneShape {
  const hit = scene?.shapes.find((s) => s.id === id);
  if (hit) return hit;
  const box = boxFor(node);
  const f = fillFor(node);
  return { id, kind: shapeKindOf(node), node, box, rect: { x: 0, y: 0, w: box.width, h: box.height }, fill: f.fill, stroke: f.stroke, dashed: f.dashed, textColor: f.textColor };
}

/** One step of a Process Map: drawn by the shared SVG shapes, with a connection dot on each side. */
export function ProcessMapNode({ id, type, data, selected }: NodeProps) {
  const scene = useProcessMapScene();
  const shape = shapeFor(scene, id, { id, type, data });
  const { w, h } = shape.rect;
  return (
    <div className="group relative" style={{ width: w, height: h }}>
      <svg width={w} height={h} style={{ overflow: "visible", display: "block" }} aria-label={String((data as any)?.label ?? "Step")}>
        {selected && <rect x={-5} y={-5} width={w + 10} height={h + 10} rx={shape.kind === "start" || shape.kind === "end" ? (h + 10) / 2 : 6} fill="none" stroke="#2563eb" strokeWidth={2} strokeDasharray="5 3" />}
        <ShapeBody shape={shape} />
      </svg>
      <Handle id="top" type="source" position={Position.Top} className={DOT} />
      <Handle id="right" type="source" position={Position.Right} className={DOT} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={DOT} />
      <Handle id="left" type="source" position={Position.Left} className={DOT} />
    </div>
  );
}

/** Connectors are drawn from the scene (the same lines the layout check and the exports use), not from screen coordinates. */
export function ProcessMapEdge({ id, selected }: EdgeProps) {
  const scene = useProcessMapScene();
  const edge = scene?.edges.find((e) => e.id === id);
  if (!edge) return null;
  return (
    <g className={cn(selected && "pm-edge-selected")}>
      <path d={pathFromPoints(edge.points, 0)} fill="none" stroke="transparent" strokeWidth={16} />
      <EdgeBody edge={edge} />
      {selected && <path d={pathFromPoints(edge.points, 0)} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeOpacity={0.5} />}
    </g>
  );
}

export function ProcessMapTable({ id, selected }: NodeProps) {
  const scene = useProcessMapScene();
  const table = scene?.tables.find((t) => t.id === id);
  if (!table) return null;
  return (
    <svg width={table.rect.w} height={table.rect.h} style={{ overflow: "visible", display: "block", outline: selected ? "2px dashed #2563eb" : undefined, outlineOffset: 4 }}>
      <TableBody table={table} />
    </svg>
  );
}

function Fixed({ w, h, children }: { w: number; h: number; children: React.ReactNode }) {
  return (
    <svg width={w} height={h} style={{ overflow: "visible", display: "block", pointerEvents: "none" }}>
      {children}
    </svg>
  );
}

export function ProcessMapContainer({ id }: NodeProps) {
  const scene = useProcessMapScene();
  const c = scene?.containers.find((x) => x.id === id);
  if (!c) return null;
  return <Fixed w={c.rect.w} h={c.rect.h}><ContainerBody container={c} /></Fixed>;
}

export function ProcessMapTitle() {
  const scene = useProcessMapScene();
  if (!scene) return null;
  return <Fixed w={scene.title.rect.w} h={scene.title.rect.h}><TitleBody scene={scene} /></Fixed>;
}

export function ProcessMapLegend() {
  const scene = useProcessMapScene();
  if (!scene || scene.legend.rows.length === 0) return null;
  return <Fixed w={scene.legend.rect.w} h={scene.legend.rect.h}><LegendBody scene={scene} /></Fixed>;
}

/** Arrowhead definitions, placed once in the page so every connector can point to them. */
export function ProcessMapDefs() {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <ArrowDefs />
    </svg>
  );
}

/** The extra, non-editable pieces drawn around a Process Map: containers, title block and legend. */
export function derivedProcessMapNodes(scene: Scene): Node[] {
  const base = { draggable: false, selectable: false, connectable: false, focusable: false, deletable: false } as const;
  const out: Node[] = scene.containers.map((c) => ({
    ...base,
    id: c.id,
    type: "pmContainer",
    position: { x: c.rect.x, y: c.rect.y },
    data: {},
    zIndex: -2,
    // Explicit size: React Flow keeps a node hidden until it has measured it, and these background pieces are never fed back
    // into the editor's own node list, so without a size they would stay invisible on the canvas.
    width: c.rect.w,
    height: c.rect.h,
    style: { width: c.rect.w, height: c.rect.h, pointerEvents: "none" },
  }));
  out.push({ ...base, id: "pm_title", type: "pmTitle", position: { x: scene.title.rect.x, y: scene.title.rect.y }, data: {}, zIndex: -1, width: scene.title.rect.w, height: scene.title.rect.h, style: { width: scene.title.rect.w, height: scene.title.rect.h, pointerEvents: "none" } });
  if (scene.legend.rows.length > 0) {
    out.push({ ...base, id: "pm_legend", type: "pmLegend", position: { x: scene.legend.rect.x, y: scene.legend.rect.y }, data: {}, zIndex: -1, width: scene.legend.rect.w, height: scene.legend.rect.h, style: { width: scene.legend.rect.w, height: scene.legend.rect.h, pointerEvents: "none" } });
  }
  return out;
}
