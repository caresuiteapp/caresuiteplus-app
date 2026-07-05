import type { ShellTabConfig } from '@/types/navigation/shell';
import type { PortalModuleKey } from '@/lib/portal/types';

/** Fixed bottom-nav tabs on phone — Klient:innenportal. */
export const PORTAL_MOBILE_TAB_KEYS = [
  'overview',
  'assist-appointments',
  'documents',
  'messages',
  'profile',
] as const;

export type PortalMobileTabKey = (typeof PORTAL_MOBILE_TAB_KEYS)[number];

/** Fixed bottom-nav tabs on phone — Mitarbeiterportal. */
export const PORTAL_EMPLOYEE_MOBILE_TAB_KEYS = [
  'overview',
  'assignments',
  'calendar',
  'messages',
  'profile',
] as const;

export type PortalEmployeeMobileTabKey = (typeof PORTAL_EMPLOYEE_MOBILE_TAB_KEYS)[number];

/** @deprecated Legacy overflow split — desktop/tablet unaffected; mobile uses fixed tabs. */
export const PORTAL_MOBILE_PRIMARY_MAX = 4;
/** @deprecated Legacy inline max before overflow menu. */
export const PORTAL_MOBILE_INLINE_MAX = 5;

const FALLBACK_CLIENT_MOBILE_TABS: Record<PortalMobileTabKey, ShellTabConfig> = {
  overview: { key: 'overview', label: 'Übersicht', icon: '🏠', href: '/portal/client' },
  'assist-appointments': {
    key: 'assist-appointments',
    label: 'Einsätze',
    icon: '📅',
    href: '/portal/client/appointments',
  },
  documents: { key: 'documents', label: 'Dokumente', icon: '📄', href: '/portal/client/documents' },
  messages: { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/portal/client/messages' },
  profile: { key: 'profile', label: 'Profil', icon: '👤', href: '/portal/client/profile' },
};

const FALLBACK_EMPLOYEE_MOBILE_TABS: Record<PortalEmployeeMobileTabKey, ShellTabConfig> = {
  overview: { key: 'overview', label: 'Übersicht', icon: '🏠', href: '/portal/employee' },
  assignments: {
    key: 'assignments',
    label: 'Einsätze',
    icon: '📅',
    href: '/portal/employee/assignments',
  },
  calendar: {
    key: 'calendar',
    label: 'Kalender',
    icon: '📅',
    href: '/portal/employee/calendar',
  },
  messages: {
    key: 'messages',
    label: 'Nachrichten',
    icon: '💬',
    href: '/portal/employee/messages',
  },
  profile: { key: 'profile', label: 'Profil', icon: '👤', href: '/portal/employee/profile' },
};

/**
 * Resolves the five fixed mobile portal tabs (Übersicht, Einsätze, Dokumente, Nachrichten, Profil).
 * Merges href/icon from dynamic portal tabs when available.
 */
export function resolveFixedMobilePortalTabs(tabs: ShellTabConfig[]): ShellTabConfig[] {
  return PORTAL_MOBILE_TAB_KEYS.map((key) => {
    const dynamic =
      tabs.find((tab) => tab.key === key) ??
      (key === 'assist-appointments'
        ? tabs.find((tab) => tab.key === 'appointments')
        : undefined);
    return dynamic ?? FALLBACK_CLIENT_MOBILE_TABS[key];
  });
}

/** Five fixed employee mobile tabs — Übersicht, Einsätze, Kalender, Nachrichten, Profil. */
export function resolveFixedMobileEmployeePortalTabs(tabs: ShellTabConfig[]): ShellTabConfig[] {
  return PORTAL_EMPLOYEE_MOBILE_TAB_KEYS.map((key) => {
    const dynamic =
      tabs.find((tab) => tab.key === key) ??
      (key === 'overview' ? tabs.find((tab) => tab.key === 'index') : undefined);
    return dynamic ?? FALLBACK_EMPLOYEE_MOBILE_TABS[key];
  });
}

const BASE_TAB_PRIORITY = [
  'overview',
  'assist-appointments',
  'appointments',
  'module-pflege',
  'module-assist',
  'module-stationaer',
  'module-beratung',
  'assist-betreuung',
  'assist-trips',
  'messages',
  'documents',
  'assist-budget',
  'assist-anfragen',
  'profile',
];

const MODULE_TAB_PREFIX: Record<PortalModuleKey, string> = {
  assist: 'assist-',
  pflege: 'module-pflege',
  stationaer: 'module-stationaer',
  beratung: 'module-beratung',
};

function tabPriority(key: string, activeModules: PortalModuleKey[] = []): number {
  const dynamicPriority = buildDynamicTabPriority(activeModules);
  const order = dynamicPriority.length > 0 ? dynamicPriority : BASE_TAB_PRIORITY;
  const idx = order.indexOf(key);
  return idx === -1 ? order.length + 1 : idx;
}

/** Prioritises tabs for assigned modules — assist/pflege feature tabs before overflow. */
export function buildDynamicTabPriority(activeModules: PortalModuleKey[]): string[] {
  if (activeModules.length === 0) return BASE_TAB_PRIORITY;

  const priority = ['overview'];
  for (const moduleKey of activeModules) {
    if (moduleKey === 'assist') {
      priority.push(
        'assist-appointments',
        'assist-betreuung',
        'assist-trips',
        'assist-budget',
        'assist-anfragen',
      );
    } else {
      priority.push(MODULE_TAB_PREFIX[moduleKey]);
    }
  }
  priority.push('messages', 'documents', 'profile');
  return priority;
}

export function filterPortalMobileTabs(
  tabs: ShellTabConfig[],
  activeModules: PortalModuleKey[],
): ShellTabConfig[] {
  if (activeModules.length === 0) return tabs;

  return tabs.filter((tab) => {
    if (tab.key.startsWith('assist-') && !activeModules.includes('assist')) return false;
    if (tab.key === 'module-pflege' && !activeModules.includes('pflege')) return false;
    if (tab.key === 'module-stationaer' && !activeModules.includes('stationaer')) return false;
    if (tab.key === 'module-beratung' && !activeModules.includes('beratung')) return false;
    return true;
  });
}

export type PortalMobileTabSplit = {
  primary: ShellTabConfig[];
  overflow: ShellTabConfig[];
};

/**
 * @deprecated Use resolveFixedMobilePortalTabs for phone bottom nav.
 * Kept for legacy tests and overflow-menu code paths outside the client portal.
 */
export function splitPortalTabsForMobile(
  tabs: ShellTabConfig[],
  activeKey: string,
  activeModules: PortalModuleKey[] = [],
): PortalMobileTabSplit {
  const primary = resolveFixedMobilePortalTabs(filterPortalMobileTabs(tabs, activeModules));
  return { primary, overflow: [] };
}

/** Fixed bottom nav height (icon + label + top padding, excluding safe area). */
export const PORTAL_MOBILE_NAV_HEIGHT = 56;
