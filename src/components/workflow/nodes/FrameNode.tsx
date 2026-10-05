"use client";

import { useCallback, useState } from "react";
import { NodeResizer, useReactFlow } from "@xyflow/react";

interface FrameNodeProps {
  id: string;
  data: { label: string };
  selected?: boolean;
}

export default function FrameNode({ id, data, selected }: FrameNodeProps) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [tempLabel, setTempLabel] = useState(data.label);

  const commitLabel = useCallback(() => {
    setEditing(false);
    const next = tempLabel.trim() || "Frame";
    if (next !== data.label) {
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, label: next } } : n
        )
      );
    }
  }, [id, tempLabel, data.label, setNodes]);

  return (
    <div className="w-full h-full relative">
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={150}
        lineStyle={{ borderColor: "var(--ring)", borderWidth: 2 }}
        handleStyle={{ width: 8, height: 8, borderColor: "var(--ring)", backgroundColor: "var(--card)" }}
      />

      {/* Dashed border container */}
      <div className="absolute inset-0 rounded-lg border-2 border-dashed border-gray-300 pointer-events-none" />

      {/* Floating label tab above top-left */}
      <div className="absolute -top-6 left-2 z-10">
        {editing ? (
          <input
            autoFocus
            value={tempLabel}
            onChange={(e) => setTempLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitLabel();
              if (e.key === "Escape") {
                setTempLabel(data.label);
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-ring w-32"
          />
        ) : (
          <span
            className="text-xs font-medium text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200 cursor-text select-none whitespace-nowrap"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setTempLabel(data.label);
              setEditing(true);
            }}
          >
            {data.label}
          </span>
        )}
      </div>
    </div>
  );
}
