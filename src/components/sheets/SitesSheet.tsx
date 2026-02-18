"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { ExampleHint } from "@/components/shared/ExampleHint";
import { EditableTable } from "@/components/shared/EditableTable";
import { useChecklistContext } from "@/lib/checklist-context";
import { DROPDOWN_OPTIONS } from "@/lib/validations";
import { uid, defaultSites } from "@/lib/template-data";
import type { ColumnDef, SiteRow } from "@/lib/types";

const columns: ColumnDef[] = [
  { key: "siteName", label: "Site Name", type: "text", description: "Public-facing name of the interview/office site" },
  { key: "internalName", label: "Internal Name", type: "text", description: "Internal identifier for this site" },
  { key: "interviewType", label: "Interview Type", type: "dropdown", options: [...DROPDOWN_OPTIONS.interviewTypes], description: "Whether interviews are conducted onsite, virtually, or both" },
];

const detailColumns: ColumnDef[] = [
  { key: "interviewHours", label: "Interview Hours", type: "text", description: "Available hours for scheduling interviews (e.g., 9AM-5PM)" },
  { key: "fullAddress", label: "Full Address", type: "textarea", description: "Complete physical address of the site" },
  { key: "documentsToRring", label: "Documents to Bring", type: "textarea", description: "List of documents candidates should bring to the site" },
  { key: "googleMapsLink", label: "Google Maps Link", type: "text", description: "Link to the location on Google Maps", validation: "url" },
  { key: "comments", label: "Comments", type: "textarea" },
];

export function SitesSheet() {
  const { data, updateField } = useChecklistContext();
  const sites = (data.sites as SiteRow[]) || defaultSites;

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...sites];
    updated[index] = { ...updated[index], [field]: value };
    updateField("sites", updated);
  };

  const handleAdd = () => {
    updateField("sites", [
      ...sites,
      { id: uid(), siteName: "", internalName: "", interviewHours: "", interviewType: "", fullAddress: "", documentsToRring: "", googleMapsLink: "", comments: "" },
    ]);
  };

  const handleDelete = (index: number) => {
    updateField("sites", sites.filter((_, i) => i !== index));
  };

  const handleDuplicate = (index: number) => {
    const clone = { ...sites[index], id: uid() };
    const updated = [...sites];
    updated.splice(index + 1, 0, clone);
    updateField("sites", updated);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: uid(),
      siteName: "", internalName: "", interviewHours: "", interviewType: "", fullAddress: "", documentsToRring: "", googleMapsLink: "", comments: "",
      ...row,
    }));
    updateField("sites", [...sites, ...newRows]);
  };

  return (
    <div>
      <SectionHeader
        title="Sites"
        description="Configure interview and office locations where candidates may be directed."
      />
      <ExampleHint>
        <p className="mb-1 font-medium">Sample sites:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>Makati Main</strong> | MKT-HQ | Mon-Fri 9AM-5PM | Onsite | 5F Ayala Tower, Ayala Ave, Makati City | Valid ID, NBI Clearance</li>
          <li><strong>BGC Hub</strong> | BGC-01 | Mon-Sat 8AM-8PM | Hybrid | 10F High Street South, BGC, Taguig | Valid ID, SSS E1</li>
        </ul>
      </ExampleHint>

      <EditableTable
        columns={columns}
        detailColumns={detailColumns}
        data={sites}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        addLabel="Add Site"
        csvConfig={{
          sampleRow: { siteName: "Main Office", internalName: "HQ", interviewHours: "9AM-5PM", interviewType: "Onsite", fullAddress: "123 Main St, City" },
          onImport: handleCsvImport,
          sheetName: "Sites",
        }}
      />
    </div>
  );
}
