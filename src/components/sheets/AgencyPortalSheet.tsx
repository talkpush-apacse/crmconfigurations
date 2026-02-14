"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { EditableTable } from "@/components/shared/EditableTable";
import { useChecklistContext } from "@/lib/checklist-context";
import { defaultAgencyPortal } from "@/lib/template-data";
import type { ColumnDef, AgencyPortalRow } from "@/lib/types";

const columns: ColumnDef[] = [
  { key: "agencyName", label: "Agency Name", type: "text", description: "Name of the staffing/recruitment agency" },
  { key: "contactName", label: "Contact Name", type: "text", description: "Primary point of contact at the agency" },
  { key: "email", label: "Email", type: "text", description: "Contact email address" },
  { key: "phone", label: "Phone", type: "text", description: "Contact phone number" },
  { key: "country", label: "Country", type: "text", description: "Country where the agency operates" },
  { key: "comments", label: "Comments", type: "text" },
];

export function AgencyPortalSheet() {
  const { data, updateField } = useChecklistContext();
  const agencies = (data.agencyPortal as AgencyPortalRow[]) || defaultAgencyPortal;

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...agencies];
    updated[index] = { ...updated[index], [field]: value };
    updateField("agencyPortal", updated);
  };

  const handleAdd = () => {
    updateField("agencyPortal", [
      ...agencies,
      { id: Math.random().toString(36).substring(2, 9), agencyName: "", contactName: "", email: "", phone: "", country: "", comments: "" },
    ]);
  };

  const handleDelete = (index: number) => {
    updateField("agencyPortal", agencies.filter((_, i) => i !== index));
  };

  const handleDuplicate = (index: number) => {
    const clone = { ...agencies[index], id: Math.random().toString(36).substring(2, 9) };
    const updated = [...agencies];
    updated.splice(index + 1, 0, clone);
    updateField("agencyPortal", updated);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: Math.random().toString(36).substring(2, 9),
      agencyName: "", contactName: "", email: "", phone: "", country: "", comments: "",
      ...row,
    }));
    updateField("agencyPortal", [...agencies, ...newRows]);
  };

  return (
    <div>
      <SectionHeader
        title="Agency Portal"
        description="Manage staffing agencies and their contact information."
      />
      <EditableTable
        columns={columns}
        data={agencies}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        addLabel="Add Agency"
        csvConfig={{
          sampleRow: { agencyName: "ABC Staffing", contactName: "Jane Smith", email: "jane@abc.com", phone: "+1234567890", country: "Philippines" },
          onImport: handleCsvImport,
          sheetName: "Agency Portal",
        }}
      />
    </div>
  );
}
