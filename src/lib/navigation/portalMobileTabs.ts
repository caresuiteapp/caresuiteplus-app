import type { ShellTabConfig } from '@/types/navigation/shell';
import type { PortalModuleKey } from '@/lib/portal/types';

/** Visible tab slots on phone before overflow — 4 primary + „Mehr“. */
export const PORTAL_MOBILE_PRIMARY_MAX = 4;
export const PORTAL_MOBILE_INLINE_MAX = 5;

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
 * Splits dynamic portal tabs for phone bottom nav — up to 4 primary items plus „Mehr“.
 * Keeps the active route in the primary row when possible.
 */
export function splitPortalTabsForMobile(
  tabs: ShellTabConfig[],
  activeKey: string,
  activeModules: PortalModuleKey[] = [],
): PortalMobileTabSplit {
  const filteredTabs = filterPortalMobileTabs(tabs, activeModules);
  if (filteredTabs.length <= PORTAL_MOBILE_INLINE_MAX) {
    return { primary: filteredTabs, overflow: [] };
  }

  const activeTab = filteredTabs.find((tab) => tab.key === activeKey);
  const sorted = [...filteredTabs].sort(
    (a, b) => tabPriority(a.key, activeModules) - tabPriority(b.key, activeModules),
  );

  const primary: ShellTabConfig[] = [];
  const used = new Set<string>();

  const push = (tab: ShellTabConfig | undefined) => {
    if (!tab || used.has(tab.key)) return;
    primary.push(tab);
    used.add(tab.key);
  };

  push(sorted.find((tab) => tab.key === 'overview'));
  if (activeTab && activeTab.key !== 'overview') {
    push(activeTab);
  }

  for (const tab of sorted) {
    if (primary.length >= PORTAL_MOBILE_PRIMARY_MAX) break;
    push(tab);
  }

  const overflow = filteredTabs.filter((tab) => !used.has(tab.key));
  return { primary, overflow };
}

/** Fixed bottom nav height (icon + label + top padding, excluding safe area). */
export const PORTAL_MOBILE_NAV_HEIGHT = 56;
