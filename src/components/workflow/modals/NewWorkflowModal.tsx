"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/workflow/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LoadingButton from "@/components/workflow/ui/LoadingButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const NO_COMPANY = "__none";

interface NewWorkflowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string | null;
  templateName?: string | null;
  /** Opened from a company's page: the workflow is filed under it and the client name is that company's. */
  account?: { id: string; name: string } | null;
}

export default function NewWorkflowModal({
  open,
  onOpenChange,
  templateId,
  templateName,
  account,
}: NewWorkflowModalProps) {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [workflowName, setWorkflowName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  // From the all-workflows list, staff may pick a company (or leave it for later: it then waits under "Needs a company").
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companyId, setCompanyId] = useState(NO_COMPANY);

  useEffect(() => {
    if (!open || account) return;
    let cancelled = false;
    fetch("/api/tracker/accounts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((r) => !cancelled && setCompanies(r.accounts ?? []))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, account]);

  function pickCompany(id: string) {
    setCompanyId(id);
    const picked = companies.find((c) => c.id === id);
    // Fill the client name from the company unless staff already typed one.
    if (picked && !clientName.trim()) setClientName(picked.name);
  }

  function resetForm() {
    setCompanyId(NO_COMPANY);
    setClientName("");
    setWorkflowName("");
    setDescription("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!(account ? account.name : clientName).trim() || !workflowName.trim()) {
      toast.error("Client name and workflow name are required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: (account ? account.name : clientName).trim(),
          accountId: account ? account.id : companyId === NO_COMPANY ? undefined : companyId,
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
            {templateId ? `New workflow from "${templateName}"` : "New workflow"}
          </DialogTitle>
          <DialogDescription>
            {account ? `This workflow will be filed under ${account.name}.` : "Set the client name and workflow title before opening the editor."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!account && companies.length > 0 && (
            <div>
              <label htmlFor="new-workflow-company" className="text-sm font-medium text-foreground/85 mb-1 block">
                Company
              </label>
              <Select value={companyId} onValueChange={pickCompany}>
                <SelectTrigger id="new-workflow-company" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COMPANY}>No company yet (add one later)</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!account && (
            <div>
              <label className="text-sm font-medium text-foreground/85 mb-1 block">
                Client Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. TaskUs, Inspiro"
                className="border border-input bg-card focus:ring-2 focus:ring-ring focus:border-ring"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-foreground/85 mb-1 block">
              Workflow Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="e.g. CSR Screening Flow"
              className="border border-input bg-card focus:ring-2 focus:ring-ring focus:border-ring"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/85 mb-1 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this workflow..."
              rows={3}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring focus:outline-none"
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
              disabled={!(account ? account.name : clientName).trim() || !workflowName.trim()}
            >
              Create Workflow
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
