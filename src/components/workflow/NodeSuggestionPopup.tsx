"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import {
  NODE_TYPE_CONFIG,
  type WorkflowNodeType,
} from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

type NodeSuggestionPopupProps = {
  open: boolean;
  popupPosition: { x: number; y: number };
  sourceNodeId: string | null;
  sourceNodeType: WorkflowNodeType | null;
  defaultHappyPath: boolean;
  /** In the Process Map style, an end state and a jump marker are offered after most steps. */
  processMap?: boolean;
  onSelect: (nodeType: WorkflowNodeType, isHappyPath: boolean) => void;
  onDismiss: () => void;
};

const SUGGESTIONS: Record<WorkflowNodeType, WorkflowNodeType[]> = {
  source: ["stage", "communication"],
  stage: ["decision", "stage", "communication", "integration"],
  decision: ["stage", "communication", "manual_action", "wait", "table"],
  parallel: ["stage", "integration", "wait", "table"],
  communication: ["stage", "decision", "wait", "table"],
  wait: ["stage", "decision", "communication"],
  manual_action: ["stage", "decision", "communication"],
  integration: ["stage", "decision", "communication"],
  table: ["stage", "decision", "communication"],
  terminator: [],
  jump: [],
  note: [],
};

const ALL_NODE_TYPES: WorkflowNodeType[] = [
  "source",
  "stage",
  "decision",
  "communication",
  "integration",
  "parallel",
  "wait",
  "manual_action",
  "table",
  "terminator",
  "jump",
  "note",
];

const NODE_DOT_COLORS: Record<WorkflowNodeType, string> = {
  stage: "#00BFA5",
  decision: "#F59E0B",
  integration: "#8B5CF6",
  communication: "#3B82F6",
  parallel: "#EC4899",
  wait: "#6B7280",
  manual_action: "#F97316",
  source: "#10B981",
  table: "#475569",
  terminator: "#333333",
  jump: "#6A1B9A",
  note: "#666666",
};

export default function NodeSuggestionPopup({
  open,
  popupPosition,
  sourceNodeId,
  sourceNodeType,
  defaultHappyPath,
  processMap,
  onSelect,
  onDismiss,
}: NodeSuggestionPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [markHappyPath, setMarkHappyPath] = useState(defaultHappyPath);
  const showHappyPathToggle =
    sourceNodeType === "decision" || sourceNodeType === "parallel";
  const suggestions = sourceNodeId && sourceNodeType
    ? processMap && SUGGESTIONS[sourceNodeType].length > 0
      ? [...SUGGESTIONS[sourceNodeType], "terminator" as const, "jump" as const]
      : SUGGESTIONS[sourceNodeType]
    : ALL_NODE_TYPES;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ported as is from the original editor; revisit in the phase 5 cleanup
    if (open) setMarkHappyPath(defaultHappyPath);
  }, [defaultHappyPath, open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as globalThis.Node)) {
        onDismiss();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onDismiss, open]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: popupPosition.x + 12,
        top: popupPosition.y - 8,
        zIndex: 1000,
      }}
      className="w-[200px] rounded-xl border border-border bg-white p-1.5 shadow-lg"
    >
      {showHappyPathToggle && (
        <label className="mb-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-gray-600 hover:bg-muted">
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded border",
              markHappyPath
                ? "border-teal-500 bg-teal-500 text-white"
                : "border-gray-300 bg-white"
            )}
          >
            {markHappyPath && <Check className="h-3 w-3" />}
          </span>
          <input
            type="checkbox"
            checked={markHappyPath}
            onChange={(event) => setMarkHappyPath(event.target.checked)}
            className="sr-only"
          />
          Mark as happy path
        </label>
      )}

      {suggestions.map((type) => {
        const config = NODE_TYPE_CONFIG[type];
        return (
          <button
            key={type}
            type="button"
            onClick={() => onSelect(type, showHappyPathToggle && markHappyPath)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-medium text-gray-700 hover:bg-muted"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: NODE_DOT_COLORS[type] }}
            />
            <span className="truncate">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}
