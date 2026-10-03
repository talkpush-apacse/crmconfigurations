"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/workflow/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LoadingButton from "@/components/workflow/ui/LoadingButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface NewWorkflowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string | null;
  templateName?: string | null;
}

export default function NewWorkflowModal({
  open,
  onOpenChange,
  templateId,
  templateName,
}: NewWorkflowModalProps) {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [workflowName, setWorkflowName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setClientName("");
    setWorkflowName("");
    setDescription("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!clientName.trim() || !workflowName.trim()) {
      toast.error("Client name and workflow name are required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          workflowName: workflowName.trim(),
          description: description.trim() || null,
          templateId: templateId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create workflow");
      }

      const { id } = await res.json();
      toast.success("Workflow created");
      resetForm();
      onOpenChange(false);
      router.push(`/admin/workflows/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create workflow");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {templateId ? `New Workflow from "${templateName}"` : "New Workflow"}
          </DialogTitle>
          <DialogDescription>
            Set the client name and workflow title before opening the editor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Client Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. TaskUs, Inspiro"
              className="border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Workflow Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="e.g. CSR Screening Flow"
              className="border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this workflow..."
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <LoadingButton
              type="submit"
              variant="cta"
              isLoading={saving}
              disabled={!clientName.trim() || !workflowName.trim()}
            >
              Create Workflow
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
