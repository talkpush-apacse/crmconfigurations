"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { EditableTable } from "@/components/shared/EditableTable";
import { useChecklistContext } from "@/lib/checklist-context";
import { defaultAiCallFaqs } from "@/lib/template-data";
import type { ColumnDef, AiCallFaqRow } from "@/lib/types";

const columns: ColumnDef[] = [
  { key: "faq", label: "FAQ Topic", type: "text", description: "The topic or category of the FAQ" },
  { key: "example", label: "Example Question", type: "text", description: "A sample question a candidate might ask about this topic" },
  { key: "faqResponse", label: "FAQ Response", type: "textarea", description: "The response the AI should give when asked about this topic. Use placeholders like {{interview_location}}, {{company_name}} for dynamic content.", width: "40%" },
];

export function AICallFAQsSheet() {
  const { data, updateField } = useChecklistContext();
  const faqs = (data.aiCallFaqs as AiCallFaqRow[]) || defaultAiCallFaqs;

  const handleUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...faqs];
    updated[index] = { ...updated[index], [field]: value };
    updateField("aiCallFaqs", updated);
  };

  const handleAdd = () => {
    updateField("aiCallFaqs", [
      ...faqs,
      { id: Math.random().toString(36).substring(2, 9), faq: "", example: "", faqResponse: "" },
    ]);
  };

  const handleDelete = (index: number) => {
    updateField("aiCallFaqs", faqs.filter((_, i) => i !== index));
  };

  const handleDuplicate = (index: number) => {
    const clone = { ...faqs[index], id: Math.random().toString(36).substring(2, 9) };
    const updated = [...faqs];
    updated.splice(index + 1, 0, clone);
    updateField("aiCallFaqs", updated);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: Math.random().toString(36).substring(2, 9),
      faq: "", example: "", faqResponse: "",
      ...row,
    }));
    updateField("aiCallFaqs", [...faqs, ...newRows]);
  };

  return (
    <div>
      <SectionHeader
        title="AI Call FAQs"
        description="Define the frequently asked questions and responses for the AI call system."
      />

      <div className="mb-4 rounded-lg border bg-purple-50 p-3">
        <p className="text-xs text-purple-700">
          <strong>Available placeholders:</strong>{" "}
          {"{{interview_location}}, {{company_name}}, {{site_name}}, {{interview_format}}, {{dress_code}}"}
        </p>
      </div>

      <EditableTable
        columns={columns}
        data={faqs}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        addLabel="Add FAQ"
        csvConfig={{
          sampleRow: { faq: "Working Hours", example: "What are the working hours?", faqResponse: "Working hours are 9AM to 6PM, Monday to Friday." },
          onImport: handleCsvImport,
          sheetName: "AI Call FAQs",
        }}
      />
    </div>
  );
}
