import type { ConfiguratorTemplateItem } from "@/lib/configurator-template";

export function getApplicableItems(
  template: ConfiguratorTemplateItem[],
  config: {
    enabledTabs: string[];
    communicationChannels: string[];
    featureToggles: Record<string, boolean>;
  }
): ConfiguratorTemplateItem[] {
  return template.filter((item) => {
    if (!item.requires) return true;
    const { channel, tab, featureToggle } = item.requires;
    if (channel && !config.communicationChannels.includes(channel)) return false;
    if (tab && !config.enabledTabs.includes(tab)) return false;
    if (featureToggle && !config.featureToggles[featureToggle]) return false;
    return true;
  });
}

// Resolver for contextFields — dot-path with strict type-check.
// Returns "—" for missing/null/undefined/empty, arrays, or objects — only scalars render.
export function resolveContextPath(data: unknown, path: string): string {
  const resolved = path
    .split(".")
    .reduce<unknown>((acc, key) => {
      if (acc === null || acc === undefined || typeof acc !== "object") return undefined;
      return (acc as Record<string, unknown>)[key];
    }, data);

  if (resolved === null || resolved === undefined || resolved === "") return "—";
  if (typeof resolved === "object") return "—";
  return String(resolved);
}
