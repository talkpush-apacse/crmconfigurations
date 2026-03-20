"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { SectionFooter } from "@/components/shared/SectionFooter";
import { useChecklistContext } from "@/lib/checklist-context";
import { defaultAdminSettings } from "@/lib/template-data";
import type { AdminSettingsData, BusinessHourEntry } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ===== Section Divider =====
function SectionDivider({ title }: { title: string }) {
  return (
    <div className="mb-4 mt-8 first:mt-0 flex items-center gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
        {title}
      </h3>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

// ===== Text Field Row =====
function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4 py-2.5 px-3 border-b last:border-b-0">
      <Label className="text-sm font-medium text-gray-700 sm:w-[280px] shrink-0">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? `Enter ${label.toLowerCase()}`}
        className="border-gray-300 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
      />
    </div>
  );
}

// ===== Read-Only Display Row =====
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4 py-2.5 px-3 border-b last:border-b-0">
      <Label className="text-sm font-medium text-gray-700 sm:w-[280px] shrink-0">
        {label}
      </Label>
      <span className="text-sm text-gray-500 italic">
        {value || "Not set"}
      </span>
    </div>
  );
}

// ===== Dropdown Row =====
function DropdownField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4 py-2.5 px-3 border-b last:border-b-0">
      <Label className="text-sm font-medium text-gray-700 sm:w-[280px] shrink-0">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:max-w-[300px]">
          <SelectValue placeholder={placeholder ?? `Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ===== File Upload Row =====
function FileField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4 py-2.5 px-3 border-b last:border-b-0">
      <Label className="text-sm font-medium text-gray-700 sm:w-[280px] shrink-0">
        {label}
      </Label>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste URL or file path"
        className="border-gray-300 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
      />
    </div>
  );
}

// ===== Checkbox Item (for Feature Checkboxes section) =====
function CheckboxItem({
  label,
  checked,
  onChange,
  disabled,
  indent,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2 px-3 border-b last:border-b-0 transition-colors",
        checked ? "bg-teal-50/40" : "",
        indent ? "pl-10" : ""
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(val) => onChange(val === true)}
        disabled={disabled}
      />
      <Label
        className={cn(
          "text-sm cursor-pointer select-none",
          checked ? "text-gray-900 font-medium" : "text-gray-600",
          disabled ? "opacity-50 cursor-not-allowed" : ""
        )}
      >
        {label}
      </Label>
    </div>
  );
}

// ===== Radio Group Row =====
function RadioField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4 py-2.5 px-3 border-b last:border-b-0">
      <Label className="text-sm font-medium text-gray-700 sm:w-[280px] shrink-0 sm:pt-0.5">
        {label}
      </Label>
      <div className="flex gap-4">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={label}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="h-4 w-4 text-teal-600 border-gray-300 focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ===== Business Hours Editor =====
function BusinessHoursEditor({
  hours,
  onChange,
}: {
  hours: BusinessHourEntry[];
  onChange: (hours: BusinessHourEntry[]) => void;
}) {
  const updateDay = (index: number, field: keyof BusinessHourEntry, value: string | boolean) => {
    const updated = hours.map((h, i) =>
      i === index ? { ...h, [field]: value } : h
    );
    onChange(updated);
  };

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[120px_60px_1fr_1fr] sm:grid-cols-[160px_60px_1fr_1fr] bg-blue-600 text-white">
        <div className="px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.05em]">Day</div>
        <div className="px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.05em]">Active</div>
        <div className="px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.05em]">Start</div>
        <div className="px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.05em]">End</div>
      </div>
      {hours.map((entry, idx) => (
        <div
          key={entry.day}
          className={cn(
            "grid grid-cols-[120px_60px_1fr_1fr] sm:grid-cols-[160px_60px_1fr_1fr] border-b last:border-b-0 items-center",
            idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"
          )}
        >
          <div className="px-3 py-2.5 text-sm font-medium text-gray-700">
            {entry.day}
          </div>
          <div className="px-3 py-2.5 flex justify-center">
            <Checkbox
              checked={entry.enabled}
              onCheckedChange={(val) => updateDay(idx, "enabled", val === true)}
            />
          </div>
          <div className="px-2 py-1.5">
            <Input
              type="time"
              value={entry.startTime}
              onChange={(e) => updateDay(idx, "startTime", e.target.value)}
              disabled={!entry.enabled}
              className="h-8 text-sm border-gray-300 bg-white disabled:opacity-40"
            />
          </div>
          <div className="px-2 py-1.5">
            <Input
              type="time"
              value={entry.endTime}
              onChange={(e) => updateDay(idx, "endTime", e.target.value)}
              disabled={!entry.enabled}
              className="h-8 text-sm border-gray-300 bg-white disabled:opacity-40"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== Timezone options =====
const TIMEZONE_OPTIONS = [
  "UTC-12:00", "UTC-11:00", "UTC-10:00", "UTC-09:30", "UTC-09:00",
  "UTC-08:00", "UTC-07:00", "UTC-06:00", "UTC-05:00", "UTC-04:00",
  "UTC-03:30", "UTC-03:00", "UTC-02:00", "UTC-01:00", "UTC+00:00",
  "UTC+01:00", "UTC+02:00", "UTC+03:00", "UTC+03:30", "UTC+04:00",
  "UTC+04:30", "UTC+05:00", "UTC+05:30", "UTC+05:45", "UTC+06:00",
  "UTC+06:30", "UTC+07:00", "UTC+08:00", "UTC+08:45", "UTC+09:00",
  "UTC+09:30", "UTC+10:00", "UTC+10:30", "UTC+11:00", "UTC+12:00",
  "UTC+12:45", "UTC+13:00", "UTC+14:00",
];

// ===== Country options (common) =====
const COUNTRY_OPTIONS = [
  "Afghanistan", "Albania", "Algeria", "Argentina", "Australia", "Austria",
  "Bangladesh", "Belgium", "Brazil", "Cambodia", "Canada", "Chile", "China",
  "Colombia", "Costa Rica", "Czech Republic", "Denmark", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Finland", "France", "Germany", "Ghana",
  "Greece", "Guatemala", "Honduras", "Hong Kong", "Hungary", "India",
  "Indonesia", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan",
  "Kenya", "South Korea", "Kuwait", "Lebanon", "Malaysia", "Mexico",
  "Morocco", "Myanmar", "Nepal", "Netherlands", "New Zealand", "Nicaragua",
  "Nigeria", "Norway", "Oman", "Pakistan", "Panama", "Peru", "Philippines",
  "Poland", "Portugal", "Puerto Rico", "Qatar", "Romania", "Saudi Arabia",
  "Singapore", "South Africa", "Spain", "Sri Lanka", "Sweden", "Switzerland",
  "Taiwan", "Thailand", "Trinidad and Tobago", "Turkey", "UAE",
  "United Kingdom", "United States", "Uruguay", "Venezuela", "Vietnam",
];

// ===== Main Component =====
export function AdminSettingsSheet() {
  const { data, updateField } = useChecklistContext();
  const settings = (data.adminSettings as AdminSettingsData) || defaultAdminSettings;

  const update = (key: keyof AdminSettingsData, value: AdminSettingsData[keyof AdminSettingsData]) => {
    updateField("adminSettings", { ...settings, [key]: value });
  };

  const updateString = (key: keyof AdminSettingsData) => (val: string) => {
    update(key, val);
  };

  const updateBoolean = (key: keyof AdminSettingsData) => (val: boolean) => {
    update(key, val);
  };

  // Count checked features
  const featureKeys: (keyof AdminSettingsData)[] = [
    "transcript", "autoCall", "liveCall", "messengerIntegration", "smsOptOut",
    "recruitmentCenterScheduling", "pushMessages", "requireWhatsAppOptin",
    "myCalendar", "allowDisableReschedule", "expireApplicationOnCoolingPeriod",
    "autoflow", "talkpushOnboard", "ocr", "autoListJobCampaigns",
    "autoDeleteOldLeads", "geolocation", "autoflowInbox",
    "persistentPrivacyPolicyLink", "cookiesBannerNotification",
    "mandatoryRejectionReasons", "mandatoryShortlistedReasons", "talkScore",
    "talkScoreWeightDistribution", "applicantScoring", "customizableTalkScore",
    "tecolocoIntegration", "csvUpdate", "allowLimitedManagersSelfAssign",
    "recognitionExtractionValidation", "landingPageRealtimeFeedback",
    "documentProcessingMistral", "autoflowSets", "mandatoryEmailAndPhone",
    "templateCampaigns", "talkScoreReadingDetection",
    "overrideUnsubscribeCommand", "enableAutomaticGtmInsertion",
    "emailPreferenceManagement",
  ];
  const enabledCount = featureKeys.filter((k) => settings[k] === true).length;

  return (
    <div>
      <SectionHeader
        title="Admin Settings"
        description="Internal Talkpush configuration settings for this client's CRM instance. Only visible to Talkpush team members."
      />

      {/* BASIC COMPANY INFO */}
      <SectionDivider title="Basic Company Info" />
      <div className="rounded-lg border overflow-hidden mb-6">
        <TextField
          label="Company Name"
          value={settings.companyName}
          onChange={updateString("companyName")}
          placeholder="e.g. TaskUs Philippines Inc."
        />
        <ReadOnlyField
          label="Company Subdomain"
          value={settings.companySubdomain}
        />
        <ReadOnlyField
          label="Region"
          value={settings.region}
        />
        <DropdownField
          label="Status"
          value={settings.status}
          onChange={updateString("status")}
          options={["active", "dormant"]}
          placeholder="Select status"
        />
        <FileField
          label="Company Logo"
          value={settings.companyLogo}
          onChange={updateString("companyLogo")}
        />
        <DropdownField
          label="Default Country of Candidates"
          value={settings.defaultCountry}
          onChange={updateString("defaultCountry")}
          options={COUNTRY_OPTIONS}
          placeholder="Select country"
        />
        <DropdownField
          label="Time Zone"
          value={settings.timeZone}
          onChange={updateString("timeZone")}
          options={TIMEZONE_OPTIONS}
          placeholder="Select time zone"
        />
      </div>

      {/* CAMPAIGN & SMS SETTINGS */}
      <SectionDivider title="Campaign & SMS Settings" />
      <div className="rounded-lg border overflow-hidden mb-6">
        <TextField
          label="Catch All Campaign for Failed Inbound SMS"
          value={settings.catchAllCampaign}
          onChange={updateString("catchAllCampaign")}
          placeholder="Enter campaign name or ID"
        />
        <TextField
          label="Telerivet Project ID"
          value={settings.telerivetProjectId}
          onChange={updateString("telerivetProjectId")}
        />
        <TextField
          label="Inbound SMS Hotline – Add Candidate"
          value={settings.inboundSmsHotline}
          onChange={updateString("inboundSmsHotline")}
          placeholder="e.g. +1234567890"
        />
        <TextField
          label="Inbound Nexmo SMS"
          value={settings.inboundNexmoSms}
          onChange={updateString("inboundNexmoSms")}
        />
        <TextField
          label="Twilio Inbound SMS"
          value={settings.twilioInboundSms}
          onChange={updateString("twilioInboundSms")}
        />
        <TextField
          label="Chat Inbound Number"
          value={settings.chatInboundNumber}
          onChange={updateString("chatInboundNumber")}
        />
        <TextField
          label="Number of Allowed Users"
          value={settings.numberOfAllowedUsers}
          onChange={updateString("numberOfAllowedUsers")}
          placeholder="e.g. 50"
        />
      </div>

      {/* FEATURE CHECKBOXES */}
      <SectionDivider title={`Feature Checkboxes (${enabledCount} / ${featureKeys.length} enabled)`} />
      <div className="rounded-lg border overflow-hidden mb-6">
        <CheckboxItem label="Transcript" checked={settings.transcript} onChange={updateBoolean("transcript")} />
        <CheckboxItem label="Auto Call" checked={settings.autoCall} onChange={updateBoolean("autoCall")} />
        <CheckboxItem label="Live Call" checked={settings.liveCall} onChange={updateBoolean("liveCall")} />
        <CheckboxItem label="Messenger Integration Allowed" checked={settings.messengerIntegration} onChange={updateBoolean("messengerIntegration")} />
        <CheckboxItem label="SMS Opt-out" checked={settings.smsOptOut} onChange={updateBoolean("smsOptOut")} />
        <CheckboxItem label="Recruitment Center Scheduling" checked={settings.recruitmentCenterScheduling} onChange={updateBoolean("recruitmentCenterScheduling")} />
        <CheckboxItem label="Push Messages" checked={settings.pushMessages} onChange={updateBoolean("pushMessages")} />
        <CheckboxItem label="Require WhatsApp Optin" checked={settings.requireWhatsAppOptin} onChange={updateBoolean("requireWhatsAppOptin")} />
        <CheckboxItem label="My Calendar (Cronofy)" checked={settings.myCalendar} onChange={updateBoolean("myCalendar")} />
        <CheckboxItem label='Allow "Disable Reschedule" in Booking Questions' checked={settings.allowDisableReschedule} onChange={updateBoolean("allowDisableReschedule")} />
        <CheckboxItem label="Expire Application on Cooling Period" checked={settings.expireApplicationOnCoolingPeriod} onChange={updateBoolean("expireApplicationOnCoolingPeriod")} />
        <CheckboxItem label="Autoflow" checked={settings.autoflow} onChange={updateBoolean("autoflow")} />
        <CheckboxItem label="Talkpush Onboard" checked={settings.talkpushOnboard} onChange={updateBoolean("talkpushOnboard")} />
        <CheckboxItem
          label="OCR (Requires Talkpush Onboard)"
          checked={settings.ocr}
          onChange={updateBoolean("ocr")}
          disabled={!settings.talkpushOnboard}
          indent
        />
        <CheckboxItem label="Automatically List Job Campaigns on Facebook Jobs and Google Jobs" checked={settings.autoListJobCampaigns} onChange={updateBoolean("autoListJobCampaigns")} />
        <CheckboxItem label="Auto-delete 1 Year Old Leads" checked={settings.autoDeleteOldLeads} onChange={updateBoolean("autoDeleteOldLeads")} />
        <CheckboxItem label="Geolocation" checked={settings.geolocation} onChange={updateBoolean("geolocation")} />
        <CheckboxItem label="Autoflow Inbox" checked={settings.autoflowInbox} onChange={updateBoolean("autoflowInbox")} />
        <CheckboxItem label="Persistent Privacy Policy Link" checked={settings.persistentPrivacyPolicyLink} onChange={updateBoolean("persistentPrivacyPolicyLink")} />
        <CheckboxItem label="Cookies Banner Notification" checked={settings.cookiesBannerNotification} onChange={updateBoolean("cookiesBannerNotification")} />
        <CheckboxItem label="Mandatory Rejection Reasons" checked={settings.mandatoryRejectionReasons} onChange={updateBoolean("mandatoryRejectionReasons")} />
        <CheckboxItem label="Mandatory Shortlisted Reasons" checked={settings.mandatoryShortlistedReasons} onChange={updateBoolean("mandatoryShortlistedReasons")} />
        <CheckboxItem label="TalkScore" checked={settings.talkScore} onChange={updateBoolean("talkScore")} />
        <CheckboxItem label="TalkScore Weight Distribution" checked={settings.talkScoreWeightDistribution} onChange={updateBoolean("talkScoreWeightDistribution")} />
        <CheckboxItem label="Applicant Scoring" checked={settings.applicantScoring} onChange={updateBoolean("applicantScoring")} />
        <CheckboxItem label="Customizable TalkScore in Applicant Scoring" checked={settings.customizableTalkScore} onChange={updateBoolean("customizableTalkScore")} />
        <CheckboxItem label="Tecoloco Integration Allowed" checked={settings.tecolocoIntegration} onChange={updateBoolean("tecolocoIntegration")} />
        <CheckboxItem label="CSV Update" checked={settings.csvUpdate} onChange={updateBoolean("csvUpdate")} />
        <CheckboxItem label="Allow Limited Managers to Self-Assign Leads" checked={settings.allowLimitedManagersSelfAssign} onChange={updateBoolean("allowLimitedManagersSelfAssign")} />
        <CheckboxItem label="Recognition, Extraction, Validation" checked={settings.recognitionExtractionValidation} onChange={updateBoolean("recognitionExtractionValidation")} />
        <CheckboxItem label="Landing Page Real-time Feedback" checked={settings.landingPageRealtimeFeedback} onChange={updateBoolean("landingPageRealtimeFeedback")} />
        <CheckboxItem label="Document Processing Mistral Recognition" checked={settings.documentProcessingMistral} onChange={updateBoolean("documentProcessingMistral")} />
        <CheckboxItem label="Autoflow Sets" checked={settings.autoflowSets} onChange={updateBoolean("autoflowSets")} />
        <CheckboxItem label="Mandatory Email and Phone Number" checked={settings.mandatoryEmailAndPhone} onChange={updateBoolean("mandatoryEmailAndPhone")} />
        <CheckboxItem label="Template Campaigns" checked={settings.templateCampaigns} onChange={updateBoolean("templateCampaigns")} />
        <CheckboxItem label="TalkScore Reading Detection" checked={settings.talkScoreReadingDetection} onChange={updateBoolean("talkScoreReadingDetection")} />
        <CheckboxItem label="Override Unsubscribe Command for Chatbots" checked={settings.overrideUnsubscribeCommand} onChange={updateBoolean("overrideUnsubscribeCommand")} />
        <CheckboxItem label="Enable Automatic GTM Insertion for Auto-Created Campaigns" checked={settings.enableAutomaticGtmInsertion} onChange={updateBoolean("enableAutomaticGtmInsertion")} />
        <CheckboxItem label="Email Preference Management" checked={settings.emailPreferenceManagement} onChange={updateBoolean("emailPreferenceManagement")} />
      </div>

      {/* INTEGRATION / CREDENTIALS */}
      <SectionDivider title="Integration / Credentials" />
      <div className="rounded-lg border overflow-hidden mb-6">
        <TextField
          label="Google Tag Manager Container ID"
          value={settings.googleTagManagerContainerId}
          onChange={updateString("googleTagManagerContainerId")}
          placeholder="e.g. GTM-XXXXXXX"
        />
        <TextField
          label="Tecoloco Username"
          value={settings.tecolocoUsername}
          onChange={updateString("tecolocoUsername")}
        />
        <TextField
          label="Tecoloco Password"
          value={settings.tecolocoPassword}
          onChange={updateString("tecolocoPassword")}
          type="password"
        />
        <TextField
          label="Eleven Labs Webhook Secret"
          value={settings.elevenLabsWebhookSecret}
          onChange={updateString("elevenLabsWebhookSecret")}
          type="password"
        />
        <TextField
          label="AI Bot OpenAI Key"
          value={settings.aiBotOpenAiKey}
          onChange={updateString("aiBotOpenAiKey")}
          type="password"
        />
        <TextField
          label="Cookiebot Script"
          value={settings.cookiebotScript}
          onChange={updateString("cookiebotScript")}
          placeholder="Paste Cookiebot script or ID"
        />
      </div>

      {/* NETWORK / SECURITY */}
      <SectionDivider title="Network / Security" />
      <div className="rounded-lg border overflow-hidden mb-6">
        <TextField
          label="Account Domain Whitelist"
          value={settings.accountDomainWhitelist}
          onChange={updateString("accountDomainWhitelist")}
          placeholder="Comma-separated domains (empty = allow all)"
        />
        <TextField
          label="IP Whitelist"
          value={settings.ipWhitelist}
          onChange={updateString("ipWhitelist")}
          placeholder="Comma-separated IPs (empty = allow all)"
        />
      </div>

      {/* EMPLOYEE REFERRAL PROGRAM (ERP) */}
      <SectionDivider title="Employee Referral Program (ERP)" />
      <div className="rounded-lg border overflow-hidden mb-6">
        <CheckboxItem
          label="ERP Link Generation"
          checked={settings.erpLinkGeneration}
          onChange={updateBoolean("erpLinkGeneration")}
        />
        <TextField
          label="ERP Allowed Email Domains"
          value={settings.erpAllowedEmailDomains}
          onChange={updateString("erpAllowedEmailDomains")}
          placeholder="e.g. company.com, subsidiary.com"
        />
        <RadioField
          label="ERP Attribution Logic"
          value={settings.erpAttributionLogic}
          onChange={updateString("erpAttributionLogic")}
          options={[
            { label: "First Touch", value: "first-touch" },
            { label: "Last Touch", value: "last-touch" },
          ]}
        />
        <CheckboxItem
          label="Enable Custom Fields"
          checked={settings.enableCustomFields}
          onChange={updateBoolean("enableCustomFields")}
        />
        <CheckboxItem
          label="Enable On-Screen Link"
          checked={settings.enableOnScreenLink}
          onChange={updateBoolean("enableOnScreenLink")}
        />
        <CheckboxItem
          label="Require Email Field"
          checked={settings.requireEmailField}
          onChange={updateBoolean("requireEmailField")}
        />
        <CheckboxItem
          label="Require Employee ID Field"
          checked={settings.requireEmployeeIdField}
          onChange={updateBoolean("requireEmployeeIdField")}
          disabled={!settings.enableCustomFields}
          indent
        />
        <CheckboxItem
          label="Enable Sending Link to Email"
          checked={settings.enableSendingLinkToEmail}
          onChange={updateBoolean("enableSendingLinkToEmail")}
        />
        <FileField
          label="ERP Email Company Logo"
          value={settings.erpEmailCompanyLogo}
          onChange={updateString("erpEmailCompanyLogo")}
        />
      </div>

      {/* BUSINESS HOURS */}
      <SectionDivider title="Business Hours" />
      <p className="text-sm text-gray-500 mb-3">
        Set the window time for sending automated messages. Enable each day and configure the allowed hours.
      </p>
      <div className="mb-6">
        <BusinessHoursEditor
          hours={settings.businessHours}
          onChange={(hours) => update("businessHours", hours)}
        />
      </div>

      <SectionFooter />
    </div>
  );
}
