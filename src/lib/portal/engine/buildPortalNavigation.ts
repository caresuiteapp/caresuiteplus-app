import type { PortalContext, PortalFeature, PortalNavItem } from '@/lib/portal/types';
import {
  PORTAL_MODULE_ICONS,
  PORTAL_MODULE_LABELS,
  sortPortalModules,
} from './portalModuleKeys';
import {
  isPortalFeatureShownInPrimaryNav,
  isPortalModuleNavImplemented,
  moduleOverviewNavItem,
} from './portalNavigationRegistry';

const GLOBAL_NAV: PortalNavItem[] = [
  { key: 'documents', label: 'Dokumente', icon: '📄', href: '/portal/client/documents', navGroup: 'global' },
  { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/portal/client/messages', navGroup: 'global' },
  { key: 'profile', label: 'Profil', icon: '👤', href: '/portal/client/profile', navGroup: 'global' },
];

const ASSIST_FEATURE_ICONS: Record<string, string> = {
  appointments: '📅',
  betreuung: '🤝',
  care_team: '👥',
  trips: '🚗',
  budget: '💶',
  nachweise: '📋',
  aktivitaeten: '📰',
  anfragen: '📨',
  hilfe: '❓',
  messages: '💬',
  documents: '📄',
};

const ASSIST_FEATURE_HREFS: Record<string, string> = {
  appointments: '/portal/client/appointments',
  betreuung: '/portal/client?module=assist&section=betreuung',
  care_team: '/portal/client?module=assist&section=betreuung',
  trips: '/portal/client?module=assist&section=begleitungen',
  budget: '/portal/client/budget',
  nachweise: '/portal/client?module=assist&section=nachweise',
  aktivitaeten: '/portal/client?modal=aktivitaeten',
  anfragen: '/portal/client?modal=anfragen',
  hilfe: '/portal/client/help',
};

function assistFeatureNavItems(features: PortalFeature[]): PortalNavItem[] {
  return features
    .filter(
      (f) =>
        f.moduleKey === 'assist' &&
        f.navGroup === 'module' &&
        isPortalFeatureShownInPrimaryNav(f),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((feature) => ({
      key: `assist-${feature.featureKey}`,
      label: feature.label,
      icon: ASSIST_FEATURE_ICONS[feature.featureKey] ?? '✨',
      href: ASSIST_FEATURE_HREFS[feature.featureKey] ?? `/portal/client?module=assist&section=${feature.featureKey}`,
      moduleKey: 'assist',
      navGroup: 'module' as const,
    }));
}

export function buildPortalNavigation(context: Pick<
  PortalContext,
  'activeModuleKeys' | 'hasModuleAssignments'
> & Partial<Pick<PortalContext, 'primaryModule' | 'visibleFeatures'>>): PortalNavItem[] {
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
    const isAssistPrimary = context.primaryModule === 'assist';

    if (isAssistPrimary && (context.visibleFeatures?.length ?? 0) > 0) {
      items.push(...assistFeatureNavItems(context.visibleFeatures!));
    } else {
      for (const moduleKey of sortPortalModules(context.activeModuleKeys)) {
        if (isPortalModuleNavImplemented(moduleKey)) {
          items.push(moduleOverviewNavItem(moduleKey));
        } else {
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
