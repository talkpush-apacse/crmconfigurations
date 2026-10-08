"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ClipboardList, Download, Eye, History, Link2, MoreHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NavItem } from "./TopNav";
import { cn } from "@/lib/utils";
import { SaveButton } from "@/components/shared/SaveButton";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { useChecklistLook } from "@/components/layout/ChecklistLook";

interface HeaderProps {
  clientName: string;
  slug: string;
  items: NavItem[];
  saveStatus: "saved" | "saving" | "error";
  saveError?: string | null;
  onRetrySave?: () => void;
  isReadOnly?: boolean;
  editorToken?: string;
  hasPendingChanges?: boolean;
  /** Epoch ms of the last successful save. */
  lastSavedAt?: number | null;
  /** Saves now, rather than waiting for the autosave debounce. */
  onSave?: () => void;
  /** Reverts unsaved edits back to the last saved state. */
  onDiscard?: () => void;
  /**
   * "staff" sits under the shared Implementation Hub header (module switcher),
   * so it drops the brand strip and adds a way back to the checklist list.
   * "client" is the client and editor-link page, which has no hub header.
   */
  variant?: "staff" | "client";
  /** Staff only. The company this checklist is filed under: the way back leads to it instead of the checklist list. */
  company?: { id: string; name: string } | null;
  snapshotsHref?: string;
  /** Staff only. The edit history page: who changed what. */
  historyHref?: string;
  /** Editor link only. The person's name when they came in through a named link ("Editing as ..."). */
  editingAs?: string | null;
  /** Staff only. Opens the "Apply template" sheet from the actions menu. */
  onApplyTemplate?: () => void;
  /**
   * Admin only. The full link to share with the client. When set, the header
   * shows a "Copy link" button beside Export XLS.
   */
  shareLink?: string;
}

/**
 * The checklist bar: client name, progress, save state and one primary action.
 * Everything else (Snapshots, Apply template, Export) is secondary: outline
 * or inside the actions menu.
 */
