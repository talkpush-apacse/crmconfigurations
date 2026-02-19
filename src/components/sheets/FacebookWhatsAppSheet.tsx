"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { ExampleHint } from "@/components/shared/ExampleHint";
import { KeyValueForm, type KeyValueField } from "@/components/shared/KeyValueForm";
import { EditableTable } from "@/components/shared/EditableTable";
import { useChecklistContext } from "@/lib/checklist-context";
import { uid, defaultFbWhatsapp } from "@/lib/template-data";
import type { ColumnDef, FbWhatsappData, FaqEntry } from "@/lib/types";

const requirementsList = [
  "Provide a dedicated phone number for WhatsApp integration",
  "Grant Talkpush access to your Facebook Business Page",
  "Grant full access to your Business Manager account",
  "Complete Business Verification in Meta Business Suite",
  "Ensure all business information is complete and accurate",
  "Confirm the correct Business Manager account is linked",
];

const fields: KeyValueField[] = [
  { key: "phoneNumber", label: "Dedicated Phone Number", description: "A phone number dedicated for WhatsApp Business API integration. This number cannot be used with regular WhatsApp.", type: "text" },
  { key: "businessManagerAccess", label: "Business Manager Access", description: "Have you granted Talkpush access to your Facebook Business Manager?", type: "text" },
  { key: "businessVerification", label: "Business Verification", description: "Has your business completed Meta Business Verification?", type: "text" },
  { key: "chatbotName", label: "Chatbot Name", description: "The name that will appear as the chatbot identity in conversations.", type: "text" },
  { key: "chatbotPersona", label: "Chatbot Persona", description: "The personality/tone the chatbot should use (e.g., professional, friendly, casual).", type: "text" },
];

const faqColumns: ColumnDef[] = [
  { key: "category", label: "Category", type: "text", description: "Category of the FAQ (e.g., General, Technical, Process)" },
  { key: "faq", label: "FAQ", type: "text", description: "The frequently asked question topic" },
  { key: "description", label: "Description", type: "text", description: "Brief description of the FAQ" },
  { key: "example", label: "Example Question", type: "text", description: "A sample question a candidate might ask" },
  { key: "faqResponse", label: "Response", type: "textarea", description: "The chatbot's response to this FAQ", width: "30%" },
];

export function FacebookWhatsAppSheet() {
  const { data, updateField } = useChecklistContext();
  const fbData = (data.fbWhatsapp as FbWhatsappData) || defaultFbWhatsapp;
  const faqs = fbData.faqs || [];

  const handleChange = (key: string, value: string | boolean) => {
    updateField("fbWhatsapp", { ...fbData, [key]: value });
  };

  const handleFaqUpdate = (index: number, field: string, value: string | boolean) => {
    const updated = [...faqs];
    updated[index] = { ...updated[index], [field]: value };
    updateField("fbWhatsapp", { ...fbData, faqs: updated });
  };

  const handleFaqAdd = () => {
    const newFaq: FaqEntry = {
      id: uid(),
      category: "",
      faq: "",
      description: "",
      example: "",
      faqResponse: "",
    };
    updateField("fbWhatsapp", { ...fbData, faqs: [...faqs, newFaq] });
  };

  const handleFaqDelete = (index: number) => {
    updateField("fbWhatsapp", { ...fbData, faqs: faqs.filter((_, i) => i !== index) });
  };

  const handleFaqDuplicate = (index: number) => {
    const clone = { ...faqs[index], id: uid() };
    const updated = [...faqs];
    updated.splice(index + 1, 0, clone);
    updateField("fbWhatsapp", { ...fbData, faqs: updated });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFaqCsvImport = (rows: Record<string, any>[]) => {
    const newRows = rows.map((row) => ({
      id: uid(),
      category: "", faq: "", description: "", example: "", faqResponse: "",
      ...row,
    }));
    updateField("fbWhatsapp", { ...fbData, faqs: [...faqs, ...newRows] });
  };

  return (
    <div>
      <SectionHeader
        title="Facebook Messenger & WhatsApp"
        description="Configure your Facebook Messenger and WhatsApp chatbot integration."
      />

      <ExampleHint>
        <p className="mb-1 font-medium">Sample configuration:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>Phone Number:</strong> +63 917 000 1234 (must NOT be registered on WhatsApp already)</li>
          <li><strong>Chatbot Name:</strong> &quot;Ava&quot; &mdash; short, friendly name candidates will see</li>
          <li><strong>Chatbot Persona:</strong> Professional and helpful &mdash; guides candidates through application</li>
        </ul>
      </ExampleHint>

      <div className="mb-6 rounded-lg border">
        <div className="bg-gray-100 px-4 py-2 text-sm font-medium">Setup Requirements</div>
        <div className="p-4">
          <ol className="space-y-2 text-sm text-muted-foreground">
            {requirementsList.map((req, i) => (
              <li key={i} className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-lavender-darker text-xs text-white">
                  {i + 1}
                </span>
                {req}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <KeyValueForm
        fields={fields}
        data={fbData as unknown as Record<string, string | boolean>}
        onChange={handleChange}
      />

      <div className="mt-8">
        <SectionHeader
          title="Chatbot FAQs"
          description="Define frequently asked questions and responses for the Facebook Messenger and WhatsApp chatbot."
        />
        <EditableTable
          columns={faqColumns}
          data={faqs}
          onUpdate={handleFaqUpdate}
          onAdd={handleFaqAdd}
          onDelete={handleFaqDelete}
          onDuplicate={handleFaqDuplicate}
          addLabel="Add FAQ"
          csvConfig={{
            sampleRow: { category: "General", faq: "Working Hours", description: "Office hours question", example: "What are your working hours?", faqResponse: "Our office hours are 9AM to 6PM." },
            onImport: handleFaqCsvImport,
            sheetName: "FB WhatsApp FAQs",
          }}
        />
      </div>
    </div>
  );
}
