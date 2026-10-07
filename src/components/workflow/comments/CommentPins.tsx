"use client";

import { useMemo } from "react";
import { ViewportPortal, useViewport, type Node } from "@xyflow/react";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
function absolutePosition(node: Node<any>, byId: Map<string, Node<any>>) {
  let x = node.position.x;
  let y = node.position.y;
  let parent = node.parentId ? byId.get(node.parentId) : undefined;
  for (let hops = 0; parent && hops < 10; hops++) {
    x += parent.position.x;
    y += parent.position.y;
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return { x, y };
}

function sizeOf(node: Node<any>): { w: number; h: number } {
  const w = parseFloat(String(node.style?.width ?? ""));
  const h = parseFloat(String(node.style?.height ?? ""));
  return { w: node.measured?.width ?? node.width ?? (Number.isFinite(w) ? w : 160), h: node.measured?.height ?? node.height ?? (Number.isFinite(h) ? h : 60) };
}

/** Where the pin sits: the top-right corner of a box, or on the upper-right edge of a diamond (a decision). */
function pinAnchor(node: Node<any>, at: { x: number; y: number }) {
  const { w, h } = sizeOf(node);
  return node.type === "decision" ? { x: at.x + w * 0.75, y: at.y + h * 0.25 } : { x: at.x + w, y: at.y };
}

/**
 * A numbered marker on the top-right corner of every step that has open comments. It lives in the diagram's own
 * coordinates, so it moves with the step when you pan, zoom or drag, and it is drawn a little larger when you zoom out
 * so it stays readable. Clicking it opens that step's conversation.
 */
export default function CommentPins({
  nodes,
  counts,
  activeNodeId,
  onOpen,
}: {
  nodes: Node<any>[];
  /** Open comment threads per step id. */
  counts: Map<string, number>;
  /** The step the comments panel is currently showing, drawn with an amber ring. */
  activeNodeId: string | null;
  onOpen: (nodeId: string) => void;
}) {
  const { zoom } = useViewport();
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const scale = Math.min(2, Math.max(0.9, 1 / zoom));

  return (
    <ViewportPortal>
      {[...counts].map(([id, count]) => {
        const node = byId.get(id);
        if (!node || node.hidden) return null;
        const at = pinAnchor(node, absolutePosition(node, byId));
        const label = `${count} open comment${count === 1 ? "" : "s"} on this step. Open them.`;
        return (
          <button
            key={id}
            type="button"
            aria-label={label}
            title={label}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(id);
            }}
            className={cn(
              "nodrag nopan pointer-events-auto absolute left-0 top-0 flex h-6 min-w-6 items-center justify-center rounded-full bg-sky-600 px-1.5 text-[11px] font-semibold leading-none text-white shadow-md outline-none hover:bg-sky-700 focus-visible:ring-4 focus-visible:ring-sky-300",
              activeNodeId === id ? "ring-4 ring-amber-400" : "ring-2 ring-white"
            )}
            style={{ transform: `translate(${at.x}px, ${at.y}px) translate(-50%, -50%) scale(${scale})` }}
          >
            {count}
          </button>
        );
      })}
    </ViewportPortal>
  );
}
