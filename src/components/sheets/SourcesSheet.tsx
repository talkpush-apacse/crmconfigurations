"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { EditableTable } from "@/components/shared/EditableTable";
import { useChecklistContext } from "@/lib/checklist-context";
import { defaultSources } from "@/lib/template-data";
import type { ColumnDef, SourceRow } from "@/lib/types";

const columns: ColumnDef[] = [
  { key: "category", label: "Source Category", type: "text", description: "Category of the sourcing channel (e.g., Social Media, Job Boards, Referral)" },
  { key: "subcategory", label: "Source Subcategory", type: "text", description: "Specific platform or channel name (e.g., Facebook, LinkedIn, Indeed)" },
  { key: "link", label: "Link", type: "text", description: "URL to the source/channel page" },
  { key: "comments", label: "Comments", type: "text" },
];

export function SourcesSheet() {
  const { data, updateField } = useChecklistContext();
  const sources = (data.sources as SourceRow[]) || defaultSources;

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...sources];
    updated[index] = { ...updated[index], [field]: value };
    updateField("sources", updated);
  };

  const handleAdd = () => {
    updateField("sources", [
      ...sources,
      { id: Math.random().toString(36).substring(2, 9), category: "", subcategory: "", link: "", comments: "" },
    ]);
  };

  const handleDelete = (index: number) => {
    updateField("sources", sources.filter((_, i) => i !== index));
  };

  const handleDuplicate = (index: number) => {
    const clone = { ...sources[index], id: Math.random().toString(36).substring(2, 9) };
    const updated = [...sources];
    updated.splice(index + 1, 0, clone);
    updateField("sources", updated);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: Math.random().toString(36).substring(2, 9),
      category: "", subcategory: "", link: "", comments: "",
      ...row,
    }));
    updateField("sources", [...sources, ...newRows]);
  };

  return (
    <div>
      <SectionHeader
        title="Sources"
        description="Define the candidate sourcing channels and their details."
      />
      <EditableTable
        columns={columns}
        data={sources}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        addLabel="Add Source"
        csvConfig={{
          sampleRow: { category: "Job Boards", subcategory: "Indeed", link: "https://indeed.com" },
          onImport: handleCsvImport,
          sheetName: "Sources",
        }}
      />
    </div>
  );
}
