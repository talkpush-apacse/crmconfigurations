import test from "node:test";
import assert from "node:assert/strict";
import { buildConfigPlan } from "../src/lib/config-plan/build";
import { readChecklist, type ChecklistInput } from "../src/lib/config-plan/from-checklist";
import { readWorkflow } from "../src/lib/config-plan/from-workflow";
import { renderPlanMarkdown } from "../src/lib/config-plan/markdown";
import { looksLikeSameThing, normalizeName } from "../src/lib/config-plan/names";
import { SECTION_SPECS } from "../src/lib/config-plan/spec";
import type { ConfigPlan } from "../src/lib/config-plan/types";
import { workflowTemplates } from "../src/lib/workflow/template-data";


// Each of these stands for something that must never appear in a plan.
const SECRET_EMAIL = "secret.recruiter@example.invalid";
const SECRET_PHONE = "+63-999-SECRET";
const SECRET_AUTH = "SECRET_AUTH_VALUE_123";
const SECRET_URL = "https://secret-endpoint.example.invalid/hook?token=SECRET";
const SECRET_ADMIN = "SECRET_TELERIVET_PROJECT";

const checklist: ChecklistInput = {
  slug: "northwind",
  clientName: "Northwind",
  version: 7,
  folders: [
    { id: "f1", folderName: "New" },
    { id: "f2", folderName: "Interview Scheduled" },
    { id: "f3", folderName: "Rejected" },
    { id: "f4", folderName: "Final Interview" },
    { id: "f5", folderName: "Deleted folder", deletedAt: "2026-10-01T00:00:00Z" },
  ],
  messaging: [
    { id: "m1", name: "Interview invite", emailActive: true, smsActive: true, language: "English" },
    { id: "m2", name: "Rejection SMS", smsActive: true },
    { id: "m3", name: "Contract email", emailActive: true, notApplicable: true },
    { id: "m4", name: "Welcome" },
  ],
  attributes: [{ id: "a1", attributeName: "1 - Has BPO Experience", key: "has_bpo_experience", dataType: "Text" }],
  labels: [{ id: "l1", name: "Hot lead", color: "red" }],
  documents: [{ id: "d1", documentName: "Government ID", required: "Yes" }],
  prescreening: [{ id: "q1", category: "Basics", question: "Are you 18 or older?", questionType: "Multiple Choice" }],
  autoflows: [
    { id: "r1", group: "P1 - Screening", triggerType: "Folder Entry", triggerSource: "New", action: "Move Candidate", targetFolder: "Interview Scheduled", timing: "Immediately", messageTemplate: "Interview invite" },
    { id: "r2", group: "P1 - Screening", triggerType: "Folder Entry", triggerSource: "Rejected", action: "Send SMS", targetFolder: "", timing: "1 hour", messageTemplate: "Rejection SMS" },
    { id: "r3", group: "P2 - Booking", triggerType: "Folder Entry", triggerSource: "Missing Folder", action: "Send Email", targetFolder: "Nowhere", messageTemplate: "Ghost template" },
  ],
  campaigns: [{ id: "c1", nameInternal: "Manila - Messenger Evergreen", site: "Manila", assignedRecruiters: [SECRET_EMAIL] }],
  sites: [{ id: "s1", siteName: "Manila", interviewType: "Onsite" }],
  users: [{ id: "u1", name: "Ana Reyes", accessType: "Recruiter", email: SECRET_EMAIL, phone: SECRET_PHONE }],
  sources: [{ id: "so1", category: "Job boards", subcategory: "Jobstreet" }],
  rejectionReasons: ["Not qualified", "Under age"],
  integrations: [
    { id: "i1", vendorName: "Workday", vendorCategory: "hris_ats", actionType: "push", endpointUrl: SECRET_URL, authValue: SECRET_AUTH, inboundAuthValue: SECRET_AUTH },
  ],
  atsIntegrations: [{ id: "ats1", name: "Greenhouse", system: "Greenhouse", direction: "inbound", sandboxBaseUrl: SECRET_URL, authRequirements: [{ value: SECRET_AUTH }] }],
  aiCallFaqs: { agentName: "Maya", callType: "Screening" },
  fbWhatsapp: { chatbotName: "Northwind Bot", phoneNumber: SECRET_PHONE },
  companyInfo: { allowDuplicates: "No", coolingPeriod: "30 days", businessHours: [{ day: "Monday", isOpen: true }, { day: "Sunday", isOpen: false }], companyName: "Northwind" },
  communicationChannels: { email: true, sms: true, messenger: false },
  // Not part of the input type, and never read: a plan must not be able to carry it.
  ...({ adminSettings: { telerivetProjectId: SECRET_ADMIN } } as object),
};

