import type { PortalModuleKey } from '@/lib/portal/types';

export const PORTAL_MODULE_KEYS: readonly PortalModuleKey[] = [
  'assist',
  'pflege',
  'stationaer',
  'beratung',
] as const;

/** Dashboard ordering — Pflege has highest priority when active. */
export const PORTAL_MODULE_PRIORITY: Record<PortalModuleKey, number> = {
  pflege: 1,
  stationaer: 2,
  assist: 3,
  beratung: 4,
};

export const PORTAL_MODULE_LABELS: Record<PortalModuleKey, string> = {
  assist: 'Assist',
  pflege: 'Pflege',
  stationaer: 'Stationär',
  beratung: 'Beratung',
};

export const PORTAL_MODULE_ICONS: Record<PortalModuleKey, string> = {
  assist: '🤝',
  pflege: '💚',
  stationaer: '🏥',
  beratung: '💬',
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
