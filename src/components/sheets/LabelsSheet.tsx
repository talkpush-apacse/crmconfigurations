"use client";

import { EditableTable } from "@/components/shared/EditableTable";
import { SheetIntro } from "@/components/shared/SheetIntro";
import { SectionFooter } from "@/components/shared/SectionFooter";
import { useChecklistContext } from "@/lib/checklist-context";
import { uid } from "@/lib/template-data";
import { softDeleteByIds, appendBulkDuplicates } from "@/lib/duplicate-row";
import type { ColumnDef, LabelRow } from "@/lib/types";

const labelColumns: ColumnDef[] = [
  {
    key: "name",
    label: "Label name",
    type: "text",
    required: true,
    example: "Priority Candidate",
    description:
      "The tag recruiters will see and apply to candidates. Keep it short — it appears as a chip on the candidate record.",
  },
  {
    key: "color",
    label: "Color",
    type: "text",
    example: "#FF5733",
    description:
      "Optional hex colour for the chip, e.g. #FF5733. Leave blank to use the default grey.",
  },
];

const emptyLabelRow: LabelRow = {
  id: "",
  name: "",
  color: "#6366F1",
};

/**
 * Labels used to be a second section inside Rejection Reasons, which put a
 * Talkpush-side concern inside a tab the client fills in. They are now their
 * own tab, marked as Talkpush-filled so the client-facing checklist hides it.
 */
export function LabelsSheet() {
  const { data, updateField } = useChecklistContext();
  const allLabels = (data.labels as LabelRow[] | null) ?? [];
  const labels = allLabels.filter((l) => !l.deletedAt);

  // Visible list hides soft-deleted rows, so an index has to be mapped back
  // to the full array before writing.
  const fullLabelIndexOf = (visibleIdx: number) => {
    const target = labels[visibleIdx];
    if (!target) return -1;
    return allLabels.findIndex((l) => l.id === target.id);
  };

  const handleLabelUpdate = (index: number, field: string, value: string | boolean) => {
    const fullIdx = fullLabelIndexOf(index);
    if (fullIdx < 0) return;
    const updated = [...allLabels];
    updated[fullIdx] = { ...updated[fullIdx], [field]: value };
    updateField("labels", updated);
  };

  const handleLabelAdd = () => {
    updateField("labels", [
      ...allLabels,
      { ...emptyLabelRow, id: uid() },
    ]);
  };

  const handleLabelDelete = (index: number) => {
    const target = labels[index];
    if (!target) return;
    updateField("labels", softDeleteByIds(allLabels, [target.id]));
  };

  const handleLabelBulkDelete = (ids: string[]) => {
    updateField("labels", softDeleteByIds(allLabels, ids));
  };

  const handleLabelBulkDuplicate = (ids: string[]) => {
    updateField("labels", appendBulkDuplicates("labels", allLabels, labels, ids));
  };

  return (
    <div>
      <SheetIntro
        title="Labels"
        description="Labels are tags you can apply to candidates in Talkpush CRM to mark status, priority, or any custom classification. Each label can have a color for quick visual identification."
      />

      <EditableTable
        columns={labelColumns}
        data={labels}
        onUpdate={handleLabelUpdate}
        onAdd={handleLabelAdd}
        onDelete={handleLabelDelete}
        spreadsheetMode
        tableId="labels"
        addLabel="Add Label"
        sampleRow={{ name: "Priority Candidate", color: "#FF5733" }}
        bulkActions={{
          itemLabel: "label",
          itemLabelPlural: "labels",
          onBulkDelete: handleLabelBulkDelete,
          onBulkDuplicate: handleLabelBulkDuplicate,
        }}
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

      <SectionFooter />
    </div>
  );
}
