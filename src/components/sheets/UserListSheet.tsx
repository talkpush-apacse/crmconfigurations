"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { EditableTable } from "@/components/shared/EditableTable";
import { useChecklistContext } from "@/lib/checklist-context";
import { DROPDOWN_OPTIONS } from "@/lib/validations";
import { uid, defaultUsers } from "@/lib/template-data";
import type { ColumnDef, UserRow } from "@/lib/types";

const columns: ColumnDef[] = [
  { key: "name", label: "Name", type: "text", description: "Full name of the user" },
  { key: "accessType", label: "Access Type", type: "dropdown", options: [...DROPDOWN_OPTIONS.userRoles], description: "Role determining platform access level" },
  { key: "jobTitle", label: "Job Title", type: "text", description: "User's job title within the organization" },
  { key: "email", label: "Email", type: "text", description: "User's email address for login", validation: "email" },
  { key: "phone", label: "Phone", type: "text", description: "Contact phone number", validation: "phone" },
  { key: "site", label: "Site", type: "text", description: "Assigned site/location" },
  { key: "reportsTo", label: "Reports To", type: "text", description: "Direct manager or supervisor" },
  { key: "comments", label: "Comments", type: "text" },
];

const referenceData = [
  { role: "Owner", description: "Full platform access — can manage users, campaigns, settings, and all data." },
  { role: "Manager", description: "Standard access — can manage candidates, campaigns, and view reports." },
  { role: "Limited Manager", description: "Read-only access — can view data but cannot make changes." },
];

export function UserListSheet() {
  const { data, updateField } = useChecklistContext();
  const users = (data.users as UserRow[]) || defaultUsers;

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...users];
    updated[index] = { ...updated[index], [field]: value };
    updateField("users", updated);
  };

  const handleAdd = () => {
    updateField("users", [
      ...users,
      { id: uid(), name: "", accessType: "", jobTitle: "", email: "", phone: "", site: "", reportsTo: "", stage: "", comments: "" },
    ]);
  };

  const handleDelete = (index: number) => {
    updateField("users", users.filter((_, i) => i !== index));
  };

  const handleDuplicate = (index: number) => {
    const clone = { ...users[index], id: uid() };
    const updated = [...users];
    updated.splice(index + 1, 0, clone);
    updateField("users", updated);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: uid(),
      name: "", accessType: "", jobTitle: "", email: "", phone: "", site: "", reportsTo: "", stage: "", comments: "",
      ...row,
    }));
    updateField("users", [...users, ...newRows]);
  };

  return (
    <div>
      <SectionHeader
        title="User List"
        description="Define the users who will have access to the Talkpush CRM platform."
      />

      <div className="mb-6 rounded-lg border">
        <div className="bg-gray-100 px-4 py-2 text-sm font-medium">Role Reference</div>
        <div className="divide-y">
          {referenceData.map((r) => (
            <div key={r.role} className="flex gap-4 px-4 py-2 text-sm">
              <span className="w-36 shrink-0 font-medium">{r.role}</span>
              <span className="text-muted-foreground">{r.description}</span>
            </div>
          ))}
        </div>
      </div>

      <EditableTable
        columns={columns}
        data={users}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        addLabel="Add User"
        csvConfig={{
          sampleRow: { name: "John Doe", accessType: "Manager", jobTitle: "Recruiter", email: "john@company.com", phone: "+1234567890", site: "Main Office", reportsTo: "Jane Smith" },
          onImport: handleCsvImport,
          sheetName: "Users",
        }}
      />
    </div>
  );
}
