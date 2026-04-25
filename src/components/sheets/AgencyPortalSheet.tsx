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
import { softDeleteByIds, appendBulkDuplicates } from "@/lib/duplicate-row";

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
  const allAgencies = (data.agencyPortal as AgencyPortalRow[]) || defaultAgencyPortal;
  const agencies = allAgencies.filter((a) => !a.deletedAt);
  const allUsers = (data.agencyPortalUsers as AgencyPortalUser[]) || defaultAgencyPortalUsers;
  const users = allUsers.filter((u) => !u.deletedAt);

  const fullAgencyIndexOf = (visibleIdx: number) => {
    const target = agencies[visibleIdx];
    if (!target) return -1;
    return allAgencies.findIndex((a) => a.id === target.id);
  };

  const fullUserIndexOf = (visibleIdx: number) => {
    const target = users[visibleIdx];
    if (!target) return -1;
    return allUsers.findIndex((u) => u.id === target.id);
  };

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const fullIdx = fullAgencyIndexOf(index);
    if (fullIdx < 0) return;
    const updated = [...allAgencies];
    updated[fullIdx] = { ...updated[fullIdx], [field]: value };
    updateField("agencyPortal", updated);
  };

  const handleAdd = () => {
    updateField("agencyPortal", [
      ...allAgencies,
      { id: uid(), agencyName: "", contactName: "", email: "", phone: "", country: "", comments: "" },
    ]);
  };

  const handleDelete = (index: number) => {
    const target = agencies[index];
    if (!target) return;
    updateField("agencyPortal", softDeleteByIds(allAgencies, [target.id]));
  };

  const handleDuplicate = (index: number) => {
    const target = agencies[index];
    if (!target) return;
    updateField("agencyPortal", appendBulkDuplicates("agencyPortal", allAgencies, agencies, [target.id]));
  };

  const handleBulkDelete = (ids: string[]) => {
    updateField("agencyPortal", softDeleteByIds(allAgencies, ids));
  };

  const handleBulkDuplicate = (ids: string[]) => {
    updateField("agencyPortal", appendBulkDuplicates("agencyPortal", allAgencies, agencies, ids));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: uid(),
      agencyName: "", contactName: "", email: "", phone: "", country: "", comments: "",
      ...row,
    }));
    updateField("agencyPortal", [...allAgencies, ...newRows]);
  };

  // --- Agency Portal Users handlers ---
  const handleUserUpdate = (index: number, field: string, value: string | boolean) => {
    const fullIdx = fullUserIndexOf(index);
    if (fullIdx < 0) return;
    const updated = [...allUsers];
    updated[fullIdx] = { ...updated[fullIdx], [field]: value as string };
    updateField("agencyPortalUsers", updated);
  };

  const handleUserAdd = () => {
    updateField("agencyPortalUsers", [
      ...allUsers,
      { id: uid(), name: "", email: "", agency: "", userAccess: "" as AgencyPortalUser["userAccess"] },
    ]);
  };

  const handleUserDelete = (index: number) => {
    const target = users[index];
    if (!target) return;
    updateField("agencyPortalUsers", softDeleteByIds(allUsers, [target.id]));
  };

  const handleUserDuplicate = (index: number) => {
    const target = users[index];
    if (!target) return;
    updateField("agencyPortalUsers", appendBulkDuplicates("agencyPortalUsers", allUsers, users, [target.id]));
  };

  const handleUserBulkDelete = (ids: string[]) => {
    updateField("agencyPortalUsers", softDeleteByIds(allUsers, ids));
  };

  const handleUserBulkDuplicate = (ids: string[]) => {
    updateField("agencyPortalUsers", appendBulkDuplicates("agencyPortalUsers", allUsers, users, ids));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUserCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: uid(),
      name: "", email: "", agency: "", userAccess: "" as AgencyPortalUser["userAccess"],
      ...row,
    }));
    updateField("agencyPortalUsers", [...allUsers, ...newRows]);
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
        bulkActions={{
          itemLabel: "agency",
          itemLabelPlural: "agencies",
          onBulkDelete: handleBulkDelete,
          onBulkDuplicate: handleBulkDuplicate,
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
          bulkActions={{
            itemLabel: "agency user",
            itemLabelPlural: "agency users",
            onBulkDelete: handleUserBulkDelete,
            onBulkDuplicate: handleUserBulkDuplicate,
          }}
        />
      </div>
        </>
      )}

      <SectionFooter />
    </div>
  );
}
