"use client";

import { useCallback, useState } from "react";
import { NodeResizer, useReactFlow } from "@xyflow/react";
import { StretchHorizontal } from "lucide-react";

interface SwimlaneNodeProps {
  id: string;
  data: { label: string };
  selected?: boolean;
}

export default function SwimlaneNode({ id, data, selected }: SwimlaneNodeProps) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [tempLabel, setTempLabel] = useState(data.label);

  const commitLabel = useCallback(() => {
    setEditing(false);
    const next = tempLabel.trim() || "Swimlane";
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
        minWidth={300}
        minHeight={150}
        lineStyle={{ borderColor: "#0EA5E9", borderWidth: 2 }}
        handleStyle={{ width: 8, height: 8, borderColor: "#0EA5E9", backgroundColor: "white" }}
      />

      {/* Outer border */}
      <div className="absolute inset-0 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/30 pointer-events-none" />

      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 h-9 bg-sky-100/80 border-b border-dashed border-sky-300 rounded-t-xl flex items-center gap-2 px-3 z-10">
        <StretchHorizontal className="w-3.5 h-3.5 text-sky-600 shrink-0" />
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
            className="text-xs font-semibold text-sky-800 bg-transparent border-b border-sky-400 outline-none flex-1"
          />
        ) : (
          <span
            className="text-xs font-semibold text-sky-800 truncate cursor-text select-none"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setTempLabel(data.label);
              setEditing(true);
            }}
          >
            {data.label}
          </span>
        )}
        {selected && (
          <span className="ml-auto text-[9px] text-sky-400 shrink-0">double-click to rename</span>
        )}
      </div>
    </div>
  );
}
