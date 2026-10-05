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
    <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-2 border-t border-border bg-card px-3 py-2 sm:px-4">
      <div className="flex items-center gap-1.5 text-foreground">
        <Zap className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="text-xs font-semibold text-muted-foreground hidden sm:block">Quick add</span>
      </div>

      {/* Node type selector */}
      <Select
        value={nodeType}
        onValueChange={(v) => setNodeType(v as NodeType)}
      >
        <SelectTrigger aria-label="Step type" className="data-[size=default]:h-11 md:data-[size=default]:h-8 w-36 border border-border bg-secondary text-xs focus:ring-1 focus:ring-ring">
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
        <SelectTrigger aria-label="Who does it" className="data-[size=default]:h-11 md:data-[size=default]:h-8 w-32 border border-border bg-secondary text-xs focus:ring-1 focus:ring-ring">
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
        aria-label="Add a step"
        className="h-11 min-w-40 flex-1 px-3 md:h-8 text-sm rounded-md border border-border bg-secondary placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring focus:bg-card transition-colors"
      />

      {/* Add button */}
      <button
        onClick={handleSubmit}
        disabled={!label.trim()}
        className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-40 md:h-8"
      >
        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="hidden sm:block">Add</span>
        <span className="sr-only sm:hidden">Add step</span>
      </button>
    </div>
  );
}
