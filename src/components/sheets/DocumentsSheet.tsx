"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { ExampleHint } from "@/components/shared/ExampleHint";
import { EditableTable } from "@/components/shared/EditableTable";
import { TabUploadBanner, TabUploadSkippedNotice } from "@/components/shared/TabUploadBanner";
import { useTabUpload } from "@/hooks/useTabUpload";
import { useChecklistContext } from "@/lib/checklist-context";
import { DROPDOWN_OPTIONS } from "@/lib/validations";
import { uid, defaultDocuments } from "@/lib/template-data";
import type { ColumnDef, DocumentRow } from "@/lib/types";
import { SectionFooter } from "@/components/shared/SectionFooter";
import { softDeleteByIds, appendBulkDuplicates } from "@/lib/duplicate-row";

const columns: ColumnDef[] = [
  { key: "documentName", label: "Document Name", type: "text", description: "Official name of the document to collect" },
  { key: "applicableCandidates", label: "Applicable Candidates", type: "text", description: "Which candidates need to provide this document" },
  { key: "required", label: "Required", type: "dropdown", options: [...DROPDOWN_OPTIONS.required], description: "Is this document mandatory?" },
  { key: "folder", label: "Folder", type: "text", description: "Which workflow folder triggers document collection" },
];

const detailColumns: ColumnDef[] = [
  { key: "blankTemplateLink", label: "Blank Template Link", type: "text", description: "Link to a blank template of this document", validation: "url" },
  { key: "applicableCampaigns", label: "Applicable Campaigns", type: "text", description: "Which campaigns require this document" },
  { key: "accessPermissions", label: "Access Permissions", type: "dropdown", options: [...DROPDOWN_OPTIONS.accessPermissions], description: "Who can view the collected documents" },
  { key: "comments", label: "Comments", type: "textarea" },
];

export function DocumentsSheet() {
  const { data, updateField } = useChecklistContext();
  const { isSkipped, uploadedFiles } = useTabUpload("documents");
  const allDocuments = (data.documents as DocumentRow[]) || defaultDocuments;
  const documents = allDocuments.filter((d) => !d.deletedAt);

  const fullIndexOf = (visibleIdx: number) => {
    const target = documents[visibleIdx];
    if (!target) return -1;
    return allDocuments.findIndex((d) => d.id === target.id);
  };

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const fullIdx = fullIndexOf(index);
    if (fullIdx < 0) return;
    const updated = [...allDocuments];
    updated[fullIdx] = { ...updated[fullIdx], [field]: value };
    updateField("documents", updated);
  };

  const handleAdd = () => {
    updateField("documents", [
      ...allDocuments,
      { id: uid(), documentName: "", applicableCandidates: "", required: "", blankTemplateLink: "", applicableCampaigns: "", accessPermissions: "", folder: "", comments: "" },
    ]);
  };

  const handleDelete = (index: number) => {
    const target = documents[index];
    if (!target) return;
    updateField("documents", softDeleteByIds(allDocuments, [target.id]));
  };

  const handleDuplicate = (index: number) => {
    const target = documents[index];
    if (!target) return;
    updateField("documents", appendBulkDuplicates("documents", allDocuments, documents, [target.id]));
  };

  const handleBulkDelete = (ids: string[]) => {
    updateField("documents", softDeleteByIds(allDocuments, ids));
  };

  const handleBulkDuplicate = (ids: string[]) => {
    updateField("documents", appendBulkDuplicates("documents", allDocuments, documents, ids));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: uid(),
      documentName: "", applicableCandidates: "", required: "", blankTemplateLink: "", applicableCampaigns: "", accessPermissions: "", folder: "", comments: "",
      ...row,
    }));
    updateField("documents", [...allDocuments, ...newRows]);
  };

  return (
    <div>
      <SectionHeader
        title="Document Collection"
        description="Define the documents to be collected from candidates during the hiring process."
      />

      <TabUploadBanner tabKey="documents" tabLabel="Document Collection" />

      {isSkipped ? (
        <TabUploadSkippedNotice fileCount={uploadedFiles.length} />
      ) : (
        <>
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
        detailColumns={detailColumns}
        data={documents}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        addLabel="Add Document"
        sampleRow={{ documentName: "Resume/CV", applicableCandidates: "All candidates", required: "Required", folder: "Inbox" }}
        csvConfig={{
          sampleRow: { documentName: "Resume/CV", applicableCandidates: "All", required: "Required", folder: "Inbox" },
          onImport: handleCsvImport,
          sheetName: "Documents",
        }}
        bulkActions={{
          itemLabel: "document",
          itemLabelPlural: "documents",
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
