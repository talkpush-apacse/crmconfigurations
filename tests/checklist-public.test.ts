import { test } from "node:test";
import assert from "node:assert/strict";
import { omitInternalConfigForSlug, omitInternalConfigForToken } from "../src/lib/checklist-public";

// A row shaped like a real Checklist, with every kind of column a visitor must or may not see. If this and the
// stripping functions disagree, a visitor link is leaking something it should not (or hiding something a tab needs).
const row = {
  id: "c1",
  slug: "acme",
  editorToken: "secret-editor-token",
  clientName: "Acme",
  ownerEmail: "owner@example.com",
  version: 3,
  fieldVersions: { sites: 3 },
  notificationState: { sites: { pendingChanges: true } },
  accountId: "acct_internal_company_id",
  atsIntegrations: [{ vendor: "x" }],
  integrations: [{ vendor: "y" }],
  configuratorChecklist: { steps: [] },
  adminSettings: { sms: "internal" },
  companyInfo: { companyName: "Acme" },
  sites: [{ id: "s1" }],
  tabOrder: ["welcome"],
};

test("client link: never receives the editor token, owner email, internal config or bookkeeping", () => {
  const out = omitInternalConfigForSlug(row) as Record<string, unknown>;
  for (const key of ["editorToken", "ownerEmail", "notificationState", "fieldVersions", "adminSettings", "atsIntegrations", "integrations", "configuratorChecklist", "accountId"]) {
    assert.equal(key in out, false, `${key} must not reach a client link`);
  }
  assert.equal(out.slug, "acme");
  assert.deepEqual(out.sites, [{ id: "s1" }]);
  assert.equal(out.version, 3);
});

test("editor link: keeps admin settings and field versions, but never the token echo, owner email or internal config", () => {
  const out = omitInternalConfigForToken(row) as Record<string, unknown>;
  for (const key of ["editorToken", "ownerEmail", "notificationState", "atsIntegrations", "integrations", "configuratorChecklist", "accountId"]) {
    assert.equal(key in out, false, `${key} must not reach an editor link`);
  }
  assert.deepEqual(out.adminSettings, { sms: "internal" });
  assert.deepEqual(out.fieldVersions, { sites: 3 });
  assert.equal(out.clientName, "Acme");
});

test("stripping never mutates the row it is given", () => {
  const copy = JSON.parse(JSON.stringify(row));
  omitInternalConfigForSlug(row);
  omitInternalConfigForToken(row);
  assert.deepEqual(row, copy);
});
