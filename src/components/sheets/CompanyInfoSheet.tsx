"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { ExampleHint } from "@/components/shared/ExampleHint";
import { KeyValueForm, type KeyValueField } from "@/components/shared/KeyValueForm";
import { useChecklistContext } from "@/lib/checklist-context";
import { DROPDOWN_OPTIONS } from "@/lib/validations";
import { defaultCompanyInfo } from "@/lib/template-data";
import type { CompanyInfo } from "@/lib/types";

const companyDetailsFields: KeyValueField[] = [
  {
    key: "companyName",
    label: "Company Name",
    description: "Official company name used to personalize the Talkpush account and candidate experience.",
    type: "text",
  },
  {
    key: "companyAddress",
    label: "Company Address",
    description: "Official business address for the country/location being onboarded. Used for geo-tagging and location-based features.",
    type: "textarea",
  },
  {
    key: "companyWebsiteUrl",
    label: "Company Website URL",
    description: "Official company website. Must be a valid URL (e.g., https://www.company.com).",
    type: "text",
  },
  {
    key: "privacyPolicyUrl",
    label: "Privacy Policy URL",
    description: "Link to the company's privacy policy page. Mandatory for GDPR/CCPA compliance — displayed to candidates during application.",
    type: "text",
  },
  {
    key: "companyDescription",
    label: "Company Description",
    description: "Brief description of the company's services, global presence, and culture. Used in job postings and candidate-facing pages.",
    type: "textarea",
  },
];

const facebookFields: KeyValueField[] = [
  {
    key: "fbPageName",
    label: "Facebook Page Name",
    description: "Public name of the Facebook page used for recruitment (e.g., the name candidates see when interacting with the page).",
    type: "text",
  },
  {
    key: "fbPageId",
    label: "Facebook Page ID",
    description: "Unique numeric ID of the Facebook page. Found in Facebook Page Settings > Page Info.",
    type: "text",
  },
  {
    key: "fbPageUrl",
    label: "Facebook Page URL",
    description: "Direct link to the Facebook recruitment page (e.g., https://www.facebook.com/companypage).",
    type: "text",
  },
  {
    key: "fbPagePocName",
    label: "Facebook Page POC Name",
    description: "Name of the admin or point of contact who has access to manage the Facebook page.",
    type: "text",
  },
  {
    key: "fbPagePocEmail",
    label: "Facebook Page POC Email",
    description: "Email address of the point of contact managing the Facebook page.",
    type: "text",
  },
];

const brandingFields: KeyValueField[] = [
  {
    key: "logoUrl",
    label: "Company Logo (Primary)",
    description: "Link to the primary company logo file. Minimum recommended size: 200×48 px. Provide a shareable link (e.g., Google Drive, Dropbox).",
    type: "text",
  },
  {
    key: "logoSecondaryUrl",
    label: "Company Logo (Secondary)",
    description: "Link to a secondary or alternate version of the company logo (e.g., white version, icon-only).",
    type: "text",
  },
  {
    key: "companyColor",
    label: "Company Color (Hex Code)",
    description: "Primary brand color in hex format (e.g., #535FC1). Used for buttons, headers, and accent elements on candidate-facing pages.",
    type: "text",
  },
  {
    key: "bannerImageUrl",
    label: "Banner Image (1280×400)",
    description: "Landing page banner image, recommended size 1280×400 px. Provide a shareable link to the image file.",
    type: "text",
  },
  {
    key: "bannerImageLargeUrl",
    label: "Banner Image (2100×1100)",
    description: "Large landing page banner image, recommended size 2100×1100 px. Provide a shareable link to the image file.",
    type: "text",
  },
];

const recruitmentFields: KeyValueField[] = [
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
    description: "The number of days before a previously rejected candidate can re-apply. Enter a number (e.g., 90 for 90 days). Leave blank if duplicate applications are allowed.",
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
        description="Provide company details, Facebook page information, branding assets, and recruitment process settings for your Talkpush CRM instance."
      />
      <ExampleHint>
        <p className="mb-1 font-medium">Sample configuration:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>Company Name:</strong> TaskUs</li>
          <li><strong>Website:</strong> https://www.taskus.com/</li>
          <li><strong>Facebook Page:</strong> TaskUs &mdash; Page ID from Facebook Page Settings</li>
          <li><strong>Logo:</strong> Provide shareable links (Google Drive, Dropbox, etc.)</li>
          <li><strong>Allow Duplicates:</strong> No &mdash; Most clients prevent duplicate profiles.</li>
          <li><strong>Cooling Period:</strong> 90 &mdash; A 90-day cooling period is typical.</li>
        </ul>
      </ExampleHint>

      {/* Company Details */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Company Details</h3>
        <KeyValueForm
          fields={companyDetailsFields}
          data={companyInfo as unknown as Record<string, string | boolean>}
          onChange={handleChange}
        />
      </div>

      {/* Facebook Details */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Facebook Details</h3>
        <KeyValueForm
          fields={facebookFields}
          data={companyInfo as unknown as Record<string, string | boolean>}
          onChange={handleChange}
        />
      </div>

      {/* Company Branding Assets */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Company Branding Assets</h3>
        <KeyValueForm
          fields={brandingFields}
          data={companyInfo as unknown as Record<string, string | boolean>}
          onChange={handleChange}
        />
      </div>

      {/* Recruitment Process */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recruitment Process</h3>
        <KeyValueForm
          fields={recruitmentFields}
          data={companyInfo as unknown as Record<string, string | boolean>}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
