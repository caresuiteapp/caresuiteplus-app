import type { ShellTabConfig } from '@/types/navigation/shell';

/**
 * Canonical employee portal navigation order for phone, tablet and desktop.
 * Duplicate aliases stay routable, but are intentionally not shown as navigation items.
 */
export const EMPLOYEE_PORTAL_NAV_TABS: ShellTabConfig[] = [
  { key: 'overview', label: 'Übersicht', icon: '🏠', href: '/portal/employee' },
  { key: 'assignments', label: 'Einsätze', icon: '📋', href: '/portal/employee/assignments' },
  { key: 'calendar', label: 'Kalender', icon: '📅', href: '/portal/employee/calendar' },
  { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/portal/employee/messages' },
  { key: 'profile', label: 'Profil', icon: '👤', href: '/portal/employee/profile' },
  { key: 'uploads', label: 'Uploads', icon: '📤', href: '/portal/employee/uploads' },
  { key: 'clients', label: 'Klientenakten', icon: '👥', href: '/portal/employee/clients' },
  {
    key: 'signatures',
    label: 'Dokumente & Unterschriften',
    icon: '✍️',
    href: '/portal/employee/signatures',
  },
  {
    key: 'time-tracking',
    label: 'Arbeitszeiten',
    icon: '🕐',
    href: '/portal/employee/times',
  },
  {
    key: 'payroll',
    label: 'Gehalt & Auslagen',
    icon: '💶',
    href: '/portal/employee/payroll',
  },
  {
    key: 'vacation-request',
    label: 'Urlaubsantrag',
    icon: '🏖️',
    href: '/portal/employee/arbeitszeit/urlaub',
  },
  {
    key: 'absence-request',
    label: 'Abwesenheiten',
    icon: '🩺',
    href: '/portal/employee/arbeitszeit/abwesenheiten',
  },
];

/** Primary bottom-nav tabs on phone — Übersicht … Nachrichten. */
export const EMPLOYEE_PORTAL_PRIMARY_TAB_KEYS = [
  'overview',
  'assignments',
  'calendar',
  'messages',
  'profile',
] as const;

export type EmployeePortalPrimaryTabKey = (typeof EMPLOYEE_PORTAL_PRIMARY_TAB_KEYS)[number];

/** Drawer-only keys (everything after primary bottom nav in canonical order). */
export const EMPLOYEE_PORTAL_DRAWER_TAB_KEYS = [
  'uploads',
  'clients',
  'signatures',
  'time-tracking',
  'payroll',
  'vacation-request',
  'absence-request',
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
