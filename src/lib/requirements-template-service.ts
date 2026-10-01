import { randomUUID } from "node:crypto";
import type { CustomFieldDef, CustomTab, RequirementsTemplate, ValidationGroup } from "@/lib/types";
import { customTabSlugConflict, customTabSlugFromLabel } from "@/lib/tab-config";

export interface RequirementsTemplateRecord {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tabName: string;
  tabDescription: string | null;
  tabIcon: string | null;
  fields: unknown;
  validationGroups: unknown;
  version: number;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequirementsTemplateSummary {
  fieldCount: number;
  requiredFieldCount: number;
  attachmentFieldCount: number;
  repeaterFieldCount: number;
  validationGroupCount: number;
}

export interface AppliedTemplateTabResult {
  customTab: CustomTab;
  urlSlug: string;
  summary: RequirementsTemplateSummary;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function serializeRequirementsTemplate(
  template: RequirementsTemplateRecord,
): RequirementsTemplate {
  return {
    id: template.id,
    name: template.name,
    ...(template.description ? { description: template.description } : {}),
    ...(template.category ? { category: template.category } : {}),
    tabName: template.tabName,
    ...(template.tabDescription ? { tabDescription: template.tabDescription } : {}),
    ...(template.tabIcon ? { tabIcon: template.tabIcon } : {}),
    fields: cloneJson((template.fields ?? []) as CustomFieldDef[]),
    validationGroups: cloneJson((template.validationGroups ?? []) as ValidationGroup[]),
    version: template.version,
    archived: template.archived,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export function summarizeRequirementsTemplate(
  template: Pick<RequirementsTemplate, "fields" | "validationGroups">,
): RequirementsTemplateSummary {
  const fields = template.fields ?? [];
  return {
    fieldCount: fields.length,
    requiredFieldCount: fields.filter((field) => field.required || field.requiredWhen).length,
    attachmentFieldCount: fields.filter((field) => field.type === "file").length,
    repeaterFieldCount: fields.filter((field) => field.type === "repeater").length,
    validationGroupCount: template.validationGroups?.length ?? 0,
  };
}

export function summarizeTemplateRecord(
  template: RequirementsTemplateRecord,
): RequirementsTemplateSummary {
  return summarizeRequirementsTemplate({
    fields: (template.fields ?? []) as CustomFieldDef[],
    validationGroups: (template.validationGroups ?? []) as ValidationGroup[],
  });
}

export function uniqueCustomTabSlug(label: string, existingTabs: CustomTab[]): string {
  const baseSlug = customTabSlugFromLabel(label);
  if (!baseSlug) {
    throw new Error("Template tab name must contain at least one letter or number.");
  }

  let candidate = baseSlug;
  let suffix = 2;
  while (customTabSlugConflict(candidate, existingTabs)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function buildCustomTabFromTemplate(
  template: RequirementsTemplateRecord,
  existingTabs: CustomTab[],
  options: {
    tabNameOverride?: string;
    descriptionOverride?: string;
    tabIconOverride?: string;
  } = {},
): AppliedTemplateTabResult {
  const label = (options.tabNameOverride?.trim() || template.tabName).trim();
  if (!label) throw new Error("Template tab name is required.");

  const tabSlug = uniqueCustomTabSlug(label, existingTabs);
  const fields = cloneJson((template.fields ?? []) as CustomFieldDef[]);
  const validationGroups = cloneJson((template.validationGroups ?? []) as ValidationGroup[]);

  const description =
    options.descriptionOverride !== undefined
      ? options.descriptionOverride.trim()
      : template.tabDescription?.trim();

  const customTab: CustomTab = {
    id: `ct_${randomUUID()}`,
    slug: tabSlug,
    label,
    ...(description ? { description } : {}),
    mode: "form",
    icon: options.tabIconOverride?.trim() || template.tabIcon || "FileText",
    fields,
    ...(validationGroups.length > 0 ? { validationGroups } : {}),
    templateSource: {
      templateId: template.id,
      version: template.version,
    },
    uploadedFile: null,
    sortOrder: existingTabs.length,
    createdAt: new Date().toISOString(),
  };

  return {
    customTab,
    urlSlug: `custom-${tabSlug}`,
    summary: summarizeRequirementsTemplate({ fields, validationGroups }),
  };
}
