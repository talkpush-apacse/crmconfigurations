/**
 * Named chunks for the section rail and the mobile section picker.
 *
 * The checklist has up to twenty sections. A flat list of that length has no
 * landmarks, so each section belongs to one of a handful of chunks. The chunks
 * only decide how the rail is labelled. They never change a section's route,
 * its position in `tabOrder`, or who fills it in.
 *
 * Among the sections a client fills in, every chunk is a contiguous run of the
 * default section order, so with the default order the rail reads top to bottom
 * exactly like "Continue to ...".
 */

export interface SectionGroup {
  id: string;
  label: string;
}

export const SECTION_GROUPS: SectionGroup[] = [
  { id: "basics", label: "Account basics" },
  { id: "hiring", label: "Hiring process" },
  { id: "channels", label: "Channels" },
  { id: "rules", label: "Rules and integrations" },
  { id: "custom", label: "Custom forms" },
];

const GROUP_BY_SLUG: Record<string, string> = {
  welcome: "basics",
  "company-info": "basics",
  users: "basics",
  sites: "basics",
  campaigns: "hiring",
  prescreening: "hiring",
  messaging: "hiring",
  sources: "hiring",
  folders: "hiring",
  documents: "hiring",
  attributes: "hiring",
  labels: "hiring",
  "facebook-whatsapp": "channels",
  instagram: "channels",
  "ai-call-faqs": "channels",
  "rejection-reasons": "rules",
  "agency-portal": "rules",
  "admin-settings": "rules",
  autoflows: "rules",
  integrations: "rules",
};

/** Which chunk a section belongs to. Custom tabs and unknown slugs fall into "Custom forms". */
export function getSectionGroupId(slug: string | undefined): string {
  if (!slug) return "custom";
  return GROUP_BY_SLUG[slug] ?? "custom";
}

export function getSectionGroupLabel(groupId: string): string {
  return SECTION_GROUPS.find((g) => g.id === groupId)?.label ?? "Other";
}

/**
 * Splits items into chunks in chunk order. Within a chunk the incoming order is
 * kept, so a reordered `tabOrder` still shows through. Empty chunks are dropped.
 */
export function chunkSections<T extends { slug?: string }>(
  items: T[],
): { id: string; label: string; items: T[] }[] {
  return SECTION_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: items.filter((item) => getSectionGroupId(item.slug) === group.id),
  })).filter((group) => group.items.length > 0);
}
