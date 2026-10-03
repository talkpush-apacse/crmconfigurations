"use client";

import { useEffect, useState } from "react";
import { Check, GitBranch, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/workflow/ui/radio-group";

export type EdgeConnectionType = "recovery" | "branch" | "happy";

type EdgeTypeModalProps = {
  open: boolean;
  targetLabel: string;
  targetStepNumber: string;
  onCancel: () => void;
  onConfirm: (type: EdgeConnectionType) => void;
};

export default function EdgeTypeModal({
  open,
  targetLabel,
  targetStepNumber,
  onCancel,
  onConfirm,
}: EdgeTypeModalProps) {
  const [value, setValue] = useState<EdgeConnectionType>("recovery");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ported as is from the original editor; revisit in the phase 5 cleanup
    if (open) setValue("recovery");
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect back to Step {targetStepNumber}</DialogTitle>
          <DialogDescription>
            Choose how this connector should behave when it points to{" "}
            <span className="font-medium text-gray-700">{targetLabel}</span>.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={value}
          onValueChange={(next) => setValue(next as EdgeConnectionType)}
          className="gap-2"
        >
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-teal-100 bg-teal-50/60 p-3">
            <RadioGroupItem value="recovery" className="mt-0.5" />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                Recovery path
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-gray-500">
                Use this when a branch returns to an existing main workflow step.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white p-3">
            <RadioGroupItem value="happy" className="mt-0.5" />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                <Check className="w-3.5 h-3.5 text-teal-500" />
                Happy path
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-gray-500">
                Mark this connector as the main success path from the source step.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white p-3">
            <RadioGroupItem value="branch" className="mt-0.5" />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                <GitBranch className="w-3.5 h-3.5 text-gray-500" />
                Branch path
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-gray-500">
                Use this for a normal connector that should remain part of the branch.
              </span>
            </span>
          </label>
        </RadioGroup>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="cta"
            size="sm"
            onClick={() => onConfirm(value)}
          >
            Create connector
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
