"use client";

import {
  ArrowLeft,
  BoxSelect,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  FileCode2,
  FileImage,
  Hash,
  History,
  LayoutDashboard,
  LayoutTemplate,
  Loader2,
  MessageSquare,
  MousePointer2,
  Redo2,
  Share2,
  ShieldCheck,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "@/lib/workflow/dates";
import { DownloadMenuItems } from "./process-map/DownloadMenu";
import type { ExportMeta, ExportPage } from "./process-map/export";
import { statusStyle } from "./status-style";

type SaveStatus = "saved" | "saving" | "unsaved";

export interface ToolbarVersion {
  id: string;
  versionNumber: number;
  status: string;
  createdAt: string;
  triggerDetail?: string | null;
}

export interface EditorToolbarProps {
  clientName: string;
  workflowName: string;
  onBack: () => void;

  // Title (rename in place)
  editingName: boolean;
  nameValue: string;
  onNameChange: (value: string) => void;
  onStartRename: () => void;
  onNameBlur: () => void;
  onCancelRename: () => void;

  // Save status
  saveStatus: SaveStatus;
  onRetrySave: () => void;

  // Version menu
  currentVersionNumber: number;
  versions: ToolbarVersion[];
  versionsLoading: boolean;
  onOpenVersionPanel: () => void;

  // Edit group
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAutoArrange: () => void;
  isProcessMap: boolean;
  onRenumber: () => void;

  // Check group
  layoutFindingCount: number;
  layoutHasHighFinding: boolean;
  onOpenLayoutCheck: () => void;
  reviewOpen: boolean;
  onToggleReview: () => void;
  seBriefOpen: boolean;
  onToggleSEBrief: () => void;

  // Share group
  selectedCount: number;
  exportPages: ExportPage[];
  activePageId: string | null;
  exportMeta: ExportMeta;
  onExportPdf: () => void;
  onExportSelectedPdf: () => void;
  onCopyMermaid: () => void;
  onSaveTemplate: () => void;
  onShare: () => void;
}

/** Touch-friendly below md (44px), dense on desktop. */
const TOUCH = "min-h-11 min-w-11 md:min-h-8 md:min-w-8";

function Divider() {
  return <div className="mx-0.5 hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden="true" />;
}

function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === "unsaved") {
    return (
      <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />
        <span role="alert" className="text-xs font-medium text-destructive">Not saved</span>
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded border border-destructive/30 px-2 text-xs font-medium text-destructive hover:bg-destructive/10 md:min-h-0 md:px-1.5 md:py-0.5"
        >
          Retry
        </button>
      </div>
    );
  }
  return (
    <div role="status" aria-live="polite" className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      {status === "saving" ? (
        <>
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand-amber" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">Saving…</span>
        </>
      ) : (
        <>
          <span className="h-2 w-2 rounded-full bg-brand-sage-darker" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">Saved</span>
        </>
      )}
    </div>
  );
}

/**
 * The editor's top bar. Two rows below lg (who and what on top, tools underneath), one row from lg up.
 * Tools are grouped: Edit (change the map), Check (look it over), Share (get it out).
 */
