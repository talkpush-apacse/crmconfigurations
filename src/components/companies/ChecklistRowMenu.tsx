"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, ArrowRightLeft, CheckCircle, Copy, Download, History, Link2, MoreHorizontal, RefreshCw, Settings, Trash2, Unlink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EditLinksDialog } from "@/components/admin/EditLinksDialog";
import { SettingsDialog } from "@/components/admin/SettingsDialog";
import { ConfirmDialog } from "@/components/tracker/ConfirmDialog";
import { toast } from "@/components/workflow/ui/toast";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import {
  type ChecklistSettingsDraft,
  duplicateChecklist,
  regenerateEditorToken,
  saveChecklistSettings,
  toSettingsDraft,
  withChannelsChanged,
  withTabsChanged,
} from "@/lib/checklist-admin-actions";
import type { CompanyChecklistItem } from "@/lib/companies/overview";

const ITEM = "min-h-11 cursor-pointer md:min-h-0";

/**
 * The "..." menu on a checklist row of a company page: the same actions as the main checklist list,
 * plus the two that move it between companies. Everyone gets copy link, export and history;
 * only people who can edit get the rest.
 */
export function ChecklistRowMenu({
  item,
  accountId,
  canEdit,
  onChanged,
  onMove,
  onRemove,
  onArchive,
  onDelete,
}: {
  item: CompanyChecklistItem;
  accountId: string;
  canEdit: boolean;
  /** Reload the company page after something changed. */
  onChanged: () => void;
  onMove: () => void;
  onRemove: () => void;
  onArchive: () => void;
  /** Called once the person confirms. The page runs the delete, with its undo window. */
  onDelete: () => void;
}) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [editing, setEditing] = useState<ChecklistSettingsDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [namedLinks, setNamedLinks] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const copyEditorLink = async () => {
    if (!(await copyToClipboard(`${window.location.origin}/editor/${item.editorToken}/welcome`))) {
      toast.error("Couldn't copy the link. Copy it from the address bar of the editor page instead.");
      return;
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const duplicate = async () => {
    try {
      const copy = await duplicateChecklist(item.id, accountId);
      toast.success(`Checklist duplicated: ${copy.name}`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to copy checklist");
    }
  };

  const saveSettings = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await saveChecklistSettings(editing);
      setEditing(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11 md:min-h-8 md:min-w-8" aria-label={`Actions for ${item.clientName}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem className={ITEM} onSelect={copyEditorLink}>
            {linkCopied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Link2 className="h-4 w-4" />}
            {linkCopied ? "Editor link copied" : "Copy editor link"}
          </DropdownMenuItem>
          <DropdownMenuItem asChild className={ITEM}>
            <a href={`/api/export/${item.slug}`} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
              Export to XLS
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className={ITEM}>
            <Link href={`/admin/checklists/${item.id}/history`}>
              <History className="h-4 w-4" />
              Edit history
            </Link>
          </DropdownMenuItem>
          {canEdit && (
            <>
              <DropdownMenuItem className={ITEM} onSelect={() => setEditing(toSettingsDraft(item))}>
                <Settings className="h-4 w-4" />
                Configure settings
              </DropdownMenuItem>
              <DropdownMenuItem className={ITEM} onSelect={duplicate}>
                <Copy className="h-4 w-4" />
                Duplicate checklist
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={ITEM} onSelect={() => setNamedLinks(true)}>
                <Users className="h-4 w-4" />
                Named edit links
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={ITEM} onSelect={onMove}>
                <ArrowRightLeft className="h-4 w-4" />
                Move to another account
              </DropdownMenuItem>
              <DropdownMenuItem className={ITEM} onSelect={onRemove}>
                <Unlink className="h-4 w-4" />
                Take out of this account
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={ITEM} onSelect={() => setRegenerating(true)}>
                <RefreshCw className="h-4 w-4" />
                Regenerate original editor link
              </DropdownMenuItem>
              <DropdownMenuItem className={ITEM} onSelect={onArchive}>
                <Archive className="h-4 w-4" />
                Archive checklist
              </DropdownMenuItem>
              <DropdownMenuItem className={`${ITEM} text-destructive focus:text-destructive`} onSelect={() => setDeleting(true)}>
                <Trash2 className="h-4 w-4" />
                Delete checklist
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canEdit && (
        <>
          <SettingsDialog
            editing={editing}
            saving={saving}
            onClose={() => setEditing(null)}
            onSave={saveSettings}
            onChannelsChange={(channels) => setEditing((prev) => (prev ? withChannelsChanged(prev, channels) : prev))}
            onTabsChange={(tabs) => setEditing((prev) => (prev ? withTabsChanged(prev, tabs) : prev))}
            onFeatureTogglesChange={(featureToggles) => setEditing((prev) => (prev ? { ...prev, featureToggles } : prev))}
            onOwnerEmailChange={(ownerEmail) => setEditing((prev) => (prev ? { ...prev, ownerEmail } : prev))}
            onCustomSchemaChange={(customSchema) => setEditing((prev) => (prev ? { ...prev, customSchema } : prev))}
            onCustomTabsChange={(customTabs) => setEditing((prev) => (prev ? { ...prev, customTabs } : prev))}
          />
          {namedLinks && <EditLinksDialog checklistId={item.id} clientName={item.clientName} open onOpenChange={(open) => !open && setNamedLinks(false)} />}
          <ConfirmDialog
            open={regenerating}
            onOpenChange={setRegenerating}
            title="Regenerate editor link?"
            description={`This will invalidate the current editor link for ${item.clientName}. Anyone using the old link will lose access immediately.`}
            confirmLabel="Regenerate"
            onConfirm={async () => {
              try {
                await regenerateEditorToken(item.id);
                toast.success(`Editor link regenerated for ${item.clientName}`);
                onChanged();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to regenerate token");
              }
            }}
          />
          <ConfirmDialog
            open={deleting}
            onOpenChange={setDeleting}
            title="Delete checklist?"
            description={`Delete ${item.clientName}? You will have 5 seconds to undo it. After that it cannot be undone.`}
            confirmLabel="Delete"
            onConfirm={onDelete}
          />
        </>
      )}
    </>
  );
}
