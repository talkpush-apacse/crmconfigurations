"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { ExampleHint } from "@/components/shared/ExampleHint";
import { EditableTable } from "@/components/shared/EditableTable";
import { TabUploadBanner, TabUploadSkippedNotice } from "@/components/shared/TabUploadBanner";
import { useTabUpload } from "@/hooks/useTabUpload";
import { useChecklistContext } from "@/lib/checklist-context";
import { DROPDOWN_OPTIONS } from "@/lib/validations";
import { uid, defaultAttributes } from "@/lib/template-data";
import type { ColumnDef, AttributeRow } from "@/lib/types";
import { SectionFooter } from "@/components/shared/SectionFooter";
import { softDeleteByIds, appendBulkDuplicates } from "@/lib/duplicate-row";

const columns: ColumnDef[] = [
  { key: "attributeName", label: "Attribute Name", type: "text", required: true, description: "Display name of the candidate attribute" },
  { key: "key", label: "Key", type: "text", required: true, description: "System key used internally (e.g. 1_ai_call_consent)" },
  { key: "dataType", label: "Data Type", type: "dropdown", options: [...DROPDOWN_OPTIONS.attributeDataTypes], description: "The data type for this attribute" },
  { key: "suggestedValues", label: "Suggested Values", type: "textarea", description: "Comma-separated list of allowed values" },
];

const detailColumns: ColumnDef[] = [
  { key: "description", label: "Description", type: "textarea", description: "Explain the purpose of this attribute" },
  { key: "addToAllFutureCandidates", label: "Automatically add to all future candidates", type: "boolean", description: "New candidates will automatically have this attribute in their profile" },
  { key: "showAcrossApplications", label: "Always show this attribute across applications", type: "boolean", description: "When linking multiple applications, this attribute will be synced across applications" },
  { key: "markDataPrivate", label: "Mark data as Private", type: "boolean", description: "Private data are hidden when sharing candidate profiles to guests" },
  { key: "restrictToOwners", label: "Restrict Candidate Attributes to Owners", type: "boolean", description: "Only users with owner access can view this candidate attribute" },
  { key: "hideAttributeCompliance", label: "Hide Attribute (Compliance)", type: "boolean", description: "Hidden attributes are still collectible but will not appear in profiles, exports, or filters" },
  { key: "useSuggestedValuesOnly", label: "Allow to be used only with Suggested Values", type: "boolean", description: "Limit input to the Suggested Values for Autoflow, Job Matching, Questions and Manually input data" },
  { key: "readOnlyMode", label: "Read-Only Mode", type: "boolean", description: "Makes the field read-only on the candidate profile screen" },
];

const emptyRow: AttributeRow = {
  id: "",
  attributeName: "",
  key: "",
  description: "",
  dataType: "",
  suggestedValues: "",
  addToAllFutureCandidates: false,
  showAcrossApplications: false,
  markDataPrivate: false,
  restrictToOwners: false,
  hideAttributeCompliance: false,
  useSuggestedValuesOnly: false,
  readOnlyMode: false,
};

function toSnakeCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_");
}

export function AttributesSheet() {
  const { data, updateField } = useChecklistContext();
  const { isSkipped, uploadedFiles } = useTabUpload("attributes");
  const allAttributes = (data.attributes as AttributeRow[]) || defaultAttributes;
  const attributes = allAttributes.filter((a) => !a.deletedAt);

  const fullIndexOf = (visibleIdx: number) => {
    const target = attributes[visibleIdx];
    if (!target) return -1;
    return allAttributes.findIndex((a) => a.id === target.id);
  };

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const fullIdx = fullIndexOf(index);
    if (fullIdx < 0) return;
    const updated = [...allAttributes];
    const row = { ...updated[fullIdx], [field]: value };

    // Auto-derive key from attribute name if the key hasn't been manually edited
    if (field === "attributeName" && typeof value === "string") {
      const currentKey = updated[fullIdx].key;
      const previousAutoKey = toSnakeCase(updated[fullIdx].attributeName);
      // Only auto-fill if key is empty or matches the previous auto-generated value
      if (!currentKey || currentKey === previousAutoKey) {
        row.key = toSnakeCase(value);
      }
    }

    updated[fullIdx] = row;
    updateField("attributes", updated);
  };

  const handleAdd = () => {
    updateField("attributes", [
      ...allAttributes,
      { ...emptyRow, id: uid() },
    ]);
  };

  const handleDelete = (index: number) => {
    const target = attributes[index];
    if (!target) return;
    updateField("attributes", softDeleteByIds(allAttributes, [target.id]));
  };

  const handleDuplicate = (index: number) => {
    const target = attributes[index];
    if (!target) return;
    updateField("attributes", appendBulkDuplicates("attributes", allAttributes, attributes, [target.id]));
  };

  const handleBulkDelete = (ids: string[]) => {
    updateField("attributes", softDeleteByIds(allAttributes, ids));
  };

  const handleBulkDuplicate = (ids: string[]) => {
    updateField("attributes", appendBulkDuplicates("attributes", allAttributes, attributes, ids));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      ...emptyRow,
      id: uid(),
      ...row,
      addToAllFutureCandidates: row.addToAllFutureCandidates === "true" || row.addToAllFutureCandidates === true,
      showAcrossApplications: row.showAcrossApplications === "true" || row.showAcrossApplications === true,
      markDataPrivate: row.markDataPrivate === "true" || row.markDataPrivate === true,
      restrictToOwners: row.restrictToOwners === "true" || row.restrictToOwners === true,
      hideAttributeCompliance: row.hideAttributeCompliance === "true" || row.hideAttributeCompliance === true,
      useSuggestedValuesOnly: row.useSuggestedValuesOnly === "true" || row.useSuggestedValuesOnly === true,
      readOnlyMode: row.readOnlyMode === "true" || row.readOnlyMode === true,
    }));
    updateField("attributes", [...allAttributes, ...newRows]);
  };

  return (
    <div>
      <SectionHeader
        title="Candidate Attributes"
        description="Define the custom candidate attributes to be created in the CRM. Expand each row to configure advanced settings."
      />

      <TabUploadBanner tabKey="attributes" tabLabel="Attributes" />

      {isSkipped ? (
        <TabUploadSkippedNotice fileCount={uploadedFiles.length} />
      ) : (
        <>
      <ExampleHint>
        <p className="mb-1 font-medium">Sample attributes:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>AI Call Consent</strong> | Key: 1_ai_call_consent | Text | Values: Yes, No | Read-Only</li>
          <li><strong>Preferred Shift</strong> | Key: preferred_shift | Dropdown | Values: Morning, Afternoon, Night</li>
          <li><strong>Employee ID</strong> | Key: employee_id | Text | Read-Only, Private</li>
        </ul>
      </ExampleHint>

      <EditableTable
        columns={columns}
        detailColumns={detailColumns}
        data={attributes}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        addLabel="Add Attribute"
        sampleRow={{ attributeName: "AI Call Consent", key: "1_ai_call_consent", dataType: "Text", suggestedValues: "Yes, No" }}
        csvConfig={{
          sampleRow: { attributeName: "AI Call Consent", key: "1_ai_call_consent", dataType: "Text", suggestedValues: "Yes, No" },
          onImport: handleCsvImport,
          sheetName: "Attributes",
        }}
        bulkActions={{
          itemLabel: "attribute",
          itemLabelPlural: "attributes",
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