export default function EditorToolbar(p: EditorToolbarProps) {
  const fullTitle = p.clientName ? `${p.clientName} / ${p.nameValue}` : p.nameValue;
  const hasFindings = p.layoutFindingCount > 0;

  return (
    <header className="z-10 flex shrink-0 flex-col border-b border-border bg-card lg:h-14 lg:flex-row lg:items-center lg:gap-3 lg:px-4">
      {/* Who and what: back, title, save status, versions. Each has its own slot, so none can sit on another. */}
      <div className="flex min-w-0 items-center gap-2 px-3 py-1 sm:px-4 lg:flex-1 lg:p-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={p.onBack}
          aria-label="Back to workflows"
          className={cn("shrink-0 gap-1.5 px-2 text-muted-foreground hover:text-foreground", TOUCH)}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden text-xs sm:inline">Workflows</span>
        </Button>

        <div className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />

        <div className="flex min-w-0 flex-1 items-center gap-2" title={fullTitle}>
          {p.clientName && (
            <>
              <span className="hidden max-w-[140px] shrink truncate text-xs text-muted-foreground sm:block">{p.clientName}</span>
              <span className="hidden text-xs text-muted-foreground sm:block" aria-hidden="true">/</span>
            </>
          )}
          {p.editingName ? (
            <input
              autoFocus
              aria-label="Workflow name"
              value={p.nameValue}
              onChange={(e) => p.onNameChange(e.target.value)}
              onBlur={p.onNameBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") p.onNameBlur();
                if (e.key === "Escape") p.onCancelRename();
              }}
              className="min-w-0 max-w-[260px] flex-1 border-b border-ring bg-transparent text-sm font-semibold text-foreground outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={p.onStartRename}
              className="min-h-11 min-w-0 truncate text-left text-sm font-semibold text-foreground hover:underline hover:underline-offset-4 md:min-h-0"
              title={`${p.nameValue} (click to rename)`}
            >
              {p.nameValue}
            </button>
          )}
        </div>

        <SaveIndicator status={p.saveStatus} onRetry={p.onRetrySave} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn("shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground", TOUCH)}
              title="Version history"
              aria-label={`Version history, current version ${p.currentVersionNumber}`}
            >
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              v{p.currentVersionNumber}
              <ChevronDown className="h-3 w-3 opacity-50" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-0">
            <div className="border-b border-border/50 p-3">
              <p className="text-xs font-semibold text-foreground">Recent versions</p>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {p.versionsLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading versions" />
                </div>
              ) : p.versions.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">No versions yet</p>
              ) : (
                p.versions.slice(0, 5).map((version) => {
                  const status = statusStyle(version.status);
                  return (
                    <div key={version.id} className="border-b border-border/50 px-3 py-2 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-brand-lavender-lightest px-2 py-0.5 font-mono text-[11px] font-medium text-foreground">
                          v{version.versionNumber}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>{status.label}</span>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      {version.triggerDetail && <p className="mt-0.5 text-[11px] text-muted-foreground">{version.triggerDetail}</p>}
                    </div>
                  );
                })
              )}
            </div>
            <div className="border-t border-border/50 p-2">
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={p.onOpenVersionPanel}>
                View full history
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tools: Edit, Check, Share */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-border/50 px-3 py-1 sm:px-4 lg:shrink-0 lg:flex-nowrap lg:border-t-0 lg:p-0">
        <div role="group" aria-label="Edit" className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={p.onUndo}
            disabled={!p.canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            className={cn("px-2 text-muted-foreground hover:text-foreground", TOUCH)}
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={p.onRedo}
            disabled={!p.canRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            className={cn("px-2 text-muted-foreground hover:text-foreground", TOUCH)}
          >
            <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={p.onAutoArrange}
            aria-label="Auto-arrange steps"
            title="Auto-arrange steps"
            className={cn("gap-1.5 text-xs", TOUCH)}
          >
            <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">Auto-arrange</span>
          </Button>
          {!p.isProcessMap && (
            <Button
              variant="ghost"
              size="sm"
              onClick={p.onRenumber}
              aria-label="Re-number steps"
              title="Re-number steps"
              className={cn("gap-1.5 text-xs text-muted-foreground hover:text-foreground", TOUCH)}
            >
              <Hash className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden xl:inline">Re-number</span>
            </Button>
          )}
        </div>

        <Divider />

        <div role="group" aria-label="Check" className="flex items-center gap-1">
          {p.isProcessMap && (
            <Button
              variant={p.layoutHasHighFinding ? "outline" : "ghost"}
              size="sm"
              onClick={p.onOpenLayoutCheck}
              aria-label={hasFindings ? `Layout check, ${p.layoutFindingCount} to look at` : "Layout check, no problems found"}
              title="Check the layout for tangles, overlaps and text that does not fit (L)"
              className={cn("gap-1.5 text-xs", hasFindings ? "text-foreground" : "text-muted-foreground hover:text-foreground", TOUCH)}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden xl:inline">Layout check</span>
              {hasFindings && (
                <span className="rounded-full bg-brand-amber/30 px-1.5 text-[11px] font-semibold tabular-nums text-foreground">{p.layoutFindingCount}</span>
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={p.onToggleReview}
            aria-pressed={p.reviewOpen}
            aria-label="Review"
            title="Comments, suggestions and decisions from clients"
            className={cn("gap-1.5 text-xs", p.reviewOpen ? "bg-brand-lavender-lighter text-foreground" : "text-muted-foreground hover:text-foreground", TOUCH)}
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">Review</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={p.onToggleSEBrief}
            aria-pressed={p.seBriefOpen}
            aria-label="SE brief"
            title="Show or hide the SE brief panel"
            className={cn("gap-1.5 text-xs", p.seBriefOpen ? "bg-brand-lavender-lighter text-foreground" : "text-muted-foreground hover:text-foreground", TOUCH)}
          >
            <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">SE brief</span>
          </Button>
        </div>

        <Divider />

        <div role="group" aria-label="Share" className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", TOUCH)} aria-label="Export" title="Download a file, copy as text, or save as a template">
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden xl:inline">Export</span>
                <ChevronDown className="h-3 w-3 opacity-50" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 text-sm">
              <DropdownMenuLabel className="py-1.5 text-xs text-muted-foreground">Download a file</DropdownMenuLabel>
              {p.isProcessMap ? (
                <DownloadMenuItems pages={p.exportPages} activePageId={p.activePageId} meta={p.exportMeta} />
              ) : (
                <>
                  <DropdownMenuItem onClick={p.onExportPdf} className="cursor-pointer gap-2">
                    <FileImage className="h-3.5 w-3.5" aria-hidden="true" />
                    PDF of the whole diagram
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={p.onExportSelectedPdf} disabled={p.selectedCount === 0} className="cursor-pointer gap-2">
                    <FileImage className="h-3.5 w-3.5" aria-hidden="true" />
                    {p.selectedCount > 0 ? `PDF of ${p.selectedCount} selected` : "PDF of selected steps"}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="py-1.5 text-xs text-muted-foreground">Copy or reuse</DropdownMenuLabel>
              <DropdownMenuItem onClick={p.onCopyMermaid} className="cursor-pointer gap-2">
                <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
                Copy as Mermaid text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={p.onSaveTemplate} className="cursor-pointer gap-2">
                <LayoutTemplate className="h-3.5 w-3.5" aria-hidden="true" />
                Save as template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" onClick={p.onShare} aria-label="Share" title="Share with people or create a client link" className={cn("gap-1.5 text-xs", TOUCH)}>
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">Share</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

export interface CanvasToolsProps {
  lassoMode: boolean;
  onLassoModeChange: (select: boolean) => void;
  showWorkflowNodes: boolean;
  onShowWorkflowNodes: (v: boolean) => void;
  showAnnotations: boolean;
  onShowAnnotations: (v: boolean) => void;
  showLabels: boolean;
  onShowLabels: (v: boolean) => void;
  showStepNumbers: boolean;
  onShowStepNumbers: (v: boolean) => void;
  selectedCount: number;
  onDeleteSelected: () => void;
}

/**
 * How the canvas behaves (pan or select, which layers show) sits on the canvas itself, not in the top bar.
 * Shown as a React Flow panel by the editor.
 */
export function CanvasTools(p: CanvasToolsProps) {
  const layersFiltered = !p.showWorkflowNodes || !p.showAnnotations || !p.showLabels || !p.showStepNumbers;
  return (
    <div className="flex items-center gap-2">
      <div
        role="group"
        aria-label="Canvas mode"
        className="flex overflow-hidden rounded-lg border border-border bg-card shadow-sm"
      >
        <button
          type="button"
          onClick={() => p.onLassoModeChange(false)}
          aria-pressed={!p.lassoMode}
          aria-label="Pan"
          title="Pan: drag to move around the canvas"
          className={cn(
            "flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-2.5 text-xs transition-colors md:min-h-8 md:min-w-0",
            !p.lassoMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <MousePointer2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden md:inline">Pan</span>
        </button>
        <button
          type="button"
          onClick={() => p.onLassoModeChange(true)}
          aria-pressed={p.lassoMode}
          aria-label="Select"
          title="Select: drag on empty canvas to select several steps"
          className={cn(
            "flex min-h-11 min-w-11 items-center justify-center gap-1.5 border-l border-border px-2.5 text-xs transition-colors md:min-h-8 md:min-w-0",
            p.lassoMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <BoxSelect className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden md:inline">Select</span>
        </button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label="View: choose which layers show"
            title="Choose which layers show"
            className={cn("gap-1.5 bg-card text-xs shadow-sm md:min-h-8", "min-h-11 min-w-11 md:min-w-0", layersFiltered ? "border-ring" : "text-muted-foreground")}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden md:inline">View</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="py-1.5 text-xs text-muted-foreground">Canvas layers</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={p.showWorkflowNodes} onCheckedChange={p.onShowWorkflowNodes} className="text-sm">
            Workflow nodes
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={p.showAnnotations} onCheckedChange={p.onShowAnnotations} className="text-sm">
            Annotations
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={p.showLabels} onCheckedChange={p.onShowLabels} className="text-sm">
            Node labels
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={p.showStepNumbers} onCheckedChange={p.onShowStepNumbers} className="text-sm">
            Step numbers
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {p.selectedCount > 1 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1 shadow-sm">
          <span className="text-xs tabular-nums text-foreground">{p.selectedCount} selected</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={p.onDeleteSelected}
            className="min-h-11 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive md:min-h-7"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="ml-1">Delete</span>
          </Button>
        </div>
      )}
    </div>
  );
}
