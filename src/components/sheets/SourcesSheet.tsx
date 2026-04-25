"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { ExampleHint } from "@/components/shared/ExampleHint";
import { EditableTable } from "@/components/shared/EditableTable";
import { TabUploadBanner, TabUploadSkippedNotice } from "@/components/shared/TabUploadBanner";
import { useTabUpload } from "@/hooks/useTabUpload";
import { useChecklistContext } from "@/lib/checklist-context";
import { uid, defaultSources } from "@/lib/template-data";
import type { ColumnDef, SourceRow } from "@/lib/types";
import { SectionFooter } from "@/components/shared/SectionFooter";
import { softDeleteByIds, appendBulkDuplicates } from "@/lib/duplicate-row";

const columns: ColumnDef[] = [
  { key: "category", label: "Source Category", type: "text", description: "Category of the sourcing channel (e.g., Social Media, Job Boards, Referral)" },
  { key: "subcategory", label: "Source Subcategory", type: "text", description: "Specific platform or channel name (e.g., Facebook, LinkedIn, Indeed)" },
  { key: "link", label: "Link", type: "text", description: "URL to the source/channel page", validation: "url" },
  { key: "comments", label: "Comments", type: "textarea" },
];

export function SourcesSheet() {
  const { data, updateField } = useChecklistContext();
  const { isSkipped, uploadedFiles } = useTabUpload("sources");
  const allSources = (data.sources as SourceRow[]) || defaultSources;
  const sources = allSources.filter((s) => !s.deletedAt);

  const fullIndexOf = (visibleIdx: number) => {
    const target = sources[visibleIdx];
    if (!target) return -1;
    return allSources.findIndex((s) => s.id === target.id);
  };

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const fullIdx = fullIndexOf(index);
    if (fullIdx < 0) return;
    const updated = [...allSources];
    updated[fullIdx] = { ...updated[fullIdx], [field]: value };
    updateField("sources", updated);
  };

  const handleAdd = () => {
    updateField("sources", [
      ...allSources,
      { id: uid(), category: "", subcategory: "", link: "", comments: "" },
    ]);
  };

  const handleDelete = (index: number) => {
    const target = sources[index];
    if (!target) return;
    updateField("sources", softDeleteByIds(allSources, [target.id]));
  };

  const handleDuplicate = (index: number) => {
    const target = sources[index];
    if (!target) return;
    updateField("sources", appendBulkDuplicates("sources", allSources, sources, [target.id]));
  };

  const handleBulkDelete = (ids: string[]) => {
    updateField("sources", softDeleteByIds(allSources, ids));
  };

  const handleBulkDuplicate = (ids: string[]) => {
    updateField("sources", appendBulkDuplicates("sources", allSources, sources, ids));
  };

  // Reorder operates on visible rows; merge back into full array preserving
  // soft-deleted rows' original slots.
  const handleReorder = (reordered: SourceRow[]) => {
    let visIdx = 0;
    const merged = allSources.map((row) => {
      if (row.deletedAt) return row;
      return reordered[visIdx++] ?? row;
    });
    updateField("sources", merged);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: uid(),
      category: "", subcategory: "", link: "", comments: "",
      ...row,
    }));
    updateField("sources", [...allSources, ...newRows]);
  };

  return (
    <div>
      <SectionHeader
        title="Sources"
        description="Define the candidate sourcing channels and their details."
      />

      <TabUploadBanner tabKey="sources" tabLabel="Sources" />

      {isSkipped ? (
        <TabUploadSkippedNotice fileCount={uploadedFiles.length} />
      ) : (
        <>
      <ExampleHint>
        <p className="mb-1 font-medium">Sample sourcing channels:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>Job Boards</strong> | Indeed | https://indeed.com/company-page</li>
          <li><strong>Social Media</strong> | Facebook Jobs | https://facebook.com/company/jobs</li>
          <li><strong>Referral</strong> | Employee Referral Program | &mdash;</li>
        </ul>
      </ExampleHint>

      <EditableTable
        columns={columns}
        data={sources}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onReorder={handleReorder}
        addLabel="Add Source"
        sampleRow={{ category: "Job Boards", subcategory: "Indeed", link: "https://indeed.com/company-page", comments: "Primary job board" }}
        csvConfig={{
          sampleRow: { category: "Job Boards", subcategory: "Indeed", link: "https://indeed.com" },
          onImport: handleCsvImport,
          sheetName: "Sources",
        }}
        bulkActions={{
          itemLabel: "source",
          itemLabelPlural: "sources",
          onBulkDelete: handleBulkDelete,
          onBulkDuplicate: handleBulkDuplicate,
        }}
      />
        </>
      )}
      <SectionFooter />
    </div>
  );
}
