"use client";

import { useCallback, useRef, useState } from "react";
import { Handle, NodeResizer, Position, useReactFlow } from "@xyflow/react";
import type { AnnotationNodeData, AnnotationShapeType } from "@/lib/workflow/types";

interface AnnotationNodeProps {
  id: string;
  data: AnnotationNodeData;
  selected?: boolean;
}

// Match BaseNode's handle style but muted purple for annotations
const HANDLE_CLASSES =
  "!w-2.5 !h-2.5 !bg-gray-400 !border-2 !border-white !z-20 hover:!bg-purple-500 transition-colors";

function getBorderStyleValue(borderStyle: AnnotationNodeData["borderStyle"]) {
  if (borderStyle === "none") return undefined;
  return borderStyle;
}

function getMinDimensions(shape: AnnotationShapeType) {
  switch (shape) {
    case "circle":     return { minWidth: 80,  minHeight: 80  };
    case "diamond":    return { minWidth: 100, minHeight: 100 };
    case "divider":    return { minWidth: 100, minHeight: 24  };
    case "text-label": return { minWidth: 60,  minHeight: 24  };
    default:           return { minWidth: 80,  minHeight: 40  };
  }
}

/** Four source handles at top/right/bottom/left — same positions as BaseNode */
function AnnotationHandles() {
  return (
    <>
      <Handle type="source" position={Position.Top}    id="top"    className={HANDLE_CLASSES} />
      <Handle type="source" position={Position.Right}  id="right"  className={HANDLE_CLASSES} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={HANDLE_CLASSES} />
      <Handle type="source" position={Position.Left}   id="left"   className={HANDLE_CLASSES} />
    </>
  );
}

