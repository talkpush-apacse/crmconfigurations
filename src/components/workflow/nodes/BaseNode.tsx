"use client";

import { useEffect, useRef, useState } from "react";
import { Handle, NodeResizer, Position } from "@xyflow/react";
import {
  Bot,
  CircleDot,
  Clock,
  GitBranch,
  GitMerge,
  Hand,
  Info,
  Megaphone,
  MessageSquare,
  Plug,
  Triangle,
  UserCheck,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACTOR_CONFIG,
  NODE_TYPE_CONFIG,
  type ActorType,
  type FeasibilityLevel,
  type NodeType,
  type WorkflowNodeData,
  type WorkflowNodeType,
} from "@/lib/workflow/types";
import { useStepNumbers } from "@/components/workflow/StepNumberContext";

type IconProps = { className?: string; style?: React.CSSProperties };

const NODE_ICONS: Record<string, React.ComponentType<IconProps>> = {
  CircleDot,
  GitBranch,
  Plug,
  MessageSquare,
  GitMerge,
  Clock,
  Hand,
  Megaphone,
};

const ACTOR_ICONS: Record<string, React.ComponentType<IconProps>> = {
  Bot,
  UserRound,
  Plug,
  UserCheck,
  Megaphone,
};

function handleClasses(hovered: boolean) {
  return `!w-3.5 !h-3.5 !bg-white !border-2 ${hovered ? "!border-teal-300" : "!border-gray-400"} !z-20 hover:!bg-teal-500 hover:!border-teal-500 transition-colors`;
}

interface BaseNodeProps {
  id: string;
  data: WorkflowNodeData;
  selected?: boolean;
  diamond?: boolean;
  dashedBorder?: boolean;
  doubleBorder?: boolean;
  dottedBorder?: boolean;
  pillShape?: boolean;
}

