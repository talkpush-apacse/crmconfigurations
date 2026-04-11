"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { ExampleHint } from "@/components/shared/ExampleHint";
import { EditableTable } from "@/components/shared/EditableTable";
import { TabUploadBanner, TabUploadSkippedNotice } from "@/components/shared/TabUploadBanner";
import { useTabUpload } from "@/hooks/useTabUpload";
import { useChecklistContext } from "@/lib/checklist-context";
import { uid, defaultAgencyPortal, defaultAgencyPortalUsers } from "@/lib/template-data";
import type { ColumnDef, AgencyPortalRow, AgencyPortalUser } from "@/lib/types";
import { SectionFooter } from "@/components/shared/SectionFooter";

const columns: ColumnDef[] = [
  { key: "agencyName", label: "Agency Name", type: "text", description: "Name of the staffing/recruitment agency" },
  { key: "contactName", label: "Contact Name", type: "text", description: "Primary point of contact at the agency" },
  { key: "email", label: "Email", type: "text", description: "Contact email address", validation: "email" },
  { key: "phone", label: "Phone", type: "text", description: "Contact phone number", validation: "phone" },
  { key: "country", label: "Country", type: "text", description: "Country where the agency operates" },
  { key: "comments", label: "Comments", type: "textarea" },
];

const userColumns: ColumnDef[] = [
  { key: "name", label: "Name", type: "text", description: "Full name of the user" },
  { key: "email", label: "Email", type: "text", description: "Email address", validation: "email" },
  { key: "agency", label: "Agency", type: "text", description: "Agency name (free text)" },
  {
    key: "userAccess",
    label: "User Access",
    type: "dropdown",
    description: "Role/access level in the Agency Portal",
    options: [
      "Talkpush Owner",
      "Agency Admin",
      "Agency Editor",
      "Company Admin",
      "Company Editor",
      "Campaign Manager",
      "Recruiter",
    ],
  },
];

export function AgencyPortalSheet() {
  const { data, updateField } = useChecklistContext();
  const { isSkipped, uploadedFiles } = useTabUpload("agencyPortal");
  const agencies = (data.agencyPortal as AgencyPortalRow[]) || defaultAgencyPortal;
  const users = (data.agencyPortalUsers as AgencyPortalUser[]) || defaultAgencyPortalUsers;

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...agencies];
    updated[index] = { ...updated[index], [field]: value };
    updateField("agencyPortal", updated);
  };

  const handleAdd = () => {
    updateField("agencyPortal", [
      ...agencies,
      { id: uid(), agencyName: "", contactName: "", email: "", phone: "", country: "", comments: "" },
    ]);
  };

  const handleDelete = (index: number) => {
    updateField("agencyPortal", agencies.filter((_, i) => i !== index));
  };

  const handleDuplicate = (index: number) => {
    const clone = { ...agencies[index], id: uid() };
    const updated = [...agencies];
    updated.splice(index + 1, 0, clone);
    updateField("agencyPortal", updated);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: uid(),
      agencyName: "", contactName: "", email: "", phone: "", country: "", comments: "",
      ...row,
    }));
    updateField("agencyPortal", [...agencies, ...newRows]);
  };

  // --- Agency Portal Users handlers ---
  const handleUserUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...users];
    updated[index] = { ...updated[index], [field]: value as string };
    updateField("agencyPortalUsers", updated);
  };

  const handleUserAdd = () => {
    updateField("agencyPortalUsers", [
      ...users,
      { id: uid(), name: "", email: "", agency: "", userAccess: "" as AgencyPortalUser["userAccess"] },
    ]);
  };

  const handleUserDelete = (index: number) => {
    updateField("agencyPortalUsers", users.filter((_, i) => i !== index));
  };

  const handleUserDuplicate = (index: number) => {
    const clone = { ...users[index], id: uid() };
    const updated = [...users];
    updated.splice(index + 1, 0, clone);
    updateField("agencyPortalUsers", updated);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUserCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: uid(),
      name: "", email: "", agency: "", userAccess: "" as AgencyPortalUser["userAccess"],
      ...row,
    }));
    updateField("agencyPortalUsers", [...users, ...newRows]);
  };

  return (
    <div>
      <SectionHeader
        title="Agency Portal"
        description="Manage staffing agencies and their contact information."
      />

      <TabUploadBanner tabKey="agencyPortal" tabLabel="Agency Portal" />

      {isSkipped ? (
        <TabUploadSkippedNotice fileCount={uploadedFiles.length} />
      ) : (
        <>
      <ExampleHint>
        <p className="mb-1 font-medium">Sample agency entries:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>Staff Alliance Inc.</strong> | Maria Reyes | maria@staffalliance.ph | +63 2 8888 1234 | Philippines</li>
          <li><strong>JobStreet Staffing</strong> | John Torres | john@jobstreet.com.ph | +63 917 555 6789 | Philippines</li>
        </ul>
      </ExampleHint>

      <EditableTable
        columns={columns}
        data={agencies}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        addLabel="Add Agency"
        sampleRow={{ agencyName: "Staff Alliance Inc.", contactName: "Maria Reyes", email: "maria@staffalliance.ph", phone: "+63 2 8888 1234", country: "Philippines", comments: "Primary agency" }}
        csvConfig={{
          sampleRow: { agencyName: "ABC Staffing", contactName: "Jane Smith", email: "jane@abc.com", phone: "+1234567890", country: "Philippines" },
          onImport: handleCsvImport,
          sheetName: "Agency Portal",
        }}
      />

      <div className="mt-10">
        <SectionHeader
          title="Agency Portal Users"
          description="List all users that need to be created in the Agency Portal. Specify their role/access level."
        />

        <EditableTable
          columns={userColumns}
          data={users}
          onUpdate={handleUserUpdate}
          onAdd={handleUserAdd}
          onDelete={handleUserDelete}
          onDuplicate={handleUserDuplicate}
          addLabel="Add User"
          sampleRow={{ name: "Maria Reyes", email: "maria@staffalliance.ph", agency: "Staff Alliance Inc.", userAccess: "Agency Admin" }}
          csvConfig={{
            sampleRow: { name: "Jane Smith", email: "jane@abc.com", agency: "ABC Staffing", userAccess: "Agency Admin" },
            onImport: handleUserCsvImport,
            sheetName: "Agency Portal Users",
          }}
        />
      </div>
        </>
      )}

      <SectionFooter />
    </div>
  );
}
