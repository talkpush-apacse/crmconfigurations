import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomTabFormDataPatch,
  getCustomTabFormValues,
  getCustomTabMode,
  normalizeColumns,
  normalizeFields,
  normalizeValidationGroups,
  summarizeTab,
  validateCustomFormValues,
  validateCustomTabsData,
} from "../src/lib/custom-tab-service";
import { scanChecklistForAttachments } from "../src/lib/mcp/attachments";
import type { CustomTab } from "../src/lib/types";

function makeId() {
  let i = 0;
  return () => `id_${++i}`;
}

function makeRequirementsTab(): CustomTab {
  const { fields } = normalizeFields(
    [
      {
        key: "referral_policy",
        label: "Referral Policy",
        type: "file",
        helpText: "Upload your employee referral policy, or paste a link to it if it's hosted internally.",
        allowedExtensions: ["pdf", "doc", "docx"],
        allowedMimeTypes: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      },
      {
        key: "referral_policy_link",
        label: "Referral Policy Link",
        type: "url",
        helpText: "Upload your employee referral policy, or paste a link to it if it's hosted internally.",
      },
      {
        key: "re_referral_window_days",
        label: "Re-referral Window (days)",
        type: "number",
        required: true,
        min: 1,
        integerOnly: true,
        helpText: "The portal default is 90 days.",
      },
      {
        key: "folder_that_confirms_a_hire",
        label: "Folder That Confirms a Hire",
        type: "select",
        required: true,
        options: ["Hired", "Expected at Site", "Other"],
      },
      {
        key: "other_folder_name",
        label: "Other Folder Name",
        type: "text",
        visibleWhen: { fieldKey: "folder_that_confirms_a_hire", operator: "equals", value: "Other" },
        requiredWhen: { fieldKey: "folder_that_confirms_a_hire", operator: "equals", value: "Other" },
      },
      {
        key: "portal_admins",
        label: "Portal Admins",
        type: "repeater",
        required: true,
        minRows: 1,
        columns: [
          { key: "full_name", label: "Full Name", type: "text", required: true },
          { key: "email_address", label: "Email Address", type: "email", required: true },
        ],
      },
    ],
    { makeId: makeId() }
  );
  const validationGroups = normalizeValidationGroups(
    [
      {
        id: "referral_policy_requirement",
        type: "at_least_one",
        fieldKeys: ["referral_policy", "referral_policy_link"],
        message: "Upload your employee referral policy, or paste a link to it if it's hosted internally.",
      },
    ],
    fields
  );
  return {
    id: "ct_referral",
    slug: "referral-portal-phase-one-requirements",
    label: "Referral Portal Phase One Requirements",
    description: "Please provide the items below by October 2, 2026 so we can start configuring your Referral Portal on October 5.",
    mode: "form",
    icon: "FileText",
    fields,
    validationGroups,
  };
}

test("form schema preserves V1 field metadata and validation group readback", () => {
  const tab = makeRequirementsTab();
  const numberField = tab.fields.find((field) => field.key === "re_referral_window_days");
  assert.equal(getCustomTabMode(tab), "form");
  assert.equal(numberField?.helpText, "The portal default is 90 days.");
  assert.equal(numberField?.min, 1);
  assert.equal(numberField?.integerOnly, true);
  assert.deepEqual(
    tab.fields.find((field) => field.key === "folder_that_confirms_a_hire")?.options,
    ["Hired", "Expected at Site", "Other"]
  );
  assert.equal(tab.validationGroups?.[0].fieldKeys[1], "referral_policy_link");
});

