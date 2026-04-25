"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { ExampleHint } from "@/components/shared/ExampleHint";
import { EditableTable } from "@/components/shared/EditableTable";
import { TabUploadBanner, TabUploadSkippedNotice } from "@/components/shared/TabUploadBanner";
import { useTabUpload } from "@/hooks/useTabUpload";
import { useChecklistContext } from "@/lib/checklist-context";
import { DROPDOWN_OPTIONS } from "@/lib/validations";
import { uid, defaultFolders } from "@/lib/template-data";
import type { ColumnDef, FolderRow } from "@/lib/types";
import { SectionFooter } from "@/components/shared/SectionFooter";
import { softDeleteByIds, appendBulkDuplicates } from "@/lib/duplicate-row";

const columns: ColumnDef[] = [
  { key: "folderName", label: "Folder Name", type: "text", description: "Name of the workflow stage/folder" },
  { key: "description", label: "Description", type: "textarea", description: "When candidates are moved to this folder" },
  { key: "movementType", label: "Movement Type", type: "dropdown", options: [...DROPDOWN_OPTIONS.movementTypes], description: "Whether candidates are moved here automatically or manually by a recruiter" },
  { key: "comments", label: "Comments", type: "textarea" },
];

export function FoldersSheet() {
  const { data, updateField } = useChecklistContext();
  const { isSkipped, uploadedFiles } = useTabUpload("folders");
  const allFolders = (data.folders as FolderRow[]) || defaultFolders;
  const folders = allFolders.filter((f) => !f.deletedAt);

  const fullIndexOf = (visibleIdx: number) => {
    const target = folders[visibleIdx];
    if (!target) return -1;
    return allFolders.findIndex((f) => f.id === target.id);
  };

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const fullIdx = fullIndexOf(index);
    if (fullIdx < 0) return;
    const updated = [...allFolders];
    updated[fullIdx] = { ...updated[fullIdx], [field]: value };
    updateField("folders", updated);
  };

  const handleAdd = () => {
    updateField("folders", [
      ...allFolders,
      { id: uid(), folderName: "", description: "", movementType: "", comments: "" },
    ]);
  };

  const handleDelete = (index: number) => {
    const target = folders[index];
    if (!target) return;
    updateField("folders", softDeleteByIds(allFolders, [target.id]));
  };

  const handleDuplicate = (index: number) => {
    const target = folders[index];
    if (!target) return;
    updateField("folders", appendBulkDuplicates("folders", allFolders, folders, [target.id]));
  };

  const handleBulkDelete = (ids: string[]) => {
    updateField("folders", softDeleteByIds(allFolders, ids));
  };

  const handleBulkDuplicate = (ids: string[]) => {
    updateField("folders", appendBulkDuplicates("folders", allFolders, folders, ids));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: uid(),
      folderName: "", description: "", movementType: "", comments: "",
      ...row,
    }));
    updateField("folders", [...allFolders, ...newRows]);
  };

  return (
    <div>
      <SectionHeader
        title="Folders"
        description="Configure the workflow stages (folders) that candidates move through during the recruitment process."
      />

      <TabUploadBanner tabKey="folders" tabLabel="Folders" />

      {isSkipped ? (
        <TabUploadSkippedNotice fileCount={uploadedFiles.length} />
      ) : (
        <>
      <ExampleHint>
        <p>Folders represent stages in your hiring pipeline. The default folders (Inbox, Interview, Hired, Rejected, Archived) cover most workflows. Add custom folders like &quot;Onboarding&quot;, &quot;Training&quot;, or &quot;For Pooling&quot; if needed.</p>
      </ExampleHint>

      <EditableTable
        columns={columns}
        data={folders}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        addLabel="Add Folder"
        sampleRow={{ folderName: "For Pooling", description: "Candidates held for future openings", movementType: "Manual", comments: "Custom stage" }}
        csvConfig={{
          sampleRow: { folderName: "Onboarding", description: "Candidates in onboarding process", movementType: "Manual" },
          onImport: handleCsvImport,
          sheetName: "Folders",
        }}
        bulkActions={{
          itemLabel: "folder",
          itemLabelPlural: "folders",
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
