"use client";

import { GitBranch, RotateCcw, Route, Tags, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type EdgeContextMenuProps = {
  open: boolean;
  position: { x: number; y: number };
  showHappyPath: boolean;
  showRecoveryPath: boolean;
  showResetRouting: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkHappyPath: () => void;
  onMarkRecoveryPath: () => void;
  onAddLabel: () => void;
  onResetRouting: () => void;
  onDelete: () => void;
};

export default function EdgeContextMenu({
  open,
  position,
  showHappyPath,
  showRecoveryPath,
  showResetRouting,
  onOpenChange,
  onMarkHappyPath,
  onMarkRecoveryPath,
  onAddLabel,
  onResetRouting,
  onDelete,
}: EdgeContextMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Connector actions"
          style={{
            position: "fixed",
            left: position.x,
            top: position.y,
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
          }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className="w-52 text-sm">
        {showHappyPath && (
          <DropdownMenuItem onClick={onMarkHappyPath} className="gap-2 cursor-pointer">
            <GitBranch className="w-3.5 h-3.5 text-foreground" />
            Mark as Happy Path
          </DropdownMenuItem>
        )}
        {showRecoveryPath && (
          <DropdownMenuItem onClick={onMarkRecoveryPath} className="gap-2 cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5 text-brand-amber-darker" />
            Mark as Recovery Path
          </DropdownMenuItem>
        )}
        {(showHappyPath || showRecoveryPath) && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={onAddLabel} className="gap-2 cursor-pointer">
          <Tags className="w-3.5 h-3.5 text-muted-foreground" />
          Add label
        </DropdownMenuItem>
        {showResetRouting && (
          <DropdownMenuItem onClick={onResetRouting} className="gap-2 cursor-pointer">
            <Route className="w-3.5 h-3.5 text-muted-foreground" />
            Reset routing
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={onDelete}
          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
          Delete edge
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
