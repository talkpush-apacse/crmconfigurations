import type { ConfiguratorTemplateItem } from '@/lib/configurator-template';
import type { CommunicationChannels } from '@/lib/types';

export function getApplicableItems(
  template: ConfiguratorTemplateItem[],
  config: {
    enabledTabs: string[];
    communicationChannels: string[];
    featureToggles: Record<string, boolean>;
  }
): ConfiguratorTemplateItem[] {
  return template.filter(item => {
    if (!item.requires) return true;
    const { channel, tab, featureToggle } = item.requires;
    if (channel && !config.communicationChannels.includes(channel)) return false;
    if (tab && !config.enabledTabs.includes(tab)) return false;
    if (featureToggle && !config.featureToggles[featureToggle]) return false;
    return true;
  });
}

// Build the channel string array from the CommunicationChannels object + enabledTabs.
// 'facebook' is included when messenger is enabled (Facebook Messenger = messenger channel).
// 'instagram' is included when the 'instagram' tab is enabled (no separate channel toggle).
export function buildChannelArray(
  channels: CommunicationChannels | null,
  enabledTabs: string[] | null
): string[] {
  if (!channels) return [];
  const result: string[] = [];
  if (channels.email) result.push('email');
  if (channels.sms) result.push('sms');
  if (channels.messenger) { result.push('messenger'); result.push('facebook'); }
  if (channels.whatsapp) result.push('whatsapp');
  if (channels.liveCall) result.push('liveCall');
  if (channels.aiCalls) result.push('aiCalls');
  if (enabledTabs?.includes('instagram')) result.push('instagram');
  return result;
}

// Resolve a dot-notation path into checklist data.
// Returns '—' for missing/null/undefined/empty, arrays, or objects — only scalars render.
export function resolveContextPath(data: unknown, path: string): string {
  const resolved = path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, data);
  if (resolved === null || resolved === undefined || resolved === '') return '—';
  if (typeof resolved === 'object') return '—';
  return String(resolved);
}