type N = { id: string; type: string; data: Record<string, unknown> };
const node = (id: string, type: string, label: string, meta: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): N => ({
  id,
  type,
  data: { label, type, actor: "automated", actorLabel: "Autoflow", notes: "", feasibility: "confirmed", data: meta, ...extra },
});
const edge = (a: string, b: string) => ({ id: `${a}-${b}`, source: a, target: b, data: {} });

const nodes: N[] = [
  node("n0", "source", "Candidate applies"),
  node("n1", "communication", "Send Screening Chatbot", { channel: "messenger", messageTemplate: "Screening question set", talkpushAction: "send_question_set" }),
  node("n2", "communication", "Invite to Interview", { channel: "email", messageTemplate: "Interview Invite" }),
  node("n3", "stage", "Interview Scheduled", { targetFolder: "Interview Scheduled" }),
  node("n4", "stage", "Final Interviews"), // no field: read from the title
  node("n5", "stage", "Hired", { targetFolder: "Hired" }),
  node("n6", "manual_action", "Move to Rejected folder", {}, { actionType: "move" }),
  node("n7", "communication", "Send reminder"), // a message with no template name
  node("n8", "note", "Reason: Not qualified", {}, { noteKind: "rejection" }),
  node("n9", "note", "Reason: Too far", {}, { noteKind: "rejection" }),
  node("n10", "integration", "Push to HRIS", { integrationSystem: "Workday", integrationDirection: "push" }),
  node("n11", "integration", "Send to somewhere"), // no system named
  node("n12", "process", "Tag as hot", { talkpushAction: "assign_labels" }),
  node("n13", "manual_action", "Move candidate", {}, { actionType: "move" }), // no folder named
  node("n14", "process", "Start campaign", { campaignType: "Job Application" }),
  node("n15", "terminator", "Hired"),
];
const edges = nodes.slice(0, -1).map((n, i) => edge(n.id, nodes[i + 1].id));
const workflow = { pages: [{ id: "p1", name: "Main", nodes, edges }] };

function plan(opts: { withWorkflow?: boolean } = {}): ConfigPlan {
  const wf = opts.withWorkflow === false ? null : readWorkflow(workflow);
  return buildConfigPlan({
    checklist: readChecklist(checklist),
    workflow: wf,
    meta: {
      client: "Northwind",
      checklist: { slug: "northwind", clientName: "Northwind", version: 7 },
      workflow: wf ? { id: "w1", name: "Hiring", version: "published", stepCount: wf.stepCount } : null,
    },
  });
}
const section = (p: ConfigPlan, key: string) => p.sections.find((s) => s.key === key)!;
const names = (p: ConfigPlan, key: string, source?: string) => section(p, key).entries.filter((e) => !source || e.source === source).map((e) => e.name).sort();

// ---------------------------------------------------------------- names

test("names match after tidying case, punctuation and spacing; close names are only suggestions", () => {
  assert.equal(normalizeName("  Interview   Scheduled! "), normalizeName("interview scheduled"));
  assert.equal(normalizeName("Q&A"), "q and a");
  assert.equal(looksLikeSameThing("final interview", "final interviews"), true);
  assert.equal(looksLikeSameThing("interview scheduled", "hired"), false);
  assert.equal(looksLikeSameThing("same", "same"), false, "identical names are matched, not suggested");
});

// ---------------------------------------------------------------- reading the checklist

test("deleted rows and templates marked not applicable are left out", () => {
  const p = plan();
  assert.ok(!names(p, "folders").includes("Deleted folder"));
  assert.ok(!names(p, "message_templates").includes("Contract email"));
  assert.ok(names(p, "message_templates").includes("Welcome"));
});

