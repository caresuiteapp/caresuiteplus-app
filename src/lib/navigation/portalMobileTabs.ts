import type { ShellTabConfig } from '@/types/navigation/shell';

/** Visible tab slots on phone before overflow — 4 primary + „Mehr“. */
export const PORTAL_MOBILE_PRIMARY_MAX = 4;
export const PORTAL_MOBILE_INLINE_MAX = 5;

const PRIMARY_TAB_KEYS = [
  'overview',
  'assist-appointments',
  'appointments',
  'messages',
  'documents',
  'assist-betreuung',
  'assist-budget',
  'profile',
];

function tabPriority(key: string): number {
  const idx = PRIMARY_TAB_KEYS.indexOf(key);
  return idx === -1 ? PRIMARY_TAB_KEYS.length + 1 : idx;
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
): PortalMobileTabSplit {
  if (tabs.length <= PORTAL_MOBILE_INLINE_MAX) {
    return { primary: tabs, overflow: [] };
  }

  const activeTab = tabs.find((tab) => tab.key === activeKey);
  const sorted = [...tabs].sort((a, b) => tabPriority(a.key) - tabPriority(b.key));

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

  const overflow = tabs.filter((tab) => !used.has(tab.key));
  return { primary, overflow };
}

/** Fixed bottom nav height (icon + label + top padding, excluding safe area). */
export const PORTAL_MOBILE_NAV_HEIGHT = 56;
