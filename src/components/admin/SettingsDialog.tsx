"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TabSelector } from "@/components/admin/TabSelector";
import { ChannelSelector } from "@/components/admin/ChannelSelector";
import type { CommunicationChannels, FeatureToggles } from "@/lib/types";

export interface SettingsEditingState {
  id: string;
  clientName: string;
  tabs: string[];
  channels: CommunicationChannels;
  featureToggles: FeatureToggles;
}

interface SettingsDialogProps {
  editing: SettingsEditingState | null;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onChannelsChange: (channels: CommunicationChannels) => void;
  onTabsChange: (tabs: string[]) => void;
  onFeatureTogglesChange: (toggles: FeatureToggles) => void;
}

export function SettingsDialog({
  editing,
  saving,
  onClose,
  onSave,
  onChannelsChange,
  onTabsChange,
  onFeatureTogglesChange,
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
