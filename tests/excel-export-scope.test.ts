import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { generateExcel, EmptyPageExportError } from "../src/lib/excel-export";
import { canExportTab, resolveExportTab, sheetNamesForTab, fileNamePart } from "../src/lib/export-scope";
import { TAB_CONFIG, type TabConfig } from "../src/lib/tab-config";
import type { ChecklistData } from "../src/lib/types";

/** A checklist with a little data in every exportable tab. Only what the export reads is filled in. */
function checklist(over: Record<string, unknown> = {}): ChecklistData {
  return {
    clientName: "Acme & Co",
    enabledTabs: null,
    tabOrder: null,
    tabFilledBy: null,
    companyInfo: { allowDuplicates: "Yes", coolingPeriod: "30", rehiresAllowed: "No" },
    users: [{ name: "Ana Reyes", accessType: "Owner", email: "ana@acme.test" }],
    campaigns: [{ nameInternal: "CS Manila", assignedRecruiters: ["Rhea", "Paolo"] }],
    sites: [
      { siteName: "Makati HQ", internalName: "MKT", interviewType: "Onsite", fullAddress: "1 Ayala Ave" },
      { siteName: "Cebu IT Park", internalName: "CEB", interviewType: "Virtual", fullAddress: "2 Lahug" },
    ],
    prescreening: [{ question: "Can you work nights?", questionType: "Text" }],
    messaging: [{ name: "Welcome", emailSubject: "Hi", emailTemplate: "Body" }],
    sources: [{ category: "Job boards", subcategory: "JobStreet", link: "https://x.test" }],
    folders: [{ folderName: "Interview", description: "Scheduled" }],
    documents: [{ documentName: "NBI Clearance", required: "Yes" }],
    attributes: [{ attributeName: "Shift", key: "shift", dataType: "Text" }],
    aiCallFaqs: { agentName: "Maya", faqs: [{ faq: "Pay?", example: "Salary", faqResponse: "Competitive" }] },
    agencyPortal: [{ agencyName: "Hire Co", contactName: "Lee" }],
    agencyPortalUsers: [{ name: "Lee", email: "lee@hire.test", agency: "Hire Co", userAccess: "Admin" }],
    autoflows: [{ id: "1", group: "G", triggerType: "Folder Entry", triggerSource: "New", condition: "", action: "Move", targetFolder: "Interview", timing: "Now", messageTemplate: "", rejectionReason: "", notes: "" }],
    integrations: [],
    tabUploadMeta: {
      sites: { isSkipped: true, uploadedFiles: [{ fileName: "sites.csv", fileUrl: "https://files.test/sites.csv" }] },
      users: { isSkipped: false, uploadedFiles: [{ fileName: "users.csv", fileUrl: "https://files.test/users.csv" }] },
    },
    customTabs: null,
    customData: null,
    ...over,
  } as unknown as ChecklistData;
}

const tab = (slug: string): TabConfig => {
  const t = TAB_CONFIG.find((x) => x.slug === slug);
  assert.ok(t, `no tab ${slug}`);
  return t;
};

async function load(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return wb;
}

/** Every cell of a sheet as plain text, so two sheets can be compared. */
function dump(ws: ExcelJS.Worksheet): string[][] {
  const out: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (c) => {
      const v = c.value as unknown;
      cells.push(v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
    });
    out.push(cells);
  });
  return out;
}

test("no tab given: the whole checklist, same sheets as before", async () => {
  const wb = await load(await generateExcel(checklist()));
  const names = wb.worksheets.map((w) => w.name);
  for (const n of ["Welcome", "Company Information", "User List", "Sites", "Attributes", "Autoflows", "Tab File Uploads"]) {
    assert.ok(names.includes(n), `full export lost sheet ${n}`);
  }
});

