import type { ShellTabConfig } from '@/types/navigation/shell';

/**
 * Canonical Klient:innenportal navigation (drawer, desktop sidebar).
 * Bottom nav uses the first five keys from CLIENT_PORTAL_PRIMARY_TAB_KEYS.
 */
export const CLIENT_PORTAL_NAV_TABS: ShellTabConfig[] = [
  { key: 'overview', label: 'Übersicht', icon: '🏠', href: '/portal/client' },
  { key: 'appointments', label: 'Einsätze', icon: '📅', href: '/portal/client/appointments' },
  { key: 'documents', label: 'Dokumente', icon: '📄', href: '/portal/client/documents' },
  { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/portal/client/messages' },
  { key: 'profile', label: 'Profil', icon: '👤', href: '/portal/client/profile' },
  { key: 'proofs', label: 'Nachweise', icon: '📋', href: '/portal/client/proofs' },
  {
    key: 'signatures',
    label: 'Unterschriften',
    icon: '✍️',
    href: '/portal/client/documents/signatures',
  },
  { key: 'requests', label: 'Anfragen', icon: '📨', href: '/portal/client?modal=anfragen' },
  { key: 'activities', label: 'Aktivitäten', icon: '📰', href: '/portal/client?modal=aktivitaeten' },
  { key: 'settings', label: 'Einstellungen', icon: '⚙️', href: '/portal/client/profile' },
];

/** Primary bottom-nav tabs on phone — Übersicht … Profil. */
export const CLIENT_PORTAL_PRIMARY_TAB_KEYS = [
  'overview',
  'appointments',
  'documents',
  'messages',
  'profile',
] as const;

export type ClientPortalPrimaryTabKey = (typeof CLIENT_PORTAL_PRIMARY_TAB_KEYS)[number];

/** Drawer-only keys (beyond primary bottom nav). */
export const CLIENT_PORTAL_DRAWER_TAB_KEYS = [
  'proofs',
  'signatures',
  'requests',
  'activities',
  'settings',
] as const;

export function buildClientPortalPrimaryTabs(): ShellTabConfig[] {
  return CLIENT_PORTAL_PRIMARY_TAB_KEYS.map(
    (key) => CLIENT_PORTAL_NAV_TABS.find((tab) => tab.key === key)!,
  );
}

/** Full navigation list for drawer and desktop sidebar. */
export function resolveClientPortalNavigationTabs(): ShellTabConfig[] {
  return CLIENT_PORTAL_NAV_TABS;
}
