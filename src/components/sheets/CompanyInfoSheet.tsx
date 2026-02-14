"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { KeyValueForm, type KeyValueField } from "@/components/shared/KeyValueForm";
import { useChecklistContext } from "@/lib/checklist-context";
import { DROPDOWN_OPTIONS } from "@/lib/validations";
import { defaultCompanyInfo } from "@/lib/template-data";
import type { CompanyInfo } from "@/lib/types";

const fields: KeyValueField[] = [
  {
    key: "allowDuplicates",
    label: "Allow Duplicate Candidates?",
    description: "Should the system allow duplicate candidate profiles? If set to 'No', candidates with the same email or phone number will be flagged.",
    type: "dropdown",
    options: [...DROPDOWN_OPTIONS.yesNo],
  },
  {
    key: "coolingPeriod",
    label: "Cooling Period",
    description: "The number of days before a previously rejected candidate can re-apply. Enter a number (e.g., 90 for 90 days).",
    type: "text",
  },
  {
    key: "rehiresAllowed",
    label: "Rehires Allowed?",
    description: "Can candidates who previously worked at the company apply again through the platform?",
    type: "dropdown",
    options: [...DROPDOWN_OPTIONS.yesNo],
  },
];

export function CompanyInfoSheet() {
  const { data, updateField } = useChecklistContext();
  const companyInfo = (data.companyInfo as CompanyInfo) || defaultCompanyInfo;

  const handleChange = (key: string, value: string | boolean) => {
    updateField("companyInfo", { ...companyInfo, [key]: value });
  };

  return (
    <div>
      <SectionHeader
        title="Company Information"
        description="Provide basic company configuration settings for your Talkpush CRM instance."
      />
      <KeyValueForm
        fields={fields}
        data={companyInfo as unknown as Record<string, string | boolean>}
        onChange={handleChange}
      />
    </div>
  );
}
