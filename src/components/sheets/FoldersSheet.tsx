"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { EditableTable } from "@/components/shared/EditableTable";
import { useChecklistContext } from "@/lib/checklist-context";
import { DROPDOWN_OPTIONS } from "@/lib/validations";
import { defaultFolders } from "@/lib/template-data";
import type { ColumnDef, FolderRow } from "@/lib/types";

const columns: ColumnDef[] = [
  { key: "folderName", label: "Folder Name", type: "text", description: "Name of the workflow stage/folder" },
  { key: "description", label: "Description", type: "text", description: "When candidates are moved to this folder" },
  { key: "movementType", label: "Movement Type", type: "dropdown", options: [...DROPDOWN_OPTIONS.movementTypes], description: "Whether candidates are moved here automatically or manually by a recruiter" },
  { key: "comments", label: "Comments", type: "text" },
];

export function FoldersSheet() {
  const { data, updateField } = useChecklistContext();
  const folders = (data.folders as FolderRow[]) || defaultFolders;

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...folders];
    updated[index] = { ...updated[index], [field]: value };
    updateField("folders", updated);
  };

  const handleAdd = () => {
    updateField("folders", [
      ...folders,
      { id: Math.random().toString(36).substring(2, 9), folderName: "", description: "", movementType: "", comments: "" },
    ]);
  };

  const handleDelete = (index: number) => {
    updateField("folders", folders.filter((_, i) => i !== index));
  };

  const handleDuplicate = (index: number) => {
    const clone = { ...folders[index], id: Math.random().toString(36).substring(2, 9) };
    const updated = [...folders];
    updated.splice(index + 1, 0, clone);
    updateField("folders", updated);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: Math.random().toString(36).substring(2, 9),
      folderName: "", description: "", movementType: "", comments: "",
      ...row,
    }));
    updateField("folders", [...folders, ...newRows]);
  };

  return (
    <div>
      <SectionHeader
        title="Folders"
        description="Configure the workflow stages (folders) that candidates move through during the recruitment process."
      />
      <EditableTable
        columns={columns}
        data={folders}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        addLabel="Add Folder"
        csvConfig={{
          sampleRow: { folderName: "Onboarding", description: "Candidates in onboarding process", movementType: "Manual" },
          onImport: handleCsvImport,
          sheetName: "Folders",
        }}
      />
    </div>
  );
}
