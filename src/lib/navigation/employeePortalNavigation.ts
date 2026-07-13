import type { ShellTabConfig } from '@/types/navigation/shell';

/**
 * Canonical employee portal navigation order (drawer, desktop sidebar, Schnellzugriffe).
 * Bottom nav uses the first five keys from EMPLOYEE_PORTAL_PRIMARY_TAB_KEYS.
 */
export const EMPLOYEE_PORTAL_NAV_TABS: ShellTabConfig[] = [
  { key: 'overview', label: 'Übersicht', icon: '🏠', href: '/portal/employee' },
  { key: 'assignments', label: 'Einsätze', icon: '📋', href: '/portal/employee/assignments' },
  { key: 'uploads', label: 'Uploads / Dokumente', icon: '📤', href: '/portal/employee/uploads' },
  { key: 'calendar', label: 'Kalender', icon: '📅', href: '/portal/employee/calendar' },
  { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/portal/employee/messages' },
  { key: 'clients', label: 'Klientenakten', icon: '👥', href: '/portal/employee/clients' },
  {
    key: 'signatures',
    label: 'Dokumente & Unterschriften',
    icon: '✍️',
    href: '/portal/employee/signatures',
  },
  { key: 'profile', label: 'Profil', icon: '👤', href: '/portal/employee/profile' },
  {
    key: 'time-tracking',
    label: 'Arbeitszeiten',
    icon: '🕐',
    href: '/portal/employee/times',
  },
  { key: 'times', label: 'Meine Zeiten', icon: '⏱️', href: '/portal/employee/times' },
  { key: 'documents', label: 'Dokumente', icon: '📄', href: '/portal/employee/uploads' },
  { key: 'open-tasks', label: 'Offene Aufgaben', icon: '✅', href: '/portal/employee/tasks' },
];

/** Primary bottom-nav tabs on phone — Übersicht … Nachrichten. */
export const EMPLOYEE_PORTAL_PRIMARY_TAB_KEYS = [
  'overview',
  'assignments',
  'uploads',
  'calendar',
  'messages',
] as const;

export type EmployeePortalPrimaryTabKey = (typeof EMPLOYEE_PORTAL_PRIMARY_TAB_KEYS)[number];

/** Drawer-only keys (everything after primary bottom nav in canonical order). */
export const EMPLOYEE_PORTAL_DRAWER_TAB_KEYS = [
  'clients',
  'signatures',
  'profile',
  'time-tracking',
  'times',
  'documents',
  'open-tasks',
] as const;

export type EmployeePortalDrawerTabKey = (typeof EMPLOYEE_PORTAL_DRAWER_TAB_KEYS)[number];

export const PORTAL_EMPLOYEE_DRAWER_TABS: ShellTabConfig[] = EMPLOYEE_PORTAL_DRAWER_TAB_KEYS.map(
  (key) => EMPLOYEE_PORTAL_NAV_TABS.find((tab) => tab.key === key)!,
);

export function buildEmployeePortalPrimaryTabs(): ShellTabConfig[] {
  return EMPLOYEE_PORTAL_PRIMARY_TAB_KEYS.map(
    (key) => EMPLOYEE_PORTAL_NAV_TABS.find((tab) => tab.key === key)!,
  );
}

/** Full navigation list for drawer and desktop sidebar. */
export function resolveEmployeePortalNavigationTabs(
  _primaryTabs?: ShellTabConfig[],
): ShellTabConfig[] {
  return EMPLOYEE_PORTAL_NAV_TABS;
}

export const EMPLOYEE_PORTAL_NAV_LABELS = EMPLOYEE_PORTAL_NAV_TABS.map((tab) => tab.label);