export function Header({
  clientName,
  slug,
  items,
  saveStatus,
  saveError,
  onRetrySave,
  isReadOnly,
  editorToken,
  hasPendingChanges = false,
  lastSavedAt = null,
  onSave,
  onDiscard,
  variant = "client",
  company = null,
  snapshotsHref,
  historyHref,
  editingAs = null,
  onApplyTemplate,
  shareLink,
}: HeaderProps) {
  const isStaff = variant === "staff";
  const lookControl = useChecklistLook();
  const sameNameAsCompany =
    !!company && company.name.trim().toLowerCase() === clientName.trim().toLowerCase();

  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!shareLink) return;
    const ok = await copyToClipboard(shareLink);
    setCopyState(ok ? "copied" : "failed");
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
    copyResetRef.current = setTimeout(() => setCopyState("idle"), ok ? 2000 : 4000);
  }, [shareLink]);

  const copyLabel =
    copyState === "copied" ? "Link copied" : copyState === "failed" ? "Couldn't copy" : "Copy link";

  const handleExport = () => {
    const exportUrl = editorToken
      ? `/api/export/by-token/${editorToken}`
      : `/api/export/${slug}`;
    window.open(exportUrl, "_blank");
  };

  const { completeCount, inProgressCount, totalCount } = useMemo(() => {
    const statusItems = items.filter((item) => item.status !== null);

    return {
      completeCount: statusItems.filter((item) => item.status === "complete").length,
      inProgressCount: statusItems.filter((item) => item.status === "in-progress").length,
      totalCount: statusItems.length,
    };
  }, [items]);

  const completionPercent = totalCount > 0
    ? Math.round((completeCount / totalCount) * 100)
    : 0;

  // On wide screens Export is its own button, so the menu only has something
  // to hold when there are staff actions or the page look. On phones it always holds Export.
  const hasSecondaryActions =
    Boolean(snapshotsHref) || Boolean(historyHref) || Boolean(onApplyTemplate) || Boolean(lookControl);

  return (
    <header className="shrink-0 border-b border-border bg-card">
      {!isStaff && <div className="brand-gradient-strip h-1.5 w-full" aria-hidden="true" />}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex min-w-0 basis-full items-center gap-2 sm:basis-0 sm:flex-1">
          {isStaff && (
            sameNameAsCompany ? (
              // The company and the checklist share a name, so the trail would read "X / X". One arrow back instead.
              <Link
                href={`/admin/companies/${company!.id}`}
                aria-label={`Back to ${company!.name}`}
                title={`Back to ${company!.name}`}
                className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/70 md:size-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href={company ? `/admin/companies/${company.id}` : "/admin"}
                  className="flex min-h-11 max-w-40 shrink-0 items-center truncate rounded-md text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/70 md:min-h-8"
                >
                  {company ? company.name : "Checklists"}
                </Link>
                <span className="text-muted-foreground/60" aria-hidden="true">
                  /
                </span>
              </>
            )
          )}
          <h1 className="min-w-0 truncate font-[family-name:var(--font-display)] text-[19px] font-medium leading-tight tracking-[-0.02em] text-foreground">
            {clientName}
          </h1>
          {isReadOnly && (
            <span className="shrink-0 rounded-full border border-brand-amber/40 bg-brand-amber-lightest px-2.5 py-0.5 text-[11px] font-medium text-foreground">
              View only
            </span>
          )}
          {editingAs && (
            <span
              className="max-w-48 shrink-0 truncate rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-foreground"
              title={`Your changes are recorded under the name ${editingAs}`}
            >
              Editing as {editingAs}
            </span>
          )}
        </div>

        {totalCount > 0 && (
          <div
            className="hidden items-center gap-3 text-[13px] text-muted-foreground sm:flex"
            title={
              inProgressCount > 0
                ? `${completeCount} complete, ${inProgressCount} in progress, out of ${totalCount} sections`
                : undefined
            }
          >
            <span className="tabular-nums">
              <span className="font-medium text-foreground">{completeCount} of {totalCount}</span> complete
            </span>
            <div
              className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Checklist completion"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completionPercent}
            >
              <div
                className="h-full rounded-full bg-brand-sage-darker transition-all duration-300"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {/*
            Discard sits beside Save, and only while there is something to
            discard. A destructive action does not need to be permanently
            on screen next to the button people actually press.
          */}
          {!isReadOnly && hasPendingChanges && onDiscard && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (
                  window.confirm(
                    "Discard your unsaved changes? They cannot be recovered."
                  )
                ) {
                  onDiscard();
                }
              }}
              className="h-11 gap-1.5 px-3 text-xs text-muted-foreground md:h-8 md:px-2.5"
            >
              <X className="h-3 w-3" />
              Discard
            </Button>
          )}
          {isReadOnly ? null : (
            <SaveButton
              status={saveStatus}
              hasPendingChanges={hasPendingChanges}
              lastSavedAt={lastSavedAt}
              errorMessage={saveError}
              onSave={onSave ?? (() => {})}
              onRetry={onRetrySave}
              variant="compact"
            />
          )}

          {shareLink && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyLink}
              title="Copy the link to share with the client"
              className="hidden h-11 gap-1.5 px-3 text-[13px] sm:inline-flex md:h-8"
            >
              {copyState === "copied" ? (
                <Check className="h-4 w-4 text-brand-sage-darker" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              <span aria-live="polite">{copyLabel}</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            className="hidden h-11 gap-1.5 px-3 text-[13px] sm:inline-flex md:h-8"
          >
            <Download className="h-4 w-4" />
            Export XLS
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("size-11 md:size-8", !hasSecondaryActions && "sm:hidden")}
                aria-label="More checklist actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {shareLink && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    // Keep the menu open so "Link copied" is visible.
                    e.preventDefault();
                    void handleCopyLink();
                  }}
                  className="min-h-11 sm:hidden"
                >
                  {copyState === "copied" ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  {copyLabel}
                </DropdownMenuItem>
              )}
              {snapshotsHref && (
                <DropdownMenuItem asChild className="min-h-11 md:min-h-0">
                  <Link href={snapshotsHref}>
                    <History className="h-4 w-4" />
                    Snapshots
                  </Link>
                </DropdownMenuItem>
              )}
              {historyHref && (
                <DropdownMenuItem asChild className="min-h-11 md:min-h-0">
                  <Link href={historyHref}>
                    <History className="h-4 w-4" />
                    Edit history
                  </Link>
                </DropdownMenuItem>
              )}
              {onApplyTemplate && (
                <DropdownMenuItem onClick={onApplyTemplate} className="min-h-11 md:min-h-0">
                  <ClipboardList className="h-4 w-4" />
                  Apply template
                </DropdownMenuItem>
              )}
              {lookControl && (
                <>
                  {(shareLink || snapshotsHref || historyHref || onApplyTemplate) && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" />
                    Page look
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={lookControl.look}
                    onValueChange={(value) => lookControl.setLook(value === "classic" ? "classic" : "modern")}
                  >
                    <DropdownMenuRadioItem value="modern" className="min-h-11 md:min-h-0">
                      Modern
                      <span className="ml-auto pl-3 text-xs text-muted-foreground">larger text</span>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="classic" className="min-h-11 md:min-h-0">
                      Classic
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator className="sm:hidden" />
                </>
              )}
              <DropdownMenuItem onClick={handleExport} className="min-h-11 sm:hidden">
                <Download className="h-4 w-4" />
                Export XLS
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
