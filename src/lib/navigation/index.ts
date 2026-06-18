export {
  APP_ROUTES,
  getRouteByPath,
  getModuleRoutes,
  getLoginRouteForGroup,
} from './routes';
export {
  getModuleExtensionLinks,
  getModuleExtensionPaths,
  MODULE_EXTENSION_LINKS,
} from './moduleExtensionNav';
export {
  getBreadcrumbs,
  formatBreadcrumbTrail,
} from './breadcrumbs';
export {
  BUSINESS_TABS,
  OFFICE_TABS,
  PORTAL_CLIENT_TABS,
  PORTAL_EMPLOYEE_TABS,
  getModuleSwitcherItems,
  getTabsForArea,
  resolveActiveTabKey,
} from './shellConfig';
export {
  getPostLoginRedirect,
  getLoginRedirectForPath,
  isProductActive,
  checkRoleAccess,
  checkProductAccess,
} from './redirects';
export type { RedirectDecision, RedirectReason } from './redirects';
export {
  EINZELSEITEN_ROUTE_MAP,
  getEinzelseitenEntry,
  resolveEinzelseitenRoute,
} from './einzelseitenRouteMap';
export type { EinzelseitenRouteEntry } from './einzelseitenRouteMap';
export {
  DEMO_BUSINESS_ENTRY_ROUTE,
  DEMO_SHELL_TAB_GROUPS,
  FORBIDDEN_LEGACY_NAV_ROUTES,
  collectDemoTabHrefs,
} from './demoNavigation';