test("a plan never carries emails, phone numbers, endpoints, credentials or admin settings", () => {
  for (const withWorkflow of [true, false]) {
    const p = plan({ withWorkflow });
    const text = JSON.stringify(p) + renderPlanMarkdown(p);
    for (const secret of [SECRET_EMAIL, SECRET_PHONE, SECRET_AUTH, SECRET_URL, SECRET_ADMIN, "secret-endpoint"]) {
      assert.ok(!text.includes(secret), `a plan must not contain ${secret}`);
    }
  }
});

test("the checklist's own cross-checks flag folders and templates its autoflows use but it does not list", () => {
  const warnings = readChecklist(checklist).warnings.join(" ");
  assert.match(warnings, /Missing Folder/);
  assert.match(warnings, /Nowhere/);
  assert.match(warnings, /Ghost template/);
});

test("autoflow sets come from the group names", () => {
  assert.deepEqual(readChecklist(checklist).autoflow_sets.map((s) => s.name), ["P1 - Screening", "P2 - Booking"]);
});

// ---------------------------------------------------------------- reading the workflow

test("names in a field are marked as fields; names read from a title are marked as wording", () => {
  const found = readWorkflow(workflow);
  const hired = found.folders.find((f) => f.name === "Hired")!;
  assert.equal(hired.steps[0].basis, "field");
  const finals = found.folders.find((f) => f.name === "Final Interviews")!;
  assert.equal(finals.steps[0].basis, "wording");
  const rejected = found.folders.find((f) => f.name === "Rejected")!;
  assert.equal(rejected.steps[0].basis, "wording", "read from 'Move to Rejected folder'");
  assert.deepEqual(found.messageTemplates.map((t) => t.name), ["Interview Invite"]);
  assert.deepEqual(found.questionSets.map((t) => t.name), ["Screening question set"]);
  assert.deepEqual(found.integrations.map((t) => t.name), ["Workday"]);
  assert.deepEqual(found.campaignTypes, ["Job Application"]);
  assert.deepEqual(found.rejectionReasons.map((r) => r.name).sort(), ["Not qualified", "Too far"]);
});

test("a step that needs something but names nothing is listed for a person, never given an invented name", () => {
  const found = readWorkflow(workflow);
  const bySection = (s: string) => found.unresolved.filter((u) => u.section === s).map((u) => u.label);
  assert.deepEqual(bySection("message_templates"), ["Send reminder"]);
  assert.deepEqual(bySection("integrations"), ["Send to somewhere"]);
  assert.deepEqual(bySection("labels"), ["Tag as hot"]);
  assert.deepEqual(bySection("folders"), ["Move candidate"]);
  for (const list of [found.folders, found.messageTemplates, found.integrations]) {
    assert.ok(!list.some((f) => /^(send reminder|send to somewhere|move candidate|tag as hot)$/i.test(f.name)));
  }
});

test("a workflow with several pages is read across all pages", () => {
  const two = { pages: [{ id: "a", nodes: [node("x", "stage", "Page one", { targetFolder: "One" })], edges: [] }, { id: "b", nodes: [node("y", "stage", "Page two", { targetFolder: "Two" })], edges: [] }] };
  assert.deepEqual(readWorkflow(two).folders.map((f) => f.name).sort(), ["One", "Two"]);
});

test("an old workflow with only top-level nodes is still read", () => {
  assert.deepEqual(readWorkflow({ nodes: [node("x", "stage", "Solo", { targetFolder: "Solo" })], edges: [] }).folders.map((f) => f.name), ["Solo"]);
});

test("every workflow template in the app reads without errors and names folders", () => {
  for (const t of workflowTemplates) {
    const found = readWorkflow({ nodes: t.nodes, edges: t.edges });
    assert.ok(found.stepCount > 0, `${t.name} has steps`);
    assert.ok(found.folders.length > 0, `${t.name} names at least one folder`);
  }
});

// ---------------------------------------------------------------- the plan

