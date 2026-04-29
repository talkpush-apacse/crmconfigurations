"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabSelector } from "@/components/admin/TabSelector";
import { ChannelSelector } from "@/components/admin/ChannelSelector";
import { CustomFieldBuilder } from "@/components/admin/CustomFieldBuilder";
import { CustomTabManager } from "@/components/admin/CustomTabManager";
import type { CommunicationChannels, FeatureToggles, CustomFieldDef, CustomTab } from "@/lib/types";

export interface SettingsEditingState {
  id: string;
  clientName: string;
  ownerEmail: string;
  tabs: string[];
  channels: CommunicationChannels;
  featureToggles: FeatureToggles;
  isCustom: boolean;
  customSchema: CustomFieldDef[];
  customTabs: CustomTab[];
}

interface SettingsDialogProps {
  editing: SettingsEditingState | null;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onChannelsChange: (channels: CommunicationChannels) => void;
  onTabsChange: (tabs: string[]) => void;
  onFeatureTogglesChange: (toggles: FeatureToggles) => void;
  onOwnerEmailChange: (value: string) => void;
  onCustomSchemaChange?: (schema: CustomFieldDef[]) => void;
  onCustomTabsChange?: (tabs: CustomTab[]) => void;
}

export function SettingsDialog({
  editing,
  saving,
  onClose,
  onSave,
  onChannelsChange,
  onTabsChange,
  onFeatureTogglesChange,
  onOwnerEmailChange,
  onCustomSchemaChange,
  onCustomTabsChange,
}: SettingsDialogProps) {
  return (
    <Dialog open={!!editing} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[80vh] w-full max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Settings — {editing?.clientName}
          </DialogTitle>
        </DialogHeader>
        {editing && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Owner email (notifications)</Label>
              <Input
                id="ownerEmail"
                type="email"
                value={editing.ownerEmail}
                onChange={(event) => onOwnerEmailChange(event.target.value)}
                placeholder="owner@example.com"
              />
              <p className="text-xs text-muted-foreground">
                Receives an email when editors make changes or upload files. Leave blank to disable.
              </p>
            </div>
            {editing.isCustom ? (
              <CustomFieldBuilder
                value={editing.customSchema}
                onChange={(schema) => onCustomSchemaChange?.(schema)}
              />
            ) : (
              <>
                <ChannelSelector
                  channels={editing.channels}
                  onChange={onChannelsChange}
                  featureToggles={editing.featureToggles}
                  onFeatureTogglesChange={onFeatureTogglesChange}
                />
                <TabSelector
                  selectedTabs={editing.tabs}
                  onChange={onTabsChange}
                />
                <CustomTabManager
                  value={editing.customTabs}
                  onChange={(tabs) => onCustomTabsChange?.(tabs)}
                />
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={onSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