test("this page only: Sites is the Sites sheet plus its own upload note, nothing else", async () => {
  const wb = await load(await generateExcel(checklist(), tab("sites")));
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Sites", "Tab File Uploads"]);
  const text = JSON.stringify(dump(wb.getWorksheet("Sites")!));
  assert.ok(text.includes("Makati HQ") && text.includes("Cebu IT Park"));
  const uploads = dump(wb.getWorksheet("Tab File Uploads")!);
  assert.equal(uploads.length, 2, "header plus one row");
  assert.ok(JSON.stringify(uploads).includes("sites.csv"));
  assert.ok(!JSON.stringify(uploads).includes("users.csv"), "another tab's upload leaked in");
});

test("this page only: a tab with no uploads gets no upload sheet", async () => {
  const wb = await load(await generateExcel(checklist(), tab("folders")));
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Folders"]);
});

test("data integrity: for every exportable tab, the one-page sheet matches the same sheet in the full export", async () => {
  const data = checklist();
  const full = await load(await generateExcel(data));
  const slugs = TAB_CONFIG.map((t) => t.slug).filter((s) => canExportTab(s));
  assert.ok(slugs.length >= 14);
  for (const slug of slugs) {
    const one = await load(await generateExcel(data, tab(slug)));
    const wanted = new Set(sheetNamesForTab(slug));
    const kept = one.worksheets.map((w) => w.name).filter((n) => n !== "Tab File Uploads");
    assert.ok(kept.length > 0, `${slug}: no sheet`);
    for (const name of kept) {
      assert.ok(wanted.has(name), `${slug}: unexpected sheet ${name}`);
      assert.deepEqual(dump(one.getWorksheet(name)!), dump(full.getWorksheet(name)!), `${slug}/${name}: differs from the full export`);
    }
  }
});

test("size: the one-page file drops the template logos, the full file keeps them", async () => {
  const full = await generateExcel(checklist());
  const one = await generateExcel(checklist(), tab("sites"));
  const hasMedia = async (b: Buffer) => {
    const wb = await load(b);
    return ((wb as unknown as { media: unknown[] }).media ?? []).length > 0;
  };
  assert.equal(await hasMedia(full), true, "full export lost the template's logos");
  assert.equal(await hasMedia(one), false);
  assert.ok(one.length < full.length / 2, `one page (${one.length} B) should be far smaller than the full file (${full.length} B)`);
});

test("AI Call brings its settings sheet along", async () => {
  const wb = await load(await generateExcel(checklist(), tab("ai-call-faqs")));
  assert.deepEqual(wb.worksheets.map((w) => w.name).sort(), ["AI Call FAQs", "AI Call Settings"]);
});

test("the one-page file opens cleanly: first sheet active, only one sheet selected", async () => {
  const wb = await load(await generateExcel(checklist(), tab("ai-call-faqs")));
  assert.equal(wb.views?.[0]?.activeTab ?? 0, 0);
  const selected = wb.worksheets.filter((w) => (w.views ?? []).some((v) => (v as { tabSelected?: boolean }).tabSelected));
  assert.ok(selected.length <= 1, "several sheets selected: Excel would group them");
  assert.ok(wb.worksheets.every((w) => w.state === "visible"));
});

test("custom tab: only its own sheet; other custom tabs are left out", async () => {
  const customTabs = [
    { id: "a", slug: "vendors", label: "Vendors", icon: "x", fields: [], mode: "table", columns: [{ key: "n", label: "Name", type: "text" }], rows: [{ n: "Acme" }], sortOrder: 1 },
    { id: "b", slug: "secrets", label: "Other tab", icon: "x", fields: [], mode: "table", columns: [{ key: "n", label: "Name", type: "text" }], rows: [{ n: "Do not leak" }], sortOrder: 2 },
  ];
  const wb = await load(await generateExcel(checklist({ customTabs }), { slug: "custom-vendors", label: "Vendors", dataKey: null, icon: "x", filledBy: "client", customTabId: "a" }));
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Vendors"]);
  assert.ok(!JSON.stringify(dump(wb.getWorksheet("Vendors")!)).includes("Do not leak"));
});

