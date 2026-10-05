"use client";

import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";

interface DanglingEndpointNodeProps {
  selected?: boolean;
}

/**
 * A minimal invisible-to-the-user endpoint node used to anchor a dangling edge.
 * Created automatically when the user drags a handle and releases on empty canvas.
 * Deleted automatically when the edge is reconnected to a real node.
 */
export default function DanglingEndpointNode({ selected }: DanglingEndpointNodeProps) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center w-4 h-4 rounded-full border-2 border-dashed bg-white transition-colors",
        selected ? "border-ring" : "border-muted-foreground"
      )}
    >
      {/* All handles are source type — ConnectionMode.Loose lets edges reconnect from either end */}
      <Handle type="source" position={Position.Top}    id="top"    className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Right}  id="right"  className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Left}   id="left"   className="!opacity-0 !w-2 !h-2" />
    </div>
  );
}