test("number, select, condition, repeater, and validation-group rules are enforced", () => {
  const tab = makeRequirementsTab();

  let result = validateCustomFormValues(tab, {
    re_referral_window_days: 0,
    folder_that_confirms_a_hire: "Other",
    portal_admins: [],
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.re_referral_window_days.join(" "), /at least 1/);
  assert.match(result.errors.other_folder_name.join(" "), /required/);
  assert.match(result.errors.portal_admins.join(" "), /at least 1/);
  assert.match(result.errors["validationGroup:referral_policy_requirement"].join(" "), /Upload your employee referral policy/);

  result = validateCustomFormValues(tab, {
    referral_policy_link: "https://example.com/policy",
    re_referral_window_days: 1.5,
    folder_that_confirms_a_hire: "Hired",
    portal_admins: [{ full_name: "Jane Doe", email_address: "not-an-email" }],
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.re_referral_window_days.join(" "), /whole number/);
  assert.match(result.errors.portal_admins.join(" "), /valid email/);
  assert.equal(result.errors.other_folder_name, undefined);

  result = validateCustomFormValues(tab, {
    referral_policy_link: "https://example.com/policy",
    re_referral_window_days: 90,
    folder_that_confirms_a_hire: "Hired",
    portal_admins: [
      { full_name: "Jane Doe", email_address: "jane@example.com" },
      { full_name: "John Smith", email_address: "john@example.com" },
    ],
  });
  assert.equal(result.valid, true);
});

test("file metadata validation rejects unsupported extension, MIME type, size, and multiple files", () => {
  const tab = makeRequirementsTab();
  const result = validateCustomFormValues(tab, {
    referral_policy: [
      {
        fileName: "policy.exe",
        mimeType: "application/x-msdownload",
        size: 12 * 1024 * 1024,
        url: "https://example.supabase.co/storage/v1/object/public/checklist-files/policy.exe",
        uploadedAt: "2026-09-29T00:00:00.000Z",
      },
      {
        fileName: "policy.pdf",
        mimeType: "application/pdf",
        size: 100,
        url: "https://example.supabase.co/storage/v1/object/public/checklist-files/policy.pdf",
        uploadedAt: "2026-09-29T00:00:00.000Z",
      },
    ],
    referral_policy_link: "",
    re_referral_window_days: 90,
    folder_that_confirms_a_hire: "Hired",
    portal_admins: [{ full_name: "Jane Doe", email_address: "jane@example.com" }],
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.referral_policy.join(" "), /only one file/);
  assert.match(result.errors.referral_policy.join(" "), /executable/);
  assert.match(result.errors.referral_policy.join(" "), /extensions/);
});

test("customData stores form responses separately under tab id and attachment scanner can retrieve file fields", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  const tab = makeRequirementsTab();
  const values = {
    referral_policy: {
      fileName: "policy.pdf",
      mimeType: "application/pdf",
      size: 1234,
      url: "https://example.supabase.co/storage/v1/object/public/checklist-files/custom-form/policy.pdf",
      uploadedAt: "2026-09-29T00:00:00.000Z",
    },
    re_referral_window_days: 90,
  };
  const customData = buildCustomTabFormDataPatch(tab, values);
  assert.deepEqual(getCustomTabFormValues(tab, customData).referral_policy, values.referral_policy);

  const attachments = scanChecklistForAttachments({
    customTabs: [tab],
    customData,
  });
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].tab, "custom-referral-portal-phase-one-requirements");
  assert.equal(attachments[0].fieldPath, "customTabs.ct_referral.referral_policy");
  assert.equal(attachments[0].fileName, "policy.pdf");
});

test("legacy table tabs still infer table mode and retain rows", () => {
  const { columns } = normalizeColumns([
    { key: "setting", label: "Setting", type: "text", required: true },
    { key: "approved", label: "Approved", type: "checkbox" },
  ]);
  const tab: CustomTab = {
    id: "ct_table",
    slug: "legacy-table",
    label: "Legacy Table",
    icon: "Table",
    fields: [],
    columns,
    rows: [{ id: "row_1", setting: "Allowed domain", approved: true }],
  };
  assert.equal(getCustomTabMode(tab), "table");
  assert.equal(tab.rows?.[0].setting, "Allowed domain");
});

test("applied template source is included in custom tab readback", () => {
  const tab = makeRequirementsTab();
  tab.templateSource = { templateId: "tpl_referral_portal", version: 3 };
  const summary = summarizeTab(tab, {
    [tab.id]: {
      values: {
        referral_policy_link: "https://example.com/policy",
      },
    },
  });

  assert.deepEqual(summary.templateSource, { templateId: "tpl_referral_portal", version: 3 });
  assert.equal(
    summary.fields?.find((field) => field.key === "referral_policy_link")?.value,
    "https://example.com/policy"
  );
});

test("partial server validation allows incomplete required fields but rejects malformed entered values", () => {
  const tab = makeRequirementsTab();
  const errors = validateCustomTabsData([tab], {
    [tab.id]: {
      values: {
        referral_policy_link: "not-a-url",
        re_referral_window_days: "",
      },
    },
  }, {
    enforceRequired: false,
    enforceValidationGroups: false,
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /URL/);
});
