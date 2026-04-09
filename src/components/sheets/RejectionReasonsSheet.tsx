"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ExampleHint } from "@/components/shared/ExampleHint";
import { useChecklistContext } from "@/lib/checklist-context";
import { defaultRejectionReasons } from "@/lib/template-data";
import { SectionFooter } from "@/components/shared/SectionFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RejectionReasonsSheet() {
  const { data, updateField, isReadOnly } = useChecklistContext();
  const reasons = (data.rejectionReasons as string[]) || defaultRejectionReasons;
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

  return (
    <div>
      <SectionHeader
        title="Rejection Reasons"
        description="Define the standard rejection reasons that recruiters can select when rejecting a candidate. These will appear as options in the CRM."
      />
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

      <SectionFooter />
    </div>
  );
}
