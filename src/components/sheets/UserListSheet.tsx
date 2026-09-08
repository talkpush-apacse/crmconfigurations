"use client";

import { SheetIntro } from "@/components/shared/SheetIntro";
import { EditableTable } from "@/components/shared/EditableTable";
import { TabUploadBanner, TabUploadSkippedNotice } from "@/components/shared/TabUploadBanner";
import { useTabUpload } from "@/hooks/useTabUpload";
import { useChecklistContext } from "@/lib/checklist-context";
import { DROPDOWN_OPTIONS } from "@/lib/validations";
import { uid, defaultUsers } from "@/lib/template-data";
import type { ColumnDef, UserRow } from "@/lib/types";
import { SectionFooter } from "@/components/shared/SectionFooter";
import { duplicateRows, mergeVisibleRows } from "@/lib/duplicate-row";
import { downloadTalkpushUsersCsv } from "@/lib/talkpush-export";

// Role definitions, shown in the Access Type column tooltip.
const referenceData = [
  { role: "Owner", description: "Full platform access — can manage users, campaigns, settings, and all data." },
  { role: "Manager", description: "Standard access — can manage candidates, campaigns, and view reports." },
  { role: "Limited Manager", description: "Read-only access — can view data but cannot make changes." },
];

const columns: ColumnDef[] = [
  { key: "name", label: "Name", type: "text", description: "Full name of the user", required: true },
  { key: "accessType", label: "Access Type", type: "dropdown", options: [...DROPDOWN_OPTIONS.userRoles], description: (
      <>
        <p>Role determining platform access level</p>
        {referenceData.map((r) => (
          <p key={r.role}>
            <strong>{r.role}</strong> — {r.description}
          </p>
        ))}
      </>
    ), required: true },
  { key: "email", label: "Email", type: "text", description: "User's email address for login", validation: "email", required: true },
  { key: "phone", label: "Phone", type: "text", description: "Contact phone number", validation: "phone", required: true },
];

const detailColumns: ColumnDef[] = [
  { key: "jobTitle", label: "Job Title", type: "text", description: "User's job title within the organization" },
  { key: "site", label: "Site", type: "text", description: "Assigned site/location" },
  { key: "reportsTo", label: "Reports To", type: "text", description: "Direct manager or supervisor" },
  { key: "comments", label: "Comments", type: "textarea" },
];

export function UserListSheet() {
  const { data, updateField } = useChecklistContext();
  const { isSkipped, uploadedFiles } = useTabUpload("users");
  // Full array (incl. soft-deleted rows) — used for writes
  const allUsers = (data.users as UserRow[]) || defaultUsers;
  // Visible array (filtered) — used for display + index-based callbacks
  const users = allUsers.filter((u) => !u.deletedAt);

  // Map a visible-list index to its position in the full array
  const fullIndexOf = (visibleIdx: number) => {
    const target = users[visibleIdx];
    if (!target) return -1;
    return allUsers.findIndex((u) => u.id === target.id);
  };

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const fullIdx = fullIndexOf(index);
    if (fullIdx < 0) return;
    const updated = [...allUsers];
    updated[fullIdx] = { ...updated[fullIdx], [field]: value };
    updateField("users", updated);
  };

  const handleAdd = () => {
    updateField("users", [
      ...allUsers,
      { id: uid(), name: "", accessType: "", jobTitle: "", email: "", phone: "", site: "", reportsTo: "", stage: "", comments: "" },
    ]);
  };

  // Per-row delete is also soft — stamps deletedAt so the row is hidden
  // but recoverable, matching bulk-delete behavior.
  const handleDelete = (index: number) => {
    const target = users[index];
    if (!target) return;
    const now = new Date().toISOString();
    const updated = allUsers.map((u) =>
      u.id === target.id ? { ...u, deletedAt: now } : u,
    );
    updateField("users", updated);
  };

  const handleDuplicate = (index: number) => {
    const target = users[index];
    if (!target) return;
    const [clone] = duplicateRows("users", allUsers, [target]);
    // Insert immediately after the source in the full array
    const fullIdx = fullIndexOf(index);
    const updated = [...allUsers];
    updated.splice(fullIdx + 1, 0, clone);
    updateField("users", updated);
  };

  // Bulk soft-delete: stamp deletedAt on matching rows in the full array
  const handleBulkDelete = (ids: string[]) => {
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    const updated = allUsers.map((u) =>
      idSet.has(u.id) ? { ...u, deletedAt: now } : u,
    );
    updateField("users", updated);
  };

  // Bulk duplicate: append collision-aware copies to the end of the full array
  const handleBulkDuplicate = (ids: string[]) => {
    const idSet = new Set(ids);
    const sources = allUsers.filter((u) => idSet.has(u.id) && !u.deletedAt);
    if (sources.length === 0) return;
    const copies = duplicateRows("users", allUsers, sources);
    updateField("users", [...allUsers, ...copies]);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: uid(),
      name: "", accessType: "", jobTitle: "", email: "", phone: "", site: "", reportsTo: "", stage: "", comments: "",
      ...row,
    }));
    updateField("users", [...allUsers, ...newRows]);
  };

  // A pasted block arrives as the full next visible list, in one update —
  // per-cell writes would each see a stale array and only the last would stick.
  const handlePasteApply = (usersNext: UserRow[]) => {
    updateField("users", mergeVisibleRows(allUsers, usersNext));
  };

  return (
    <div>
      <SheetIntro
        title="User List"
        description="Define the users who will have access to the Talkpush CRM platform."
      />

      <TabUploadBanner tabKey="users" tabLabel="User List" compact />

      {isSkipped ? (
        <TabUploadSkippedNotice fileCount={uploadedFiles.length} />
      ) : (
        <>
      <EditableTable
        columns={columns}
        detailColumns={detailColumns}
        data={users}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        pasteConfig={{
          onApply: handlePasteApply,
          createRow: () => ({ id: uid(), name: "", accessType: "", jobTitle: "", email: "", phone: "", site: "", reportsTo: "", stage: "", comments: "" }),
        }}
        spreadsheetMode
        tableId="users"
        addLabel="Add User"
        sampleRow={{ name: "Maria Santos", accessType: "Manager", email: "maria@company.com", phone: "+63 917 123 4567", jobTitle: "HR Manager", site: "BGC Office", reportsTo: "John dela Cruz" }}
        csvConfig={{
          sampleRow: { name: "John Doe", accessType: "Manager", email: "john@company.com", phone: "+1234567890", jobTitle: "Recruiter", site: "Main Office", reportsTo: "Jane Smith", comments: "Primary recruiting contact" },
          onImport: handleCsvImport,
          sheetName: "Users",
          extraExport: {
            label: "Download Talkpush CSV",
            title: "Talkpush-ready CSV with columns: name, email, role, phone",
            onClick: () => downloadTalkpushUsersCsv(allUsers),
          },
        }}
        bulkActions={{
          itemLabel: "user",
          itemLabelPlural: "users",
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
