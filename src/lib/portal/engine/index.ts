export { PORTAL_MODULE_KEYS, PORTAL_MODULE_LABELS, PORTAL_MODULE_ICONS, PORTAL_MODULE_PRIORITY, isPortalModuleKey, sortPortalModules, filterPortalModuleKeys } from './portalModuleKeys';
export { PORTAL_FEATURE_MATRIX, getFeaturesForModules, getFeatureLabel } from './portalFeatureMatrix';
export { PORTAL_WIDGET_REGISTRY, getWidgetsForModules, compareWidgetOrder } from './portalWidgetRegistry';
export { resolvePortalTerminology, resolveModuleTerminology, resolveCombinedModuleLabel } from './portalTerminology';
export { filterVisibleFeatures, isFeatureVisible, resolvePortalActorRole } from './portalVisibility';
export { buildPortalNavigation, portalNavToShellTabs } from './buildPortalNavigation';
export { buildPortalDashboard } from './buildPortalDashboard';
export { resolvePortalContext, resolvePortalContextFromData } from './resolvePortalContext';
export type { ResolvePortalContextInput } from './resolvePortalContext';
