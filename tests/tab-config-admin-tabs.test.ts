import test from "node:test";
import assert from "node:assert/strict";
import {
  getAllSelectableTabSlugs,
  getEnabledTabs,
  excludeTalkpushTabs,
} from "../src/lib/tab-config";

const ADMIN_TABS = ["admin-settings", "autoflows", "integrations"];

test("admin-only tabs are selectable and on by default", () => {
  const selectable = getAllSelectableTabSlugs();
  for (const slug of ADMIN_TABS) assert.ok(selectable.includes(slug), slug);
});

test("a null tab list still shows everything to admins", () => {
  const slugs = getEnabledTabs(null, true).map((t) => t.slug);
  for (const slug of ADMIN_TABS) assert.ok(slugs.includes(slug), slug);
});

test("admins only see admin-only tabs that are switched on", () => {
  const slugs = getEnabledTabs(["welcome", "autoflows"], true).map((t) => t.slug);
  assert.deepEqual(slugs, ["welcome", "autoflows"]);
});

test("switching an admin-only tab off hides it from admins", () => {
  const all = getAllSelectableTabSlugs().filter((s) => s !== "integrations");
  const slugs = getEnabledTabs(all, true).map((t) => t.slug);
  assert.ok(!slugs.includes("integrations"));
  assert.ok(slugs.includes("admin-settings") && slugs.includes("autoflows"));
});

test("non-admins and clients never see admin-only tabs, even when on", () => {
  const all = getAllSelectableTabSlugs();
  const nonAdmin = getEnabledTabs(all, false).map((t) => t.slug);
  const client = excludeTalkpushTabs(getEnabledTabs(all, false)).map((t) => t.slug);
  for (const slug of ADMIN_TABS) {
    assert.ok(!nonAdmin.includes(slug), `non-admin ${slug}`);
    assert.ok(!client.includes(slug), `client ${slug}`);
  }
});
