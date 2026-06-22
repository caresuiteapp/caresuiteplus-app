import type { AppShellArea } from '@/types/navigation/shell';
import type { ShellTabConfig } from '@/types/navigation/shell';
import { resolveFixedMobilePortalTabs } from './portalMobileTabs';

/** Max primary tabs before the fixed „Mehr“ slot on phone bottom nav. */
export const SHELL_MOBILE_PRIMARY_MAX = 4;

/** Fixed bottom-nav slot keys per area — four primary tabs + „Mehr“. */
export const SHELL_MOBILE_TAB_KEYS: Partial<Record<AppShellArea, readonly string[]>> = {
  business: ['index', 'schedule', 'clients', 'employees', 'more'],
  office: ['index', 'clients', 'employees', 'invoices', 'more'],
  assist: ['index', 'assignments', 'durchfuehrung', 'nachweise', 'more'],
  portal_employee: ['index', 'assignments', 'messages', 'times', 'more'],
};

const FALLBACK_MORE: ShellTabConfig = {
  key: 'more',
  label: 'Mehr',
  icon: 'modulesActive',
  href: '/business/modules',
};

const OFFICE_MORE: ShellTabConfig = {
  key: 'more',
  label: 'Mehr',
  icon: 'modulesActive',
  href: '/business/office/modules',
};

const ASSIST_MORE: ShellTabConfig = {
  key: 'more',
  label: 'Mehr',
  icon: 'modulesActive',
  href: '/assist/calendar',
};

function resolveMoreFallback(area?: AppShellArea): ShellTabConfig {
  if (area === 'office') return OFFICE_MORE;
  if (area === 'assist') return ASSIST_MORE;
  return FALLBACK_MORE;
}

/**
 * Resolves exactly five fixed mobile bottom-nav tabs (4 primary + Mehr).
 * Overflow tabs remain reachable via the hamburger drawer.
 */
export function resolveCompactShellMobileTabs(
  tabs: ShellTabConfig[],
  area?: AppShellArea,
): ShellTabConfig[] {
  if (area === 'portal_client') {
    return resolveFixedMobilePortalTabs(tabs);
  }

  const keys = area ? SHELL_MOBILE_TAB_KEYS[area] : undefined;
  if (!keys) {
    const more = tabs.find((tab) => tab.key === 'more');
    const rest = tabs.filter((tab) => tab.key !== 'more');
    const primary = rest.slice(0, SHELL_MOBILE_PRIMARY_MAX);
    if (more) return [...primary, more];
    return rest.slice(0, SHELL_MOBILE_PRIMARY_MAX + 1);
  }

  const moreFallback = resolveMoreFallback(area);

  return keys
    .map((key) => {
      const found = tabs.find((tab) => tab.key === key);
      if (found) return found;
      if (key === 'more') return tabs.find((tab) => tab.key === 'more') ?? moreFallback;
      return null;
    })
    .filter((tab): tab is ShellTabConfig => tab != null);
}

/** Phone bottom nav uses compact fixed tabs when more than four items would scroll. */
export function shouldUseCompactMobileNav(tabCount: number, isPhone: boolean): boolean {
  return isPhone && tabCount > SHELL_MOBILE_PRIMARY_MAX;
}
