"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { ExampleHint } from "@/components/shared/ExampleHint";
import { EditableTable } from "@/components/shared/EditableTable";
import { useChecklistContext } from "@/lib/checklist-context";
import { DROPDOWN_OPTIONS } from "@/lib/validations";
import { uid, defaultDocuments } from "@/lib/template-data";
import type { ColumnDef, DocumentRow } from "@/lib/types";

const columns: ColumnDef[] = [
  { key: "documentName", label: "Document Name", type: "text", description: "Official name of the document to collect" },
  { key: "applicableCandidates", label: "Applicable Candidates", type: "text", description: "Which candidates need to provide this document" },
  { key: "required", label: "Required", type: "dropdown", options: [...DROPDOWN_OPTIONS.required], description: "Is this document mandatory?" },
  { key: "blankTemplateLink", label: "Blank Template Link", type: "text", description: "Link to a blank template of this document", validation: "url" },
  { key: "applicableCampaigns", label: "Applicable Campaigns", type: "text", description: "Which campaigns require this document" },
  { key: "accessPermissions", label: "Access Permissions", type: "dropdown", options: [...DROPDOWN_OPTIONS.accessPermissions], description: "Who can view the collected documents" },
  { key: "folder", label: "Folder", type: "text", description: "Which workflow folder triggers document collection" },
  { key: "comments", label: "Comments", type: "textarea" },
];

export function DocumentsSheet() {
  const { data, updateField } = useChecklistContext();
  const documents = (data.documents as DocumentRow[]) || defaultDocuments;

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...documents];
    updated[index] = { ...updated[index], [field]: value };
    updateField("documents", updated);
  };

  const handleAdd = () => {
    updateField("documents", [
      ...documents,
      { id: uid(), documentName: "", applicableCandidates: "", required: "", blankTemplateLink: "", applicableCampaigns: "", accessPermissions: "", folder: "", comments: "" },
    ]);
  };

  const handleDelete = (index: number) => {
    updateField("documents", documents.filter((_, i) => i !== index));
  };

  const handleDuplicate = (index: number) => {
    const clone = { ...documents[index], id: uid() };
    const updated = [...documents];
    updated.splice(index + 1, 0, clone);
    updateField("documents", updated);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: uid(),
      documentName: "", applicableCandidates: "", required: "", blankTemplateLink: "", applicableCampaigns: "", accessPermissions: "", folder: "", comments: "",
      ...row,
    }));
    updateField("documents", [...documents, ...newRows]);
  };

  return (
    <div>
      <SectionHeader
        title="Document Collection"
        description="Define the documents to be collected from candidates during the hiring process."
      />
      <ExampleHint>
        <p className="mb-1 font-medium">Sample documents to collect:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>Resume/CV</strong> | All candidates | Required | All campaigns | Inbox</li>
          <li><strong>NBI Clearance</strong> | All candidates | Required | All campaigns | Interview</li>
          <li><strong>Pre-employment Medical</strong> | Hired candidates | Required | Hired folder</li>
        </ul>
      </ExampleHint>

      <EditableTable
        columns={columns}
        data={documents}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        addLabel="Add Document"
        csvConfig={{
          sampleRow: { documentName: "Resume/CV", applicableCandidates: "All", required: "Required", folder: "Inbox" },
          onImport: handleCsvImport,
          sheetName: "Documents",
        }}
      />
    </div>
  );
}
