// Configuration for the 13 row-shaped checklist sections that support bulk
// select / soft-delete / duplicate. The keys match field names on
// ChecklistData (and CHECKLIST_JSON_FIELDS in lib/types.ts).
//
// rejectionReasons is excluded — it's a string[], not a row-object array, so
// has no per-row id to select on.

export type DuplicateStrategy = "name_suffix" | "email_suffix" | "as_is";

export interface BulkSectionConfig {
  /** Display label, plural ("users", "campaigns") */
  label: string;
  /** Display label, singular ("user", "campaign") */
  labelSingular: string;
  /** Row field used to identify the row in confirm dialogs */
  displayField: string;
  /** Row field that gets the duplicate suffix; null = pure clone */
  duplicateField: string | null;
  duplicateStrategy: DuplicateStrategy;
}

export type BulkSectionKey =
  | "users"
  | "campaigns"
  | "sites"
  | "prescreening"
  | "sources"
  | "folders"
  | "documents"
  | "attributes"
  | "agencyPortal"
  | "agencyPortalUsers"
  | "labels"
  | "atsIntegrations"
  | "integrations";

export const BULK_SECTIONS: Record<BulkSectionKey, BulkSectionConfig> = {
  users: {
    label: "users",
    labelSingular: "user",
    displayField: "name",
    duplicateField: "email",
    duplicateStrategy: "email_suffix",
  },
  campaigns: {
    label: "campaigns",
    labelSingular: "campaign",
    displayField: "nameInternal",
    duplicateField: "nameInternal",
    duplicateStrategy: "name_suffix",
  },
  sites: {
    label: "sites",
    labelSingular: "site",
    displayField: "siteName",
    duplicateField: "siteName",
    duplicateStrategy: "name_suffix",
  },
  prescreening: {
    label: "questions",
    labelSingular: "question",
    displayField: "question",
    duplicateField: "question",
    duplicateStrategy: "name_suffix",
  },
  sources: {
    label: "sources",
    labelSingular: "source",
    displayField: "link",
    duplicateField: null,
    duplicateStrategy: "as_is",
  },
  folders: {
    label: "folders",
    labelSingular: "folder",
    displayField: "folderName",
    duplicateField: "folderName",
    duplicateStrategy: "name_suffix",
  },
  documents: {
    label: "documents",
    labelSingular: "document",
    displayField: "documentName",
    duplicateField: "documentName",
    duplicateStrategy: "name_suffix",
  },
  attributes: {
    label: "attributes",
    labelSingular: "attribute",
    displayField: "attributeName",
    duplicateField: "attributeName",
    duplicateStrategy: "name_suffix",
  },
  agencyPortal: {
    label: "agency entries",
    labelSingular: "agency entry",
    displayField: "agencyName",
    duplicateField: "agencyName",
    duplicateStrategy: "name_suffix",
  },
  agencyPortalUsers: {
    label: "agency users",
    labelSingular: "agency user",
    displayField: "name",
    duplicateField: "email",
    duplicateStrategy: "email_suffix",
  },
  labels: {
    label: "labels",
    labelSingular: "label",
    displayField: "name",
    duplicateField: "name",
    duplicateStrategy: "name_suffix",
  },
  atsIntegrations: {
    label: "ATS integrations",
    labelSingular: "ATS integration",
    displayField: "name",
    duplicateField: "name",
    duplicateStrategy: "name_suffix",
  },
  integrations: {
    label: "integrations",
    labelSingular: "integration",
    displayField: "vendorName",
    duplicateField: "vendorName",
    duplicateStrategy: "name_suffix",
  },
};
