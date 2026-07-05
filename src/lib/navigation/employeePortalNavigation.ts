import type { ShellTabConfig } from '@/types/navigation/shell';

/** Primary bottom-nav tabs — max five on mobile. */
export const EMPLOYEE_PORTAL_PRIMARY_TAB_KEYS = [
  'overview',
  'assignments',
  'calendar',
  'messages',
  'profile',
] as const;

export type EmployeePortalPrimaryTabKey = (typeof EMPLOYEE_PORTAL_PRIMARY_TAB_KEYS)[number];

/** Secondary routes reachable via hamburger drawer only. */
export const EMPLOYEE_PORTAL_DRAWER_TAB_KEYS = ['clients', 'uploads', 'times'] as const;

export type EmployeePortalDrawerTabKey = (typeof EMPLOYEE_PORTAL_DRAWER_TAB_KEYS)[number];

export const PORTAL_EMPLOYEE_DRAWER_TABS: ShellTabConfig[] = [
  {
    key: 'clients',
    label: 'Klientenakten',
    icon: '👥',
    href: '/portal/employee/clients',
  },
  {
    key: 'uploads',
    label: 'Uploads / Dokumente',
    icon: '📤',
    href: '/portal/employee/uploads',
  },
  {
    key: 'times',
    label: 'Meine Zeiten',
    icon: '⏱️',
    href: '/portal/employee/times',
  },
];

/** Full navigation list for drawer and desktop sidebar (primary + drawer extras). */
export function resolveEmployeePortalNavigationTabs(primaryTabs: ShellTabConfig[]): ShellTabConfig[] {
  const primaryKeys = new Set(primaryTabs.map((tab) => tab.key));
  const drawerExtras = PORTAL_EMPLOYEE_DRAWER_TABS.filter((tab) => !primaryKeys.has(tab.key));
  return [...primaryTabs, ...drawerExtras];
}
