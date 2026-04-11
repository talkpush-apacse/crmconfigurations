"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ExampleHint } from "@/components/shared/ExampleHint";
import { EditableTable } from "@/components/shared/EditableTable";
import { TabUploadBanner, TabUploadSkippedNotice } from "@/components/shared/TabUploadBanner";
import { useTabUpload } from "@/hooks/useTabUpload";
import { useChecklistContext } from "@/lib/checklist-context";
import { uid, defaultCampaigns } from "@/lib/template-data";
import type { ColumnDef, CampaignRow } from "@/lib/types";
import { SectionFooter } from "@/components/shared/SectionFooter";

const columns: ColumnDef[] = [
  { key: "nameInternal", label: "Campaign Name (Internal)", type: "text", description: "Internal name used within Talkpush to identify this campaign" },
  { key: "jobTitleExternal", label: "Job Title (External)", type: "text", description: "Job title shown to candidates on application pages" },
  { key: "site", label: "Site", type: "text", description: "Location/site associated with this campaign" },
];

const baseDetailColumns: ColumnDef[] = [
  { key: "jobDescription", label: "Job Description", type: "textarea", description: "Full job description for the position" },
  { key: "googleMapsLink", label: "Google Maps Link", type: "text", description: "Link to the interview/office location on Google Maps", validation: "url" },
  { key: "zoomLink", label: "Zoom/Meeting Link", type: "text", description: "Virtual interview meeting link", validation: "url" },
  { key: "assignedRecruiters", label: "Assigned Recruiters (optional \u00b7 round robin)", type: "text", description: "Separate names or emails with commas. These recruiters will be assigned via round robin." },
  { key: "comments", label: "Comments", type: "textarea" },
];

const campaignIdColumn: ColumnDef = {
  key: "campaignId", label: "Campaign ID \u00a0\u2022\u00a0Admin", type: "text", description: "Internal Talkpush campaign ID (admin-only field, not visible to clients)",
};

const referenceData = [
  { type: "Evergreen", description: "Continuous hiring pipeline — always open for applications, no specific requisition number." },
  { type: "Requisition-based", description: "Tied to a specific job requisition — has a defined number of openings and closing date." },
];

export function CampaignsSheet() {
  const { data, updateField } = useChecklistContext();
  const { isSkipped, uploadedFiles } = useTabUpload("campaigns");
  const campaigns = (data.campaigns as CampaignRow[]) || defaultCampaigns;
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/editor");

  // Build detail columns: include Campaign ID only for admin view
  const detailColumns = useMemo(() => {
    if (isAdmin) return [campaignIdColumn, ...baseDetailColumns];
    return baseDetailColumns;
  }, [isAdmin]);

  // Flatten assignedRecruiters arrays to comma-separated strings for the table
  const campaignsForTable = useMemo(() =>
    campaigns.map((c) => ({
      ...c,
      assignedRecruiters: Array.isArray(c.assignedRecruiters) ? c.assignedRecruiters.join(", ") : (c.assignedRecruiters ?? ""),
    })),
    [campaigns]
  );

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...campaigns];
    if (field === "assignedRecruiters" && typeof value === "string") {
      const arr = value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
      updated[index] = { ...updated[index], assignedRecruiters: arr };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    updateField("campaigns", updated);
  };

  const handleAdd = () => {
    updateField("campaigns", [
      ...campaigns,
      { id: uid(), nameInternal: "", jobTitleExternal: "", site: "", jobDescription: "", googleMapsLink: "", zoomLink: "", comments: "" },
    ]);
  };

  const handleDelete = (index: number) => {
    updateField("campaigns", campaigns.filter((_, i) => i !== index));
  };

  const handleDuplicate = (index: number) => {
    const clone = { ...campaigns[index], id: uid() };
    const updated = [...campaigns];
    updated.splice(index + 1, 0, clone);
    updateField("campaigns", updated);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: uid(),
      nameInternal: "", jobTitleExternal: "", site: "", jobDescription: "", googleMapsLink: "", zoomLink: "", comments: "",
      ...row,
    }));
    updateField("campaigns", [...campaigns, ...newRows]);
  };

  return (
    <div>
      <SectionHeader
        title="Campaigns List"
        description="Define your recruitment campaigns. Each campaign represents a job position or hiring pipeline."
      />

      <TabUploadBanner tabKey="campaigns" tabLabel="Campaigns List" />

      {isSkipped ? (
        <TabUploadSkippedNotice fileCount={uploadedFiles.length} />
      ) : (
        <>
      <ExampleHint>
        <p className="mb-1 font-medium">Sample campaigns:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>CSR - Makati</strong> | Customer Service Representative | Makati Office | Handle inbound customer calls and resolve inquiries</li>
          <li><strong>TSR - BGC Night</strong> | Technical Support Rep (Night Shift) | BGC Office | Provide L1 tech support for US-based clients</li>
        </ul>
      </ExampleHint>

      <div className="mb-6 rounded-lg border border-gray-200 bg-slate-50 overflow-hidden">
        <div className="bg-slate-100 border-b border-gray-200 px-4 py-2.5 text-[13px] font-semibold text-gray-700">
          Campaign Type Reference
        </div>
        <div className="divide-y divide-gray-200">
          {referenceData.map((r) => (
            <div key={r.type} className="grid px-4 py-2.5" style={{ gridTemplateColumns: "160px 1fr" }}>
              <span className="text-[14px] font-medium text-gray-900">{r.type}</span>
              <span className="text-[14px] text-gray-500">{r.description}</span>
            </div>
          ))}
        </div>
      </div>

      <EditableTable
        columns={columns}
        detailColumns={detailColumns}
        data={campaignsForTable}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        addLabel="Add Campaign"
        sampleRow={{ nameInternal: "CSR - Makati", jobTitleExternal: "Customer Service Representative", site: "Makati Office" }}
        csvConfig={{
          sampleRow: { nameInternal: "CSR Campaign", jobTitleExternal: "Customer Service Representative", site: "Main Office", jobDescription: "Handle customer inquiries" },
          onImport: handleCsvImport,
          sheetName: "Campaigns",
        }}
      />
        </>
      )}
      <SectionFooter />
    </div>
  );
}
