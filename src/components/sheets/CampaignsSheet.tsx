"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { ExampleHint } from "@/components/shared/ExampleHint";
import { EditableTable } from "@/components/shared/EditableTable";
import { useChecklistContext } from "@/lib/checklist-context";
import { uid, defaultCampaigns } from "@/lib/template-data";
import type { ColumnDef, CampaignRow } from "@/lib/types";

const columns: ColumnDef[] = [
  { key: "nameInternal", label: "Campaign Name (Internal)", type: "text", description: "Internal name used within Talkpush to identify this campaign" },
  { key: "jobTitleExternal", label: "Job Title (External)", type: "text", description: "Job title shown to candidates on application pages" },
  { key: "site", label: "Site", type: "text", description: "Location/site associated with this campaign" },
  { key: "jobDescription", label: "Job Description", type: "textarea", description: "Full job description for the position", width: "20%" },
  { key: "googleMapsLink", label: "Google Maps Link", type: "text", description: "Link to the interview/office location on Google Maps", validation: "url" },
  { key: "zoomLink", label: "Zoom/Meeting Link", type: "text", description: "Virtual interview meeting link", validation: "url" },
  { key: "comments", label: "Comments", type: "textarea" },
];

const referenceData = [
  { type: "Evergreen", description: "Continuous hiring pipeline — always open for applications, no specific requisition number." },
  { type: "Requisition-based", description: "Tied to a specific job requisition — has a defined number of openings and closing date." },
];

export function CampaignsSheet() {
  const { data, updateField } = useChecklistContext();
  const campaigns = (data.campaigns as CampaignRow[]) || defaultCampaigns;

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...campaigns];
    updated[index] = { ...updated[index], [field]: value };
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

      <ExampleHint>
        <p className="mb-1 font-medium">Sample campaigns:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>CSR - Makati</strong> | Customer Service Representative | Makati Office | Handle inbound customer calls and resolve inquiries</li>
          <li><strong>TSR - BGC Night</strong> | Technical Support Rep (Night Shift) | BGC Office | Provide L1 tech support for US-based clients</li>
        </ul>
      </ExampleHint>

      <div className="mb-6 rounded-lg border">
        <div className="bg-gray-100 px-4 py-2 text-sm font-medium">Campaign Type Reference</div>
        <div className="divide-y">
          {referenceData.map((r) => (
            <div key={r.type} className="flex gap-4 px-4 py-2 text-sm">
              <span className="w-36 shrink-0 font-medium">{r.type}</span>
              <span className="text-muted-foreground">{r.description}</span>
            </div>
          ))}
        </div>
      </div>

      <EditableTable
        columns={columns}
        data={campaigns}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        addLabel="Add Campaign"
        csvConfig={{
          sampleRow: { nameInternal: "CSR Campaign", jobTitleExternal: "Customer Service Representative", site: "Main Office", jobDescription: "Handle customer inquiries" },
          onImport: handleCsvImport,
          sheetName: "Campaigns",
        }}
      />
    </div>
  );
}
