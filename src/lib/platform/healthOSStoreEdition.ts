import type { LiquidModuleDefinition } from '@/liquid-command/types';

type StoreEditionShortcut = {
  id: string;
};

export const HEALTH_OS_CORE_EDITION = 'healthos-core';

/**
 * Dedicated Google Play edition requested for the CareSuite HealthOS app.
 *
 * The default remains the complete product so web and existing deployments do
 * not silently lose modules. Expo replaces this public variable at build time.
 */
export const isHealthOSCoreEdition =
  process.env.EXPO_PUBLIC_APP_EDITION === HEALTH_OS_CORE_EDITION;

const CORE_MODULE_KEYS = new Set(['home', 'office', 'assist', 'settings']);
const CORE_SHORTCUT_IDS = new Set([
  'today',
  'assignments',
  'clients',
  'messages',
  'payroll',
  'timekeeping',
  'documents',
  'portals',
  'profile',
]);

export function getEditionModules(
  modules: readonly LiquidModuleDefinition[],
): readonly LiquidModuleDefinition[] {
  if (!isHealthOSCoreEdition) return modules;
  return modules.filter((module) => CORE_MODULE_KEYS.has(module.key));
}

export function getEditionShortcuts<T extends StoreEditionShortcut>(
  shortcuts: readonly T[],
): readonly T[] {
  if (!isHealthOSCoreEdition) return shortcuts;
  return shortcuts.filter((shortcut) => CORE_SHORTCUT_IDS.has(shortcut.id));
}

const CORE_EXACT_ROUTES = new Set([
  '/',
  '/business',
  '/business/dashboard',
  '/business/documents',
  '/business/qm',
  '/business/settings',
]);

const CORE_ROUTE_ROOTS = [
  '/auth',
  '/onboarding',
  '/office',
  '/assist',
  '/settings',
  '/portal/employee',
  '/portal/client',
  '/business/office',
  '/business/messages',
  '/business/connect',
  '/business/integrations',
  '/business/security',
  '/business/templates',
  '/communication',
  '/insight',
] as const;

function normalizePathname(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  return path || '/';
}

/**
 * Route allow-list for the core store binary. Excluded product areas are not
 * reachable via navigation, command search, deep links or stale saved links.
 */
export function isRouteAvailableInHealthOSCore(pathname: string): boolean {
  if (!isHealthOSCoreEdition) return true;
  const normalized = normalizePathname(pathname);
  if (CORE_EXACT_ROUTES.has(normalized)) return true;
  return CORE_ROUTE_ROOTS.some(
    (root) => normalized === root || normalized.startsWith(`${root}/`),
  );
}
