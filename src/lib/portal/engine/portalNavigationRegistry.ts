import type { PortalFeature, PortalModuleKey, PortalNavItem } from '@/lib/portal/types';
import { PORTAL_MODULE_ICONS, PORTAL_MODULE_LABELS } from './portalModuleKeys';

/** Assist features reachable via KPI/modals but hidden from sidebar and mobile primary nav. */
export const PORTAL_PRIMARY_NAV_HIDDEN_FEATURE_KEYS = new Set<string>([
  'nachweise',
  'aktivitaeten',
]);

export function isPortalFeatureShownInPrimaryNav(feature: PortalFeature): boolean {
  if (feature.showInPrimaryNav === false) return false;
  if (
    feature.moduleKey === 'assist' &&
    PORTAL_PRIMARY_NAV_HIDDEN_FEATURE_KEYS.has(feature.featureKey)
  ) {
    return false;
  }
  return true;
}

/** Registry entry for module-scoped portal navigation (Assist fully wired via buildPortalNavigation). */
export type PortalNavigationRegistryEntry = {
  moduleKey: PortalModuleKey;
  label: string;
  icon: string;
  /** Base href when module is primary but feature-level nav is not expanded. */
  overviewHref: string;
  /** Reserved feature keys — resolved at runtime via portal_feature_matrix. */
  featureKeys: string[];
  implemented: boolean;
};

export const PORTAL_NAVIGATION_REGISTRY: PortalNavigationRegistryEntry[] = [
  {
    moduleKey: 'assist',
    label: PORTAL_MODULE_LABELS.assist,
    icon: PORTAL_MODULE_ICONS.assist,
    overviewHref: '/portal/client?module=assist',
    featureKeys: [
      'appointments',
      'betreuung',
      'trips',
      'budget',
      'nachweise',
      'aktivitaeten',
      'anfragen',
      'hilfe',
    ],
    implemented: true,
  },
  {
    moduleKey: 'pflege',
    label: PORTAL_MODULE_LABELS.pflege,
    icon: PORTAL_MODULE_ICONS.pflege,
    overviewHref: '/portal/client?module=pflege',
    featureKeys: ['appointments', 'care_plan', 'vitals', 'medications'],
    implemented: false,
  },
  {
    moduleKey: 'stationaer',
    label: PORTAL_MODULE_LABELS.stationaer,
    icon: PORTAL_MODULE_ICONS.stationaer,
    overviewHref: '/portal/client?module=stationaer',
    featureKeys: ['appointments', 'meals', 'activities', 'room'],
    implemented: false,
  },
  {
    moduleKey: 'beratung',
    label: PORTAL_MODULE_LABELS.beratung,
    icon: PORTAL_MODULE_ICONS.beratung,
    overviewHref: '/portal/client?module=beratung',
    featureKeys: ['consultations', 'cases', 'follow_ups'],
    implemented: false,
  },
];

export function getPortalNavigationRegistryEntry(
  moduleKey: PortalModuleKey,
): PortalNavigationRegistryEntry | undefined {
  return PORTAL_NAVIGATION_REGISTRY.find((entry) => entry.moduleKey === moduleKey);
}

export function isPortalModuleNavImplemented(moduleKey: PortalModuleKey): boolean {
  return getPortalNavigationRegistryEntry(moduleKey)?.implemented ?? false;
}

/** Fallback module tab when registry module is not yet feature-expanded. */
export function moduleOverviewNavItem(moduleKey: PortalModuleKey): PortalNavItem {
  const entry = getPortalNavigationRegistryEntry(moduleKey);
  return {
    key: `module-${moduleKey}`,
    label: entry?.label ?? moduleKey,
    icon: entry?.icon ?? '✨',
    href: entry?.overviewHref ?? `/portal/client?module=${moduleKey}`,
    moduleKey,
    navGroup: 'module',
  };
}