test("custom tab named like a standard sheet never drags that standard sheet in", async () => {
  const customTabs = [{ id: "a", slug: "ai-call", label: "AI Call", icon: "x", fields: [], mode: "table", columns: [{ key: "n", label: "Name", type: "text" }], rows: [{ n: "mine" }] }];
  const wb = await load(await generateExcel(checklist({ customTabs }), tab("ai-call-faqs")));
  assert.ok(!JSON.stringify(wb.worksheets.map((w) => dump(w))).includes("mine"), "custom tab data leaked into the AI Call page");
});

test("custom tab with nothing to export says so instead of writing an empty workbook", async () => {
  const customTabs = [{ id: "a", slug: "blank", label: "Blank", icon: "x", fields: [], mode: "table", columns: [], rows: [] }];
  await assert.rejects(
    generateExcel(checklist({ customTabs }), { slug: "custom-blank", label: "Blank", dataKey: null, icon: "x", filledBy: "client", customTabId: "a" }),
    EmptyPageExportError
  );
});

test("long or odd custom tab names still export (sheet name is shortened by the full export's own rule)", async () => {
  const label = "Vendors / Suppliers: the very long list of everyone we pay";
  const customTabs = [{ id: "a", slug: "v", label, icon: "x", fields: [], mode: "table", columns: [{ key: "n", label: "Name", type: "text" }], rows: [{ n: "Acme" }] }];
  const wb = await load(await generateExcel(checklist({ customTabs }), { slug: "custom-v", label, dataKey: null, icon: "x", filledBy: "client", customTabId: "a" }));
  assert.equal(wb.worksheets.length, 1);
  assert.ok(wb.worksheets[0].name.length <= 31);
});

test("which tabs can be exported alone", () => {
  for (const ok of ["sites", "users", "ai-call-faqs", "custom-anything"]) assert.ok(canExportTab(ok), ok);
  for (const no of ["welcome", "facebook-whatsapp", "instagram", "rejection-reasons", "labels", "admin-settings", "", null, undefined, "constructor", "__proto__", "toString"]) {
    assert.equal(canExportTab(no as string), false, String(no));
  }
});

test("access: an editor link can only ask for tabs the page shows it", () => {
  const src = { enabledTabs: ["sites", "users"], tabOrder: null, customTabs: null, tabFilledBy: null };
  assert.equal(resolveExportTab(src, "sites", "editor")?.slug, "sites");
  assert.equal(resolveExportTab(src, "folders", "editor"), null, "tab turned off for this checklist");
  assert.equal(resolveExportTab({ ...src, enabledTabs: null }, "autoflows", "editor"), null, "Talkpush-only admin tab through a public link");
  assert.equal(resolveExportTab({ ...src, enabledTabs: null }, "integrations", "editor"), null);
  assert.equal(resolveExportTab({ ...src, enabledTabs: null }, "autoflows", "staff")?.slug, "autoflows");
  assert.equal(resolveExportTab(src, "sites", "staff")?.slug, "sites");
  assert.equal(resolveExportTab(src, "welcome", "staff"), null);
});

test("access: custom tabs resolve by slug and only when they exist", () => {
  const customTabs = [{ id: "a", slug: "vendors", label: "Vendors", icon: "x", fields: [] }];
  const src = { enabledTabs: null, tabOrder: null, customTabs, tabFilledBy: null };
  assert.equal(resolveExportTab(src, "custom-vendors", "editor")?.customTabId, "a");
  assert.equal(resolveExportTab(src, "custom-nope", "editor"), null);
});

test("file names: only letters, digits and underscores", () => {
  assert.equal(fileNamePart("Pre-Screening Questions"), "Pre_Screening_Questions");
  assert.equal(fileNamePart(' "x"; filename=evil '), "x_filename_evil");
});
