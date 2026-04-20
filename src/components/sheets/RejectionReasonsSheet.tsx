"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ExampleHint } from "@/components/shared/ExampleHint";
import { EditableTable } from "@/components/shared/EditableTable";
import { TabUploadBanner, TabUploadSkippedNotice } from "@/components/shared/TabUploadBanner";
import { useTabUpload } from "@/hooks/useTabUpload";
import { useChecklistContext } from "@/lib/checklist-context";
import { defaultRejectionReasons, uid } from "@/lib/template-data";
import { SectionFooter } from "@/components/shared/SectionFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { ColumnDef, LabelRow } from "@/lib/types";

const labelColumns: ColumnDef[] = [
  { key: "name", label: "Label name", type: "text", required: true, example: "Priority Candidate" },
  { key: "color", label: "Color", type: "text", example: "#FF5733" },
];

const emptyLabelRow: LabelRow = {
  id: "",
  name: "",
  color: "#6366F1",
};

export function RejectionReasonsSheet() {
  const { data, updateField, isReadOnly } = useChecklistContext();
  const { isSkipped, uploadedFiles } = useTabUpload("rejectionReasons");
  const reasons = (data.rejectionReasons as string[]) || defaultRejectionReasons;
  const labels = (data.labels as LabelRow[] | null) ?? [];
  const [newReason, setNewReason] = useState("");

  const handleAdd = () => {
    const trimmed = newReason.trim();
    if (!trimmed) return;
    if (reasons.some((r) => r.toLowerCase() === trimmed.toLowerCase())) return;
    updateField("rejectionReasons", [...reasons, trimmed]);
    setNewReason("");
  };

  const handleRemove = (index: number) => {
    updateField(
      "rejectionReasons",
      reasons.filter((_, i) => i !== index)
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleLabelUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...labels];
    updated[index] = { ...updated[index], [field]: value };
    updateField("labels", updated);
  };

  const handleLabelAdd = () => {
    updateField("labels", [
      ...labels,
      { ...emptyLabelRow, id: uid() },
    ]);
  };

  const handleLabelDelete = (index: number) => {
    updateField("labels", labels.filter((_, i) => i !== index));
  };

  return (
    <div>
      <SectionHeader
        title="Rejection Reasons"
        description="Define the standard rejection reasons that recruiters can select when rejecting a candidate. These will appear as options in the CRM."
      />

      <TabUploadBanner tabKey="rejectionReasons" tabLabel="Rejection Reasons" />

      {isSkipped ? (
        <TabUploadSkippedNotice fileCount={uploadedFiles.length} />
      ) : (
        <>
          <ExampleHint>
            <p>
              Add all the rejection reasons your team uses. Common examples include
              &quot;Not Qualified&quot;, &quot;Salary Expectations&quot;, and
              &quot;Wrong Location&quot;. Recruiters will pick from this list when
              moving candidates to Rejected.
            </p>
          </ExampleHint>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
            {/* Tag cloud */}
            <div className="flex flex-wrap gap-2">
              {reasons.map((reason, index) => (
                <span
                  key={`${reason}-${index}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700"
                >
                  {reason}
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemove(index)}
                      className="ml-0.5 rounded-full p-0.5 text-emerald-500 transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-inset"
                      aria-label={`Remove ${reason}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              ))}
              {reasons.length === 0 && (
                <p className="text-sm text-gray-400">
                  No rejection reasons defined yet. Add one below.
                </p>
              )}
            </div>

            {/* Add new reason */}
            {!isReadOnly && (
              <div className="mt-4 flex gap-2">
                <Input
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a new rejection reason…"
                  className="max-w-sm border border-gray-300 bg-white placeholder:text-gray-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
                <Button
                  type="button"
                  onClick={handleAdd}
                  disabled={!newReason.trim()}
                  size="sm"
                  className="shrink-0"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </div>
            )}

            {/* Count */}
            <p className="mt-4 text-xs text-gray-400">
              {reasons.length} reason{reasons.length !== 1 ? "s" : ""} configured
            </p>
          </div>

          <Separator className="my-8" />

          <SectionHeader
            title="Labels"
            description="Labels are tags you can apply to candidates in Talkpush CRM to mark status, priority, or any custom classification. Each label can have a color for quick visual identification."
          />

          <EditableTable
            columns={labelColumns}
            data={labels}
            onUpdate={handleLabelUpdate}
            onAdd={handleLabelAdd}
            onDelete={handleLabelDelete}
            addLabel="Add Label"
            sampleRow={{ name: "Priority Candidate", color: "#FF5733" }}
            renderCellPrefix={({ column, value }) => {
              if (column.key !== "color" || typeof value !== "string") return null;

              return (
                <span
                  aria-hidden="true"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    backgroundColor: value || "#6366F1",
                    border: "1px solid rgba(15, 23, 42, 0.2)",
                    flexShrink: 0,
                  }}
                />
              );
            }}
          />
        </>
      )}

      <SectionFooter />
    </div>
  );
}