test("names that match go in one entry from both; the rest show where they came from", () => {
  const p = plan();
  assert.deepEqual(names(p, "folders", "both"), ["Interview Scheduled", "Rejected"]);
  assert.deepEqual(names(p, "folders", "checklist"), ["Final Interview", "New"]);
  assert.deepEqual(names(p, "folders", "workflow"), ["Final Interviews", "Hired"]);
  assert.deepEqual(names(p, "message_templates", "both"), ["Interview invite"], "'Interview Invite' and 'Interview invite' are the same name");
  assert.deepEqual(names(p, "rejection_reasons", "both"), ["Not qualified"]);
  assert.deepEqual(names(p, "rejection_reasons", "workflow"), ["Too far"]);
  assert.deepEqual(names(p, "integrations", "both"), ["Workday"]);
});

test("close but different names point at each other and are not merged", () => {
  const folders = section(plan(), "folders").entries;
  assert.equal(folders.find((e) => e.name === "Final Interview")!.possibleMatch, "Final Interviews");
  assert.equal(folders.find((e) => e.name === "Final Interviews")!.possibleMatch, "Final Interview");
  assert.equal(folders.find((e) => e.name === "Hired")!.possibleMatch, undefined);
});

test("the gaps both ways are listed, the way the person asked for them", () => {
  const p = plan();
  const wf = p.workflowNotInChecklist.find((g) => g.section === "folders")!;
  assert.deepEqual([...wf.names].sort(), ["Final Interviews", "Hired"]);
  const cl = p.checklistNotInWorkflow.find((g) => g.section === "folders")!;
  assert.deepEqual([...cl.names].sort(), ["Final Interview", "New"]);
});

test("each kind of object says how it gets configured, and which tools make it", () => {
  const p = plan();
  assert.equal(section(p, "folders").configure, "mcp");
  assert.deepEqual(section(p, "folders").tools, ["create_company_folder"]);
  assert.equal(section(p, "rejection_reasons").configure, "manual");
  assert.deepEqual(section(p, "rejection_reasons").tools, []);
  assert.equal(section(p, "integrations").configure, "ticket");
  for (const s of p.sections) {
    assert.equal(s.tools.length > 0, s.configure === "mcp", `${s.key}: tools are listed exactly when Claude can create it`);
  }
});

test("build order follows the CRM dependencies", () => {
  const p = plan();
  const order = Object.fromEntries(p.sections.map((s) => [s.key, s.order]));
  assert.ok(order.folders < order.autoflows);
  assert.ok(order.attributes < order.autoflows);
  assert.ok(order.message_templates < order.autoflows);
  assert.ok(order.autoflows < order.autoflow_sets);
  assert.ok(order.autoflow_sets < order.campaigns);
  assert.ok(order.campaigns < order.sources);
  const sorted = p.sections.map((s) => s.order);
  assert.deepEqual(sorted, [...sorted].sort((a, b) => a - b));
  // Every dependency is built earlier than the thing that needs it.
  for (const [key, spec] of Object.entries(SECTION_SPECS)) {
    for (const dep of spec.dependsOn) assert.ok(SECTION_SPECS[dep].order <= spec.order, `${key} needs ${dep} first`);
  }
});

test("autoflows and campaigns explain the workflow's side without pretending to match names", () => {
  const p = plan();
  assert.match(section(p, "autoflows").note ?? "", /automated steps/);
  assert.match(section(p, "campaigns").note ?? "", /Job Application/);
});

test("with no workflow the plan comes from the checklist alone and says so", () => {
  const p = plan({ withWorkflow: false });
  assert.equal(p.workflow, null);
  assert.ok(p.warnings.some((w) => /checklist alone/.test(w)));
  assert.ok(section(p, "folders").entries.every((e) => e.source === "checklist"));
  assert.deepEqual(p.workflowNotInChecklist, []);
});

test("the Markdown names every group and the things that need a decision", () => {
  const md = renderPlanMarkdown(plan());
  assert.match(md, /# Configuration plan: Northwind/);
  assert.match(md, /Claude can create these with the Talkpush CRM tools/);
  assert.match(md, /Do these by hand in the CRM/);
  assert.match(md, /Another team builds these/);
  assert.match(md, /The workflow has these but the checklist does not/);
  assert.match(md, /Possibly the same as "Final Interviews"/);
  assert.match(md, /Needs a decision/);
  assert.match(md, /name read from the step title: check it/);
  assert.match(md, /Nothing is added automatically/);
});
