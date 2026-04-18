"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useChecklistContext } from "@/lib/checklist-context";
import { EditableTable } from "@/components/shared/EditableTable";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/shared/SectionHeader";
import type { AutoflowRule, ColumnDef } from "@/lib/types";

const autoflowColumns: ColumnDef[] = [
  {
    key: "triggerType",
    label: "Trigger Type",
    type: "dropdown",
    options: ["Folder Entry", "Attribute Change"],
  },
  { key: "triggerSource", label: "Trigger Folder / Attribute", type: "text" },
  { key: "condition", label: "Condition", type: "text" },
  {
    key: "action",
    label: "Action",
    type: "dropdown",
    options: ["Move", "Send Message", "Move + Send Message", "Tag", "Block", "Tag + Block"],
  },
  { key: "targetFolder", label: "Target Folder", type: "text" },
  { key: "timing", label: "Timing", type: "text" },
  { key: "messageTemplate", label: "Message Template", type: "text" },
  { key: "rejectionReason", label: "Rejection Reason", type: "text" },
  { key: "notes", label: "Notes", type: "text" },
];

function emptyRule(group: string): AutoflowRule {
  return {
    id: crypto.randomUUID(),
    group,
    triggerType: "Folder Entry",
    triggerSource: "",
    condition: "",
    action: "Move",
    targetFolder: "",
    timing: "",
    messageTemplate: "",
    rejectionReason: "",
    notes: "",
  };
}

interface GroupSectionProps {
  groupName: string;
  rules: AutoflowRule[];
  allRules: AutoflowRule[];
  onUpdate: (newRules: AutoflowRule[]) => void;
}

function GroupSection({ groupName, rules, allRules, onUpdate }: GroupSectionProps) {
  const [open, setOpen] = useState(true);

  const handleUpdate = (localIndex: number, field: string, value: string | boolean) => {
    const globalIndex = allRules.findIndex((r) => r.id === rules[localIndex].id);
    if (globalIndex === -1) return;
    const updated = allRules.map((r, i) =>
      i === globalIndex ? { ...r, [field]: value } : r
    );
    onUpdate(updated);
  };

  const handleAdd = () => {
    onUpdate([...allRules, emptyRule(groupName)]);
  };

  const handleDelete = (localIndex: number) => {
    const target = rules[localIndex];
    onUpdate(allRules.filter((r) => r.id !== target.id));
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-4">
      <div className="flex items-center gap-2 rounded-t-lg border border-b-0 bg-slate-50 px-4 py-2.5">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900">
            {open ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
            {groupName}
            <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
              {rules.length}
            </span>
          </button>
        </CollapsibleTrigger>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={handleAdd} className="h-7 text-xs gap-1">
          <Plus className="h-3 w-3" />
          Add Rule
        </Button>
      </div>
      <CollapsibleContent>
        <div className="rounded-b-lg border border-t-0 overflow-hidden">
          <EditableTable
            columns={autoflowColumns}
            data={rules}
            onUpdate={handleUpdate}
            onAdd={handleAdd}
            onDelete={handleDelete}
            addLabel="Add Rule"
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface AutoflowsSheetProps {
  isAdmin: boolean;
}

export function AutoflowsSheet({ isAdmin }: AutoflowsSheetProps) {
  const { data, updateField } = useChecklistContext();
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Access restricted</p>
      </div>
    );
  }

  const rules: AutoflowRule[] = Array.isArray(data.autoflows) ? data.autoflows : [];

  const groups = Array.from(new Set(rules.map((r) => r.group))).filter(Boolean);

  const handleUpdate = (newRules: AutoflowRule[]) => {
    updateField("autoflows", newRules);
  };

  const handleAddGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    updateField("autoflows", [...rules, emptyRule(name)]);
    setNewGroupName("");
    setAddGroupOpen(false);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Autoflows"
        description="Configure automation rules that trigger folder movements, messages, and other actions based on candidate activity."
      />

      {groups.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
          <p className="text-sm text-muted-foreground">No autoflow groups yet. Add a group to get started.</p>
        </div>
      )}

      {groups.map((groupName) => {
        const groupRules = rules.filter((r) => r.group === groupName);
        return (
          <GroupSection
            key={groupName}
            groupName={groupName}
            rules={groupRules}
            allRules={rules}
            onUpdate={handleUpdate}
          />
        );
      })}

      <div className="pt-2">
        <Button variant="outline" onClick={() => setAddGroupOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Group
        </Button>
      </div>

      <Dialog open={addGroupOpen} onOpenChange={setAddGroupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Autoflow Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              placeholder="e.g. Prescreening"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddGroupOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddGroup} disabled={!newGroupName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
