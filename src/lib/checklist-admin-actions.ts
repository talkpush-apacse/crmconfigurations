import { getAllSelectableTabSlugs } from "@/lib/tab-config";
import { defaultCommunicationChannels, defaultFeatureToggles } from "@/lib/template-data";
import type { SettingsEditingState } from "@/components/admin/SettingsDialog";
import type { CommunicationChannels, FeatureToggles, CustomFieldDef, CustomTab } from "@/lib/types";

/**
 * The staff actions on one checklist (duplicate, settings, new editor link, delete), shared by the
 * main checklist list and the company page so both menus do exactly the same thing.
 * Each one throws an Error with a plain-language message when the server says no.
 */

/** What the settings dialog edits, plus the checklist version the server checks on save. */
export type ChecklistSettingsDraft = SettingsEditingState & { version: number };

/** The fields of a checklist the settings dialog needs. */
export interface ChecklistSettingsSource {
  id: string;
  clientName: string;
  ownerEmail: string | null;
  enabledTabs: string[] | null;
  communicationChannels: CommunicationChannels | null;
  featureToggles: FeatureToggles | null;
  version: number;
  isCustom?: boolean;
  customSchema?: CustomFieldDef[] | null;
  customTabs?: CustomTab[] | null;
}

async function failureMessage(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({}));
  return (err as { error?: string }).error || fallback;
}

export function toSettingsDraft(c: ChecklistSettingsSource): ChecklistSettingsDraft {
  return {
    id: c.id,
    clientName: c.clientName,
    ownerEmail: c.ownerEmail ?? "",
    tabs: c.enabledTabs || getAllSelectableTabSlugs(),
    channels: c.communicationChannels || defaultCommunicationChannels,
    featureToggles: c.featureToggles || defaultFeatureToggles,
    version: c.version,
    isCustom: !!c.isCustom,
    customSchema: c.customSchema || [],
    customTabs: c.customTabs || [],
  };
}

/** Turning the AI-call channel on or off also adds or drops its FAQ tab, and the other way round. */
export function withChannelsChanged(prev: ChecklistSettingsDraft, channels: CommunicationChannels): ChecklistSettingsDraft {
  let tabs = [...prev.tabs];
  if (channels.aiCalls && !tabs.includes("ai-call-faqs")) tabs = [...tabs, "ai-call-faqs"];
  else if (!channels.aiCalls && tabs.includes("ai-call-faqs")) tabs = tabs.filter((t) => t !== "ai-call-faqs");
  return { ...prev, channels, tabs };
}

export function withTabsChanged(prev: ChecklistSettingsDraft, tabs: string[]): ChecklistSettingsDraft {
  const aiTabEnabled = tabs.includes("ai-call-faqs");
  const channels = aiTabEnabled !== prev.channels.aiCalls ? { ...prev.channels, aiCalls: aiTabEnabled } : prev.channels;
  return { ...prev, tabs, channels };
}

/** Save the settings dialog. Throws when the checklist changed under you (the server checks the version). */
export async function saveChecklistSettings(editing: ChecklistSettingsDraft): Promise<void> {
  const body: Record<string, unknown> = {
    version: editing.version,
    ownerEmail: editing.ownerEmail.trim() || null,
    changedFields: editing.isCustom ? ["customSchema"] : ["enabledTabs", "communicationChannels", "featureToggles", "customTabs"],
  };
  if (editing.isCustom) {
    body.customSchema = editing.customSchema;
  } else {
    body.enabledTabs = editing.tabs;
    body.communicationChannels = editing.channels;
    body.featureToggles = editing.featureToggles;
    body.customTabs = editing.customTabs;
  }
  const res = await fetch(`/api/checklists/${editing.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await failureMessage(res, "Failed to save settings"));
}

/**
 * Copy a checklist with all its content, named "<client> (Copy)". Pass `accountId` to file the copy under
 * a company; leave it out for an unfiled copy.
 */
export async function duplicateChecklist(id: string, accountId?: string): Promise<{ id: string; slug: string; name: string }> {
  // 1. Fetch the full source checklist (auth-protected endpoint)
  const res = await fetch(`/api/checklists/${id}`);
  if (!res.ok) throw new Error("Failed to fetch source checklist");
  const original = (await res.json()) as Record<string, unknown>;

  // 2. Create the new record (config skeleton)
  const name = `${original.clientName} (Copy)`;
  const createBody: Record<string, unknown> = { clientName: name };
  createBody.ownerEmail = original.ownerEmail ?? null;
  if (accountId) createBody.accountId = accountId;
  if (original.isCustom) {
    createBody.isCustom = true;
    createBody.customSchema = original.customSchema;
  } else {
    createBody.enabledTabs = original.enabledTabs;
    createBody.communicationChannels = original.communicationChannels;
    createBody.featureToggles = original.featureToggles;
    if (original.customTabs) createBody.customTabs = original.customTabs;
  }
  const createRes = await fetch("/api/checklists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });
  if (!createRes.ok) throw new Error(await failureMessage(createRes, "Failed to create copy"));
  const created = (await createRes.json()) as { id: string; slug: string; version: number };

  // 3. PUT all content data from original into the new record (whole-document path)
  // Without this step every content section would be empty defaults.
  const contentBody: Record<string, unknown> = {
    version: created.version,
    enabledTabs: original.enabledTabs,
    tabOrder: original.tabOrder,
    tabFilledBy: original.tabFilledBy,
    communicationChannels: original.communicationChannels,
    featureToggles: original.featureToggles,
    companyInfo: original.companyInfo,
    users: original.users,
    campaigns: original.campaigns,
    sites: original.sites,
    prescreening: original.prescreening,
    messaging: original.messaging,
    sources: original.sources,
    folders: original.folders,
    documents: original.documents,
    attributes: original.attributes,
    fbWhatsapp: original.fbWhatsapp,
    instagram: original.instagram,
    aiCallFaqs: original.aiCallFaqs,
    agencyPortal: original.agencyPortal,
    agencyPortalUsers: original.agencyPortalUsers,
    rejectionReasons: original.rejectionReasons,
    labels: original.labels,
    adminSettings: original.adminSettings,
    atsIntegrations: original.atsIntegrations,
    tabUploadMeta: original.tabUploadMeta,
    customSchema: original.customSchema,
    customData: original.customData,
    customTabs: original.customTabs,
  };
  const putRes = await fetch(`/api/checklists/${created.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(contentBody),
  });
  if (!putRes.ok) throw new Error(await failureMessage(putRes, "Failed to copy content data"));

  return { id: created.id, slug: created.slug, name };
}

/** Issue a new editor link. The old one stops working at once. */
export async function regenerateEditorToken(id: string): Promise<void> {
  const res = await fetch(`/api/checklists/${id}/regenerate-token`, { method: "POST" });
  if (!res.ok) throw new Error("Token regeneration failed");
}

/** Delete a checklist for good. */
export async function deleteChecklist(id: string): Promise<void> {
  const res = await fetch(`/api/checklists/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await failureMessage(res, "Delete failed"));
}
