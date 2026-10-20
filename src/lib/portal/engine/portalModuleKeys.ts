import type { PortalModuleKey } from '@/lib/portal/types';

export const PORTAL_MODULE_KEYS: readonly PortalModuleKey[] = [
  'office',
  'assist',
  'pflege',
  'stationaer',
  'beratung',
  'akademie',
] as const;

/** Dashboard ordering — Pflege has highest priority when active. */
export const PORTAL_MODULE_PRIORITY: Record<PortalModuleKey, number> = {
  office: 5,
  pflege: 1,
  stationaer: 2,
  assist: 3,
  beratung: 4,
  akademie: 6,
};

export const PORTAL_MODULE_LABELS: Record<PortalModuleKey, string> = {
  office: 'Office',
  assist: 'Assist',
  pflege: 'Pflege',
  stationaer: 'Stationär',
  beratung: 'Beratung',
  akademie: 'Akademie',
};

export const PORTAL_MODULE_ICONS: Record<PortalModuleKey, string> = {
  office: '▦',
  assist: '🤝',
  pflege: '💚',
  stationaer: '🏥',
  beratung: '💬',
  akademie: '◇',
};

export function isPortalModuleKey(value: string): value is PortalModuleKey {
  return (PORTAL_MODULE_KEYS as readonly string[]).includes(value);
}

export function sortPortalModules(modules: PortalModuleKey[]): PortalModuleKey[] {
  return [...modules].sort(
    (a, b) => PORTAL_MODULE_PRIORITY[a] - PORTAL_MODULE_PRIORITY[b],
  );
}

export function filterPortalModuleKeys(values: string[]): PortalModuleKey[] {
  return values.filter(isPortalModuleKey);
}
