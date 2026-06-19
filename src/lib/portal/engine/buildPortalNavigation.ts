import type { PortalContext, PortalNavItem } from '@/lib/portal/types';
import {
  PORTAL_MODULE_ICONS,
  PORTAL_MODULE_LABELS,
  sortPortalModules,
} from './portalModuleKeys';

const GLOBAL_NAV: PortalNavItem[] = [
  { key: 'documents', label: 'Dokumente', icon: '📄', href: '/portal/client/documents', navGroup: 'global' },
  { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/portal/client/messages', navGroup: 'global' },
  { key: 'profile', label: 'Profil', icon: '👤', href: '/portal/client/profile', navGroup: 'global' },
];

export function buildPortalNavigation(context: Pick<
  PortalContext,
  'activeModuleKeys' | 'hasModuleAssignments'
>): PortalNavItem[] {
  const items: PortalNavItem[] = [
    {
      key: 'overview',
      label: 'Übersicht',
      icon: '🏠',
      href: '/portal/client',
      navGroup: 'overview',
    },
  ];

  if (context.hasModuleAssignments) {
    for (const moduleKey of sortPortalModules(context.activeModuleKeys)) {
      items.push({
        key: `module-${moduleKey}`,
        label: PORTAL_MODULE_LABELS[moduleKey],
        icon: PORTAL_MODULE_ICONS[moduleKey],
        href: `/portal/client?module=${moduleKey}`,
        moduleKey,
        navGroup: 'module',
      });
    }
  }

  return [...items, ...GLOBAL_NAV];
}

/** Map portal nav items to shell tab bar config. */
export function portalNavToShellTabs(nav: PortalNavItem[]) {
  return nav.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
    href: item.href,
  }));
}