export default function BaseNode({
  id,
  data,
  selected,
  diamond,
  dashedBorder,
  doubleBorder,
  dottedBorder,
  pillShape,
}: BaseNodeProps) {
  const { visible: stepNumbersVisible } = useStepNumbers();
  const typeConfig = NODE_TYPE_CONFIG[data.type as keyof typeof NODE_TYPE_CONFIG];
  const actorConfig = data.actor
    ? ACTOR_CONFIG[data.actor as ActorType]
    : null;

  const NodeIcon = NODE_ICONS[typeConfig?.icon] ?? CircleDot;
  const ActorIcon = actorConfig ? ACTOR_ICONS[actorConfig.icon] ?? Bot : Bot;
  const nodeBackground = data.customColor?.background ?? typeConfig?.bg ?? "#F9FAFB";
  const nodeBorder = data.customColor?.border ?? typeConfig?.border ?? "#6B7280";
  const [draftLabel, setDraftLabel] = useState(data.label);
  const [isHovered, setIsHovered] = useState(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleMouseEnter() {
    clearTimeout(leaveTimerRef.current);
    setIsHovered(true);
  }

  function handleMouseLeave() {
    // Small delay so moving from node→button doesn't hide the button mid-flight
    leaveTimerRef.current = setTimeout(() => setIsHovered(false), 80);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ported as is from the original editor; revisit in the phase 5 cleanup
    setDraftLabel(data.label);
  }, [data.label]);

  useEffect(() => {
    if (data.isEditingLabel) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [data.isEditingLabel]);

  const borderStyle = dashedBorder
    ? "border-dashed"
    : dottedBorder
    ? "border-dotted"
    : "border-solid";

  function commitLabel() {
    const nextLabel = draftLabel.trim() || data.label || "Untitled";
    data.onLabelChange?.(id, nextLabel);
  }

  function cancelLabelEdit() {
    setDraftLabel(data.label);
    data.onLabelChange?.(id, data.label);
  }

  function openSuggestion(
    sourceHandle: "right" | "bottom",
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    event.preventDefault();
    event.stopPropagation();
    data.onOpenSuggestion?.({
      sourceNodeId: id,
      sourceNodeType: data.type as WorkflowNodeType,
      sourceHandle,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }

  const labelContent = data.isEditingLabel ? (
    <input
      ref={inputRef}
      value={draftLabel}
      onChange={(event) => setDraftLabel(event.target.value)}
      onBlur={commitLabel}
      onKeyDown={(event) => {
        if (event.key === "Enter") commitLabel();
        if (event.key === "Escape") cancelLabelEdit();
      }}
      onClick={(event) => event.stopPropagation()}
      className="min-w-0 flex-1 rounded border border-teal-300 bg-white px-1 py-0.5 text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-teal-500"
    />
  ) : (
    <span className="truncate text-[13px] font-semibold leading-tight text-gray-800">
      {data.label}
    </span>
  );

  const diamondLabelContent = data.isEditingLabel ? (
    <input
      ref={inputRef}
      value={draftLabel}
      onChange={(event) => setDraftLabel(event.target.value)}
      onBlur={commitLabel}
      onKeyDown={(event) => {
        if (event.key === "Enter") commitLabel();
        if (event.key === "Escape") cancelLabelEdit();
      }}
      onClick={(event) => event.stopPropagation()}
      className="w-[120px] rounded border border-teal-300 bg-white px-1 py-0.5 text-center text-[12px] font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-teal-500"
    />
  ) : (
    <span className="max-w-[120px] text-[12px] font-semibold leading-tight text-gray-800">
      {data.label}
    </span>
  );

  const showButtons = isHovered && !data.isEditingLabel && !!data.onOpenSuggestion;

  const suggestionButtons = data.onOpenSuggestion && (
    <>
      <button
        type="button"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(event) => openSuggestion("right", event)}
        className={cn(
          "nodrag nopan absolute left-full top-1/2 z-[1001] flex h-10 w-10 -translate-y-1/2 items-center justify-center text-sm font-semibold leading-none text-white transition-opacity",
          showButtons ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        aria-label="Add node to the right"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-teal-500 shadow-sm hover:bg-teal-600">
          +
        </span>
      </button>
      <button
        type="button"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(event) => openSuggestion("bottom", event)}
        className={cn(
          "nodrag nopan absolute left-1/2 top-full z-[1001] flex h-10 w-10 -translate-x-1/2 items-center justify-center text-sm font-semibold leading-none text-white transition-opacity",
          showButtons ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        aria-label="Add node below"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-teal-500 shadow-sm hover:bg-teal-600">
          +
        </span>
      </button>
    </>
  );

  const content = (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative w-full min-w-[140px] px-2.5 py-2 rounded-lg border-2 bg-white transition-shadow",
        borderStyle,
        selected && "ring-2 ring-offset-1 ring-teal-500",
        pillShape && "rounded-full",
        doubleBorder && "outline outline-2 outline-offset-2"
      )}
      style={{
        background: nodeBackground,
        borderColor: nodeBorder,
        outlineColor: doubleBorder ? nodeBorder : undefined,
        minHeight: 60,
      }}
    >
      {suggestionButtons}
      {(stepNumbersVisible && (data.stepNumber || data.isOverflow) || data.hasWarning) && (
        <div className="absolute -left-2 -top-2 z-20 flex items-center gap-1">
          {stepNumbersVisible && data.isOverflow && (
            <span
              className="rounded-full bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700 shadow-sm"
              title="Subprocess extraction recommended — max nesting depth exceeded"
            >
              ⚠ deep
            </span>
          )}
          {stepNumbersVisible && !data.isOverflow && data.stepNumber && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600 shadow-sm">
              {data.stepNumber}
            </span>
          )}
          {data.hasWarning && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 shadow-sm" title="Mark one outgoing connector as the happy path">
              ⚠
            </span>
          )}
        </div>
      )}

      {/* NodeResizer — only for non-diamond variants */}
      <NodeResizer
        isVisible={selected}
        minWidth={140}
        minHeight={60}
        lineStyle={{ borderColor: "#00BFA5", borderWidth: 1.5 }}
        handleStyle={{ width: 8, height: 8, borderColor: "#00BFA5", backgroundColor: "white" }}
      />

      {/* In Loose mode, source handles can also receive connector endpoints. */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className={handleClasses(isHovered)}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className={handleClasses(isHovered)}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={handleClasses(isHovered)}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={handleClasses(isHovered)}
      />

      {/* Type icon + label */}
      <div className="flex items-center gap-2 mb-1.5">
        <NodeIcon
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: nodeBorder }}
        />
        {labelContent}

        {/* Feasibility indicator */}
        {data.feasibility === "needs_review" && (
          <span title={data.feasibilityNote ?? "Needs review"}>
            <Triangle className="w-3 h-3 shrink-0 text-amber-500 fill-amber-100" />
          </span>
        )}
        {data.feasibility === "likely" && (
          <span title={data.feasibilityNote ?? "Likely feasible"}>
            <Info className="w-3 h-3 shrink-0 text-blue-400" />
          </span>
        )}
      </div>

      {/* Actor badge */}
      {data.actor && actorConfig && (
        <div className="flex items-center gap-1 mb-1.5">
          <ActorIcon
            className="w-3 h-3 shrink-0"
            style={{ color: actorConfig.color }}
          />
          <span className="text-[10px] text-gray-500 truncate">
            {data.actorLabel || actorConfig.label}
          </span>
        </div>
      )}

      {/* Notes preview — line-clamp-1 (not truncate) avoids white-space:nowrap expanding node width */}
      {data.notes && (
        <p className="text-[10px] text-gray-400 line-clamp-1">{data.notes}</p>
      )}
    </div>
  );

  if (diamond) {
    return (
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative flex items-center justify-center w-full h-full"
        style={{ minWidth: 160, minHeight: 160 }}
      >
        {suggestionButtons}
        {(stepNumbersVisible && (data.stepNumber || data.isOverflow) || data.hasWarning) && (
          <div className="absolute -left-2 -top-2 z-20 flex items-center gap-1">
            {stepNumbersVisible && data.isOverflow && (
              <span
                className="rounded-full bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700 shadow-sm"
                title="Subprocess extraction recommended — max nesting depth exceeded"
              >
                ⚠ deep
              </span>
            )}
            {stepNumbersVisible && !data.isOverflow && data.stepNumber && (
              <span className={
                /[a-zA-Z]/.test(data.stepNumber)
                  ? "rounded-full border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] italic text-gray-400 shadow-sm"
                  : "rounded-full bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600 shadow-sm"
              }>
                {data.stepNumber}
              </span>
            )}
            {data.hasWarning && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 shadow-sm" title="Mark one outgoing connector as the happy path">
                ⚠
              </span>
            )}
          </div>
        )}
        <NodeResizer
          isVisible={selected}
          minWidth={140}
          minHeight={140}
          keepAspectRatio
          lineStyle={{ borderColor: "#00BFA5", borderWidth: 1.5 }}
          handleStyle={{ width: 8, height: 8, borderColor: "#00BFA5", backgroundColor: "white" }}
        />
        {/* In Loose mode, source handles can also receive connector endpoints. */}
        <Handle
          type="source"
          position={Position.Top}
          id="top"
          className={handleClasses(isHovered)}
        />
        <Handle
          type="source"
          position={Position.Left}
          id="left"
          className={handleClasses(isHovered)}
        />
        <div
          className={cn(
            "absolute rotate-45 rounded-md border-2",
            borderStyle,
            selected && "ring-2 ring-offset-2 ring-teal-500"
          )}
          style={{
            width: "70.7%",
            height: "70.7%",
            background: nodeBackground,
            borderColor: nodeBorder,
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-1 px-2 text-center">
          <NodeIcon
            className="w-4 h-4"
            style={{ color: nodeBorder }}
          />
          {diamondLabelContent}
          {data.actor && actorConfig && (
            <div className="flex items-center gap-1">
              <ActorIcon className="w-3 h-3" style={{ color: actorConfig.color }} />
              <span className="text-[9px] text-gray-500">{data.actorLabel || actorConfig.label}</span>
            </div>
          )}
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className={handleClasses(isHovered)}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className={handleClasses(isHovered)}
        />
      </div>
    );
  }

  return content;
}
