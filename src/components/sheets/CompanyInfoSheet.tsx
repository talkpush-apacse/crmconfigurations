"use client";

import { useEffect } from "react";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ExampleHint } from "@/components/shared/ExampleHint";
import { KeyValueForm, type KeyValueField } from "@/components/shared/KeyValueForm";
import { TabUploadBanner, TabUploadSkippedNotice } from "@/components/shared/TabUploadBanner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useTabUpload } from "@/hooks/useTabUpload";
import { useChecklistContext } from "@/lib/checklist-context";
import { DROPDOWN_OPTIONS } from "@/lib/validations";
import { defaultCompanyInfo } from "@/lib/template-data";
import { cn } from "@/lib/utils";
import type { BusinessHourEntry, CompanyInfo } from "@/lib/types";
import { SectionFooter } from "@/components/shared/SectionFooter";

const companyDetailsFields: KeyValueField[] = [
  {
    key: "companyName",
    label: "Company Name",
    description: "Official company name used to personalize the Talkpush account and candidate experience.",
    type: "text",
    placeholder: "e.g. TaskUs Philippines Inc.",
    example: "TaskUs Philippines Inc.",
  },
  {
    key: "companyAddress",
    label: "Company Address",
    description: "Official business address for the country/location being onboarded. Used for geo-tagging and location-based features.",
    type: "textarea",
    example: "5F Ayala Tower, Ayala Ave, Makati City 1226",
  },
  {
    key: "companyWebsiteUrl",
    label: "Company Website URL",
    description: "Official company website. Must be a valid URL (e.g., https://www.company.com).",
    type: "text",
    placeholder: "https://www.yourcompany.com",
    example: "https://www.taskus.com",
    validation: "url",
  },
  {
    key: "privacyPolicyUrl",
    label: "Privacy Policy URL",
    description: "Link to the company's privacy policy page. Mandatory for GDPR/CCPA compliance — displayed to candidates during application.",
    type: "text",
    placeholder: "https://www.yourcompany.com/privacy-policy",
    example: "https://www.taskus.com/privacy-policy",
    validation: "url",
  },
  {
    key: "companyDescription",
    label: "Company Description",
    description: "Brief description of the company's services, global presence, and culture. Used in job postings and candidate-facing pages.",
    type: "textarea",
    example: "TaskUs is a global outsourcing company providing customer experience, AI operations, and content security services.",
  },
];

const facebookFields: KeyValueField[] = [
  {
    key: "fbPageName",
    label: "Facebook Page Name",
    description: "Public name of the Facebook page used for recruitment (e.g., the name candidates see when interacting with the page).",
    type: "text",
    example: "TaskUs Careers PH",
  },
  {
    key: "fbPageId",
    label: "Facebook Page ID",
    description: "Unique numeric ID of the Facebook page. Found in Facebook Page Settings > Page Info.",
    type: "text",
    placeholder: "e.g. 123456789012345",
    example: "123456789012345",
  },
  {
    key: "fbPageUrl",
    label: "Facebook Page URL",
    description: "Direct link to the Facebook recruitment page (e.g., https://www.facebook.com/companypage).",
    type: "text",
    placeholder: "https://www.facebook.com/yourpage",
    example: "https://www.facebook.com/TaskUsCareers",
    validation: "url",
  },
  {
    key: "fbPagePocName",
    label: "Facebook Page POC Name",
    description: "Name of the admin or point of contact who has access to manage the Facebook page.",
    type: "text",
    example: "Maria Santos",
  },
  {
    key: "fbPagePocEmail",
    label: "Facebook Page POC Email",
    description: "Email address of the point of contact managing the Facebook page.",
    type: "text",
    placeholder: "e.g. marketing@yourcompany.com",
    example: "marketing@taskus.com",
    validation: "email",
  },
];

const brandingFields: KeyValueField[] = [
  {
    key: "logoUrl",
    label: "Company Logo (Primary)",
    description: "Upload or link to the primary company logo file.",
    helperText: "Recommended size: 200\u00d748px (PNG or SVG, transparent background)",
    type: "file",
  },
  {
    key: "logoSecondaryUrl",
    label: "Company Logo (Secondary)",
    description: "Upload or link to a secondary or alternate version of the company logo (e.g., white version, icon-only).",
    type: "file",
  },
  {
    key: "companyColor",
    label: "Company Color (Hex Code)",
    description: "Primary brand color in hex format (e.g., #535FC1). Used for buttons, headers, and accent elements on candidate-facing pages.",
    type: "text",
    placeholder: "e.g. #535FC1",
    example: "#535FC1",
  },
  {
    key: "bannerImageUrl",
    label: "Banner Image (1280×400)",
    description: "Upload or link to a landing page banner image, recommended size 1280×400 px.",
    type: "file",
  },
  {
    key: "bannerImageLargeUrl",
    label: "Banner Image (2100×1100)",
    description: "Upload or link to a large landing page banner image, recommended size 2100×1100 px.",
    type: "file",
  },
];

const recruitmentFields: KeyValueField[] = [
  {
    key: "allowDuplicates",
    label: "Allow Duplicate Candidates?",
    description: "Should the system allow duplicate candidate profiles? If set to 'No', candidates with the same email or phone number will be flagged.",
    type: "dropdown",
    options: [...DROPDOWN_OPTIONS.yesNo],
    example: "No",
  },
  {
    key: "coolingPeriod",
    label: "Cooling Period",
    description: "The number of days before a previously rejected candidate can re-apply. Enter a number (e.g., 90 for 90 days). Leave blank if duplicate applications are allowed.",
    type: "text",
    placeholder: "e.g. 90 (number of days)",
    example: "90",
  },
  {
    key: "rehiresAllowed",
    label: "Rehires Allowed?",
    description: "Can candidates who previously worked at the company apply again through the platform?",
    type: "dropdown",
    options: [...DROPDOWN_OPTIONS.yesNo],
    example: "Yes",
  },
];

