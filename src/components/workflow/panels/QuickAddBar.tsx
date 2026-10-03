"use client";

import { useRef, useState } from "react";
import { Plus, Zap } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTOR_CONFIG,
  NODE_TYPE_CONFIG,
  type ActorType,
  type NodeType,
} from "@/lib/workflow/types";

const NODE_TYPES = Object.entries(NODE_TYPE_CONFIG) as [
  keyof typeof NODE_TYPE_CONFIG,
  (typeof NODE_TYPE_CONFIG)[keyof typeof NODE_TYPE_CONFIG]
][];
const ACTOR_TYPES = Object.entries(ACTOR_CONFIG) as [
  ActorType,
  (typeof ACTOR_CONFIG)[ActorType]
][];

interface QuickAddBarProps {
  onAdd: (label: string, type: NodeType, actor: ActorType) => void;
}

export default function QuickAddBar({ onAdd }: QuickAddBarProps) {
  const [label, setLabel] = useState("");
  const [nodeType, setNodeType] = useState<NodeType>("stage");
  const [actor, setActor] = useState<ActorType>("automated");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    const trimmed = label.trim();
    if (!trimmed) return;
    onAdd(trimmed, nodeType, actor);
    setLabel("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="h-16 bg-white border-t border-gray-200 flex items-center gap-2 px-4 shrink-0">
      <div className="flex items-center gap-1.5 text-teal-600">
        <Zap className="w-3.5 h-3.5" />
        <span className="text-xs font-semibold text-gray-500 hidden sm:block">Quick Add</span>
      </div>

      {/* Node type selector */}
      <Select
        value={nodeType}
        onValueChange={(v) => setNodeType(v as NodeType)}
      >
        <SelectTrigger className="h-8 w-36 text-xs border border-gray-200 bg-gray-50 focus:ring-1 focus:ring-teal-500">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {NODE_TYPES.map(([type, config]) => (
            <SelectItem key={type} value={type} className="text-xs">
              {config.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Actor selector */}
      <Select
        value={actor}
        onValueChange={(v) => setActor(v as ActorType)}
      >
        <SelectTrigger className="h-8 w-32 text-xs border border-gray-200 bg-gray-50 focus:ring-1 focus:ring-teal-500">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ACTOR_TYPES.map(([type, config]) => (
            <SelectItem key={type} value={type} className="text-xs">
              {config.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Label input */}
      <input
        ref={inputRef}
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a step… (press Enter)"
        className="flex-1 h-8 px-3 text-sm rounded-md border border-gray-200 bg-gray-50 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors"
      />

      {/* Add button */}
      <button
        onClick={handleSubmit}
        disabled={!label.trim()}
        className="h-8 px-3 flex items-center gap-1.5 text-xs font-medium rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="hidden sm:block">Add</span>
      </button>
    </div>
  );
}