export default function AnnotationNode({ id, data, selected }: AnnotationNodeProps) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [tempLabel, setTempLabel] = useState(data.label);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // data.opacity is stored as 0–1 (CSS fraction); default 0.8
  const cssOpacity = data.opacity ?? 0.8;

  const commitLabel = useCallback(() => {
    setEditing(false);
    const next = tempLabel;
    if (next !== data.label) {
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, label: next } }
            : n
        )
      );
    }
  }, [id, tempLabel, data.label, setNodes]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (data.shape === "divider") return;
      e.stopPropagation();
      setTempLabel(data.label);
      setEditing(true);
    },
    [data.shape, data.label]
  );

  const { minWidth, minHeight } = getMinDimensions(data.shape);

  const textStyle: React.CSSProperties = {
    fontSize: data.fontSize,
    fontWeight: data.bold ? "bold" : "normal",
    fontStyle: data.italic ? "italic" : "normal",
    textAlign: data.textAlign,
    color: data.fillColor === "#1F2937" ? "#F9FAFB" : "#1F2937",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  };

  // ── Divider shape ────────────────────────────────────────────────────────────
  if (data.shape === "divider") {
    return (
      <div className="w-full h-full relative flex flex-col justify-center">
        <NodeResizer
          isVisible={selected}
          minWidth={100}
          minHeight={24}
          lineStyle={{ borderColor: "#9CA3AF", borderWidth: 1 }}
          handleStyle={{ width: 7, height: 7, borderColor: "#6B7280", backgroundColor: "white" }}
        />
        <AnnotationHandles />
        <div style={{ opacity: cssOpacity }} className="w-full flex flex-col justify-center pointer-events-none">
          {data.label && (
            <div
              className="mb-1 px-1"
              style={{ ...textStyle, fontSize: Math.max((data.fontSize ?? 14) - 2, 10) }}
            >
              {data.label}
            </div>
          )}
          <hr
            style={{
              borderColor: data.borderColor === "none" ? "#9CA3AF" : data.borderColor,
              borderStyle: data.borderStyle === "none" ? "solid" : data.borderStyle,
              borderTopWidth: 1.5,
              margin: 0,
            }}
          />
        </div>
      </div>
    );
  }

  // ── Text-label shape (no border, no bg) ─────────────────────────────────────
  if (data.shape === "text-label") {
    return (
      <div
        className="w-full h-full relative flex items-center"
        style={{ justifyContent: data.textAlign === "center" ? "center" : data.textAlign === "right" ? "flex-end" : "flex-start" }}
        onDoubleClick={handleDoubleClick}
      >
        <NodeResizer
          isVisible={selected}
          minWidth={60}
          minHeight={24}
          lineStyle={{ borderColor: "#9CA3AF", borderWidth: 1 }}
          handleStyle={{ width: 7, height: 7, borderColor: "#6B7280", backgroundColor: "white" }}
        />
        <AnnotationHandles />
        <div style={{ opacity: cssOpacity, justifyContent: data.textAlign === "center" ? "center" : data.textAlign === "right" ? "flex-end" : "flex-start" }} className="w-full h-full flex items-center">
          {editing ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              autoFocus
              value={tempLabel}
              onChange={(e) => setTempLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setTempLabel(data.label);
                  setEditing(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-full resize-none bg-transparent outline-none border border-dashed border-gray-300 rounded px-1 relative z-30"
              style={textStyle}
            />
          ) : (
            <span style={textStyle} className="pointer-events-none select-none">
              {data.label || "Double-click to edit"}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Diamond shape ────────────────────────────────────────────────────────────
  if (data.shape === "diamond") {
    return (
      <div
        className="w-full h-full relative flex items-center justify-center"
        onDoubleClick={handleDoubleClick}
      >
        <NodeResizer
          isVisible={selected}
          minWidth={minWidth}
          minHeight={minHeight}
          lineStyle={{ borderColor: "#9CA3AF", borderWidth: 1 }}
          handleStyle={{ width: 7, height: 7, borderColor: "#6B7280", backgroundColor: "white" }}
        />
        <AnnotationHandles />
        {/* Diamond via rotated square */}
        <div
          className="absolute inset-2"
          style={{
            opacity: cssOpacity,
            transform: "rotate(45deg)",
            backgroundColor: data.fillColor === "transparent" ? "transparent" : data.fillColor,
            border:
              data.borderStyle === "none" || data.borderColor === "none"
                ? "none"
                : `1.5px ${getBorderStyleValue(data.borderStyle) ?? "solid"} ${data.borderColor}`,
          }}
        />
        {/* Label counter-rotated to stay readable */}
        <div style={{ opacity: cssOpacity }} className="relative z-10 flex items-center justify-center w-full h-full pointer-events-none">
          {editing ? (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
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
              className="pointer-events-auto w-3/4 text-center bg-transparent outline-none border-b border-gray-400 relative z-30"
              style={textStyle}
            />
          ) : (
            <span className="select-none text-center px-2" style={textStyle}>
              {data.label}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Circle shape ─────────────────────────────────────────────────────────────
  if (data.shape === "circle") {
    return (
      <div
        className="w-full h-full relative flex items-center justify-center"
        onDoubleClick={handleDoubleClick}
      >
        <NodeResizer
          isVisible={selected}
          minWidth={minWidth}
          minHeight={minHeight}
          lineStyle={{ borderColor: "#9CA3AF", borderWidth: 1 }}
          handleStyle={{ width: 7, height: 7, borderColor: "#6B7280", backgroundColor: "white" }}
        />
        <AnnotationHandles />
        {/* Circle visual */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            opacity: cssOpacity,
            backgroundColor: data.fillColor === "transparent" ? "transparent" : data.fillColor,
            border:
              data.borderStyle === "none" || data.borderColor === "none"
                ? "none"
                : `1.5px ${getBorderStyleValue(data.borderStyle) ?? "solid"} ${data.borderColor}`,
          }}
        />
        {/* Label */}
        <div style={{ opacity: cssOpacity }} className="relative z-10 flex items-center justify-center w-full h-full pointer-events-none">
          {editing ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              autoFocus
              value={tempLabel}
              onChange={(e) => setTempLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setTempLabel(data.label);
                  setEditing(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto w-4/5 h-3/5 resize-none bg-transparent outline-none border border-dashed border-gray-300 rounded text-center relative z-30"
              style={textStyle}
            />
          ) : (
            <span className="select-none text-center px-2" style={textStyle}>
              {data.label}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Rect / Rounded-rect (default) ────────────────────────────────────────────
  const borderRadius = data.shape === "rounded-rect" ? "0.75rem" : "0.25rem";

  return (
    <div
      className="w-full h-full relative"
      onDoubleClick={handleDoubleClick}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={minWidth}
        minHeight={minHeight}
        lineStyle={{ borderColor: "#9CA3AF", borderWidth: 1 }}
        handleStyle={{ width: 7, height: 7, borderColor: "#6B7280", backgroundColor: "white" }}
      />
      <AnnotationHandles />
      {/* Visual background/border layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: cssOpacity,
          backgroundColor: data.fillColor === "transparent" ? "transparent" : data.fillColor,
          border:
            data.borderStyle === "none" || data.borderColor === "none"
              ? "none"
              : `1.5px ${getBorderStyleValue(data.borderStyle) ?? "solid"} ${data.borderColor}`,
          borderRadius,
        }}
      />
      {/* Label layer */}
      <div className="absolute inset-0 p-2 overflow-hidden" style={{ opacity: cssOpacity, borderRadius }}>
        {editing ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            autoFocus
            value={tempLabel}
            onChange={(e) => setTempLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setTempLabel(data.label);
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full h-full resize-none bg-transparent outline-none border border-dashed border-gray-300 rounded relative z-30"
            style={textStyle}
          />
        ) : (
          <span className="pointer-events-none select-none" style={textStyle}>
            {data.label}
          </span>
        )}
      </div>
    </div>
  );
}