const DEFAULT_BUSINESS_HOURS: BusinessHourEntry[] = [
  { day: "Monday", isOpen: true, openTime: "08:00", closeTime: "17:00" },
  { day: "Tuesday", isOpen: true, openTime: "08:00", closeTime: "17:00" },
  { day: "Wednesday", isOpen: true, openTime: "08:00", closeTime: "17:00" },
  { day: "Thursday", isOpen: true, openTime: "08:00", closeTime: "17:00" },
  { day: "Friday", isOpen: true, openTime: "08:00", closeTime: "17:00" },
  { day: "Saturday", isOpen: false, openTime: "08:00", closeTime: "17:00" },
  { day: "Sunday", isOpen: false, openTime: "08:00", closeTime: "17:00" },
];

export function CompanyInfoSheet() {
  const { data, updateField } = useChecklistContext();
  const { isSkipped, uploadedFiles } = useTabUpload("companyInfo");
  const storedCompanyInfo = data.companyInfo as CompanyInfo | null;
  const companyInfo = storedCompanyInfo || defaultCompanyInfo;
  const businessHours = companyInfo.businessHours ?? DEFAULT_BUSINESS_HOURS;

  useEffect(() => {
    if (storedCompanyInfo?.businessHours) return;
    updateField("companyInfo", { ...companyInfo, businessHours: DEFAULT_BUSINESS_HOURS });
  }, [companyInfo, storedCompanyInfo, updateField]);

  const handleChange = (key: string, value: string | boolean) => {
    updateField("companyInfo", { ...companyInfo, [key]: value });
  };

  const handleBusinessHourChange = (
    index: number,
    field: keyof BusinessHourEntry,
    value: string | boolean
  ) => {
    const updatedHours = businessHours.map((entry, entryIndex) =>
      entryIndex === index ? { ...entry, [field]: value } : entry
    );
    updateField("companyInfo", { ...companyInfo, businessHours: updatedHours });
  };

  return (
    <div>
      <SectionHeader
        title="Company Information"
        description="Provide company details, Facebook page information, branding assets, and recruitment process settings for your Talkpush CRM instance."
      />

      <TabUploadBanner tabKey="companyInfo" tabLabel="Company Information" />

      {isSkipped ? (
        <TabUploadSkippedNotice fileCount={uploadedFiles.length} />
      ) : (
        <>
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
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Company Details</h3>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        <KeyValueForm
          fields={companyDetailsFields}
          data={companyInfo as unknown as Record<string, string | boolean>}
          onChange={handleChange}
        />
      </div>

      {/* Facebook Details */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Facebook Details</h3>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        <KeyValueForm
          fields={facebookFields}
          data={companyInfo as unknown as Record<string, string | boolean>}
          onChange={handleChange}
        />
      </div>

      {/* Company Branding Assets */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Company Branding Assets</h3>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        <KeyValueForm
          fields={brandingFields}
          data={companyInfo as unknown as Record<string, string | boolean>}
          onChange={handleChange}
        />
      </div>

      {/* Recruitment Process */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Recruitment Process</h3>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        <KeyValueForm
          fields={recruitmentFields}
          data={companyInfo as unknown as Record<string, string | boolean>}
          onChange={handleChange}
        />
      </div>

      <div className="mb-6">
        <SectionHeader
          title="Business Hours"
          description="Defines the window during which automated messages (autoflows) are sent to candidates. Messages triggered outside these hours are queued and delivered at the next opening time. Manual recruiter messages are not affected by this setting."
        />
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[110px_72px_1fr_1fr] bg-blue-600 text-white sm:grid-cols-[160px_90px_1fr_1fr]">
            <div className="px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.05em]">Day</div>
            <div className="px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.05em]">Open</div>
            <div className="px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.05em]">Opening Time</div>
            <div className="px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.05em]">Closing Time</div>
          </div>
          {businessHours.map((entry, idx) => (
            <div
              key={entry.day}
              className={cn(
                "grid grid-cols-[110px_72px_1fr_1fr] items-center border-b last:border-b-0 sm:grid-cols-[160px_90px_1fr_1fr]",
                idx % 2 === 0 ? "bg-white" : "bg-slate-50/60",
                !entry.isOpen ? "text-muted-foreground" : ""
              )}
            >
              <div className="px-3 py-2.5 text-sm font-medium">
                {entry.day}
              </div>
              <div className="flex justify-center px-3 py-2.5">
                <Checkbox
                  checked={entry.isOpen}
                  onCheckedChange={(val) => handleBusinessHourChange(idx, "isOpen", val === true)}
                  aria-label={`${entry.day} open`}
                />
              </div>
              <div className="px-2 py-1.5">
                <Input
                  type="time"
                  value={entry.openTime}
                  onChange={(e) => handleBusinessHourChange(idx, "openTime", e.target.value)}
                  disabled={!entry.isOpen}
                  className="h-8 text-sm disabled:bg-slate-100 disabled:opacity-50"
                />
              </div>
              <div className="px-2 py-1.5">
                <Input
                  type="time"
                  value={entry.closeTime}
                  onChange={(e) => handleBusinessHourChange(idx, "closeTime", e.target.value)}
                  disabled={!entry.isOpen}
                  className="h-8 text-sm disabled:bg-slate-100 disabled:opacity-50"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
        </>
      )}
      <SectionFooter />
    </div>
  );
}
