/**
 * Making a new CRM Config Checklist. This is the one place that knows how a new checklist is set up, so the website's
 * "Create New Checklist" form (POST /api/checklists) and Claude's create_checklist tool cannot disagree about it.
 *
 * It is a plain move of what the website route used to do inline: the same checks in the same order, the same default
 * content for every section, the same web address built from the name. It creates no client link and sends nothing:
 * a new checklist starts private.
 */

import { prisma } from "@/lib/db";
import { findLinkableAccount } from "@/lib/accounts/company-link";
import { normalizeOwnerEmail } from "@/lib/notifications";
import { getAllSelectableTabSlugs } from "@/lib/tab-config";
import { defaultCommunicationChannels, defaultFeatureToggles, getDefaultChecklistData } from "@/lib/template-data";

export interface CreateChecklistInput {
  clientName: string;
  /** Left out by the website: the web address is built from the name. Claude's tool passes one it has already checked. */
  slug?: string;
  enabledTabs?: unknown;
  communicationChannels?: unknown;
  featureToggles?: unknown;
  isCustom?: unknown;
  customSchema?: unknown;
  customTabs?: unknown;
  ownerEmail?: unknown;
  /** The account to file it under. Anything other than undefined/null is checked: it must be an id of an account that is not archived. */
  accountId?: unknown;
}

export type CreateChecklistResult =
  | { ok: true; checklist: Awaited<ReturnType<typeof prisma.checklist.create>> }
  | { ok: false; status: 400 | 404 | 409; error: string };

/** The web address the website builds from a checklist's name: "TaskUs PH" becomes "taskus-ph". */
export function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const MAX_SLUG_LENGTH = 80;

/**
 * Whether a web address (slug) can be used for a new checklist. Returns a sentence a person can act on, or null when it is fine.
 * Uniqueness is not checked here: that needs the database.
 */
export function slugProblem(slug: string): string | null {
  const how = 'Use only lowercase letters, numbers and single hyphens, for example "taskus-ph"';
  if (!slug) return `The slug is empty. ${how}.`;
  if (slug.length > MAX_SLUG_LENGTH) return `The slug "${slug}" is ${slug.length} characters long; the limit is ${MAX_SLUG_LENGTH}. Give a shorter one.`;
  if (/[A-Z]/.test(slug)) return `The slug "${slug}" has capital letters. ${how} (try "${slugFromName(slug)}").`;
  if (/\s/.test(slug)) return `The slug "${slug}" has spaces. ${how} (try "${slugFromName(slug)}").`;
  if (/[^a-z0-9-]/.test(slug)) return `The slug "${slug}" has characters a web address cannot use. ${how} (try "${slugFromName(slug)}").`;
  if (/^-|-$/.test(slug)) return `The slug "${slug}" starts or ends with a hyphen. ${how} (try "${slugFromName(slug)}").`;
  if (/--/.test(slug)) return `The slug "${slug}" has two hyphens in a row. ${how} (try "${slugFromName(slug)}").`;
  return null;
}

/**
 * What the website's form starts with when nobody changes anything: every tab on, the default channels, the default
 * feature switches. A checklist made without choosing (by Claude) gets exactly this.
 */
export function newChecklistFormDefaults() {
  return {
    enabledTabs: getAllSelectableTabSlugs(),
    communicationChannels: defaultCommunicationChannels,
    featureToggles: defaultFeatureToggles,
  };
}

export async function createChecklist(input: CreateChecklistInput): Promise<CreateChecklistResult> {
  const { clientName, enabledTabs, communicationChannels, featureToggles, isCustom, customSchema, customTabs, ownerEmail, accountId } = input;

  if (!clientName) {
    return { ok: false, status: 400, error: "Client name is required" };
  }

  const normalizedOwnerEmail = normalizeOwnerEmail(ownerEmail);
  if (normalizedOwnerEmail.error) {
    return { ok: false, status: 400, error: normalizedOwnerEmail.error };
  }

  // Optional: file the new checklist under a company straight away.
  let linkedAccountId: string | null = null;
  if (accountId !== undefined && accountId !== null) {
    if (typeof accountId !== "string" || !accountId.trim()) {
      return { ok: false, status: 400, error: "accountId must be a company id." };
    }
    const target = await findLinkableAccount(accountId.trim());
    if (!target.ok) return { ok: false, status: target.status, error: target.error };
    linkedAccountId = target.account.id;
  }

  const slug = input.slug ?? slugFromName(clientName);

  const existing = await prisma.checklist.findUnique({ where: { slug } });
  if (existing) {
    return { ok: false, status: 409, error: "A checklist with this name already exists" };
  }

  const defaults = getDefaultChecklistData();

  // Custom checklists: no standard tabs, store custom schema
  const createData: Record<string, unknown> = {
    slug,
    clientName,
    isCustom: !!isCustom,
    ownerEmail: normalizedOwnerEmail.value,
    accountId: linkedAccountId,
  };

  if (isCustom) {
    createData.enabledTabs = JSON.parse(JSON.stringify([]));
    createData.customSchema = customSchema ? JSON.parse(JSON.stringify(customSchema)) : JSON.parse(JSON.stringify([]));
    createData.customData = JSON.parse(JSON.stringify({}));
  } else {
    createData.enabledTabs = enabledTabs ? JSON.parse(JSON.stringify(enabledTabs)) : null;
    createData.communicationChannels = communicationChannels ? JSON.parse(JSON.stringify(communicationChannels)) : null;
    createData.featureToggles = featureToggles ? JSON.parse(JSON.stringify(featureToggles)) : null;
    createData.companyInfo = JSON.parse(JSON.stringify(defaults.companyInfo));
    createData.users = JSON.parse(JSON.stringify(defaults.users));
    createData.campaigns = JSON.parse(JSON.stringify(defaults.campaigns));
    createData.sites = JSON.parse(JSON.stringify(defaults.sites));
    createData.prescreening = JSON.parse(JSON.stringify(defaults.prescreening));
    createData.messaging = JSON.parse(JSON.stringify(defaults.messaging));
    createData.sources = JSON.parse(JSON.stringify(defaults.sources));
    createData.folders = JSON.parse(JSON.stringify(defaults.folders));
    createData.documents = JSON.parse(JSON.stringify(defaults.documents));
    createData.attributes = JSON.parse(JSON.stringify(defaults.attributes));
    createData.fbWhatsapp = JSON.parse(JSON.stringify(defaults.fbWhatsapp));
    createData.instagram = JSON.parse(JSON.stringify(defaults.instagram));
    createData.aiCallFaqs = JSON.parse(JSON.stringify(defaults.aiCallFaqs));
    createData.agencyPortal = JSON.parse(JSON.stringify(defaults.agencyPortal));
    createData.labels = JSON.parse(JSON.stringify(defaults.labels));
    createData.adminSettings = JSON.parse(JSON.stringify(defaults.adminSettings));
    createData.atsIntegrations = JSON.parse(JSON.stringify(defaults.atsIntegrations));
    createData.integrations = JSON.parse(JSON.stringify(defaults.integrations));
    if (customTabs && Array.isArray(customTabs) && customTabs.length > 0) {
      createData.customTabs = JSON.parse(JSON.stringify(customTabs));
      createData.customData = JSON.parse(JSON.stringify({}));
    }
  }

  const checklist = await prisma.checklist.create({
    data: createData as Parameters<typeof prisma.checklist.create>[0]["data"],
  });

  return { ok: true, checklist };
}
