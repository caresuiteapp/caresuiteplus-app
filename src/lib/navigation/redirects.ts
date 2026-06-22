import type { Href } from 'expo-router';
import type { ProductKey, RoleKey } from '@/types';
import { hasEffectiveModuleGateAccess } from '@/lib/modules/moduleAccessService';
import { isProductScopeKey } from '@/lib/modules/moduleVisibilityConfig';
import {
  resolveModuleNavState,
  resolveModuleScopeFromPath,
} from '@/lib/modules/moduleVisibilityService';
import { getRouteByPath } from './routes';
import { DEMO_BUSINESS_ENTRY_ROUTE } from './demoNavigation';

export type RedirectReason =
  | 'unauthenticated'
  | 'wrong_role'
  | 'module_inactive'
  | 'module_disabled'
  | 'module_internal'
  | 'module_coming_soon'
  | 'unknown_route';

export type RedirectDecision = {
  shouldRedirect: boolean;
  target: Href;
  reason?: RedirectReason;
  message?: string;
};

export function getPostLoginRedirect(roleKey: RoleKey): Href {
  switch (roleKey) {
    case 'employee_portal':
    case 'caregiver':
    case 'nurse':
      return '/portal/employee' as Href;
    case 'client_portal':
    case 'family_portal':
      return '/portal/client' as Href;
    default:
      return DEMO_BUSINESS_ENTRY_ROUTE as Href;
  }
}

export function getLoginRedirectForPath(path: string): string {
  if (path.startsWith('/portal/client')) return '/auth/client-login';
  if (path.startsWith('/portal/employee')) return '/auth/employee-login';
  if (path.startsWith('/portal')) return '/auth/employee-login';
  if (
    path.startsWith('/business') ||
    path.startsWith('/office') ||
    path.startsWith('/assist') ||
    path.startsWith('/pflege') ||
    path.startsWith('/stationaer') ||
    path.startsWith('/beratung') ||
    path.startsWith('/akademie') ||
    path.startsWith('/insight')
  ) {
    return '/auth/business-login';
  }
  return '/auth/business-login';
}

export function isProductActive(
  productKey: ProductKey,
  tenantId: string | null | undefined,
): boolean {
  if (!tenantId?.trim()) return false;
  return hasEffectiveModuleGateAccess(productKey, tenantId);
}

export function checkRoleAccess(
  path: string,
  roleKey: RoleKey | null,
): RedirectDecision {
  const route = getRouteByPath(path);
  if (!route?.allowedRoles || route.allowedRoles.length === 0) {
    return { shouldRedirect: false, target: path as Href };
  }
  if (!roleKey || !route.allowedRoles.includes(roleKey)) {
    return {
      shouldRedirect: true,
      target: roleKey
        ? getPostLoginRedirect(roleKey)
        : (getLoginRedirectForPath(path) as Href),
      reason: 'wrong_role',
      message: 'Sie haben keine Berechtigung für diesen Bereich.',
    };
  }
  return { shouldRedirect: false, target: path as Href };
}

export function checkModuleAccess(
  path: string,
  roleKey?: RoleKey | null,
  tenantId?: string | null,
): RedirectDecision {
  const roleDecision = checkRoleAccess(path, roleKey);
  if (roleDecision.shouldRedirect) return roleDecision;

  const scopeKey = resolveModuleScopeFromPath(path);
  if (!scopeKey) {
    return { shouldRedirect: false, target: path as Href };
  }

  const navState = resolveModuleNavState(scopeKey, { tenantId, roleKey });

  if (navState.effectiveStatus === 'disabled') {
    return {
      shouldRedirect: true,
      target: '/business' as Href,
      reason: 'module_disabled',
      message: navState.blockReason ?? 'Dieses Modul ist derzeit nicht verfügbar.',
    };
  }

  if (navState.effectiveStatus === 'coming_soon') {
    return {
      shouldRedirect: true,
      target: '/business' as Href,
      reason: 'module_coming_soon',
      message: navState.blockReason ?? 'Dieses Modul ist in Vorbereitung.',
    };
  }

  if (navState.effectiveStatus === 'internal' && !navState.isNavigable) {
    return {
      shouldRedirect: true,
      target: '/business' as Href,
      reason: 'module_internal',
      message: navState.blockReason ?? 'Dieser Bereich ist nur für Administratoren verfügbar.',
    };
  }

  if (isProductScopeKey(scopeKey) && !navState.isNavigable) {
    return {
      shouldRedirect: true,
      target: '/business/modules' as Href,
      reason: 'module_inactive',
      message: navState.blockReason ?? 'Das Modul ist für Ihren Mandanten nicht aktiv.',
    };
  }

  return { shouldRedirect: false, target: path as Href };
}

export function checkProductAccess(
  path: string,
  roleKey?: RoleKey | null,
  tenantId?: string | null,
): RedirectDecision {
  const route = getRouteByPath(path);
  if (!route?.productKey) {
    return { shouldRedirect: false, target: path as Href };
  }
  if (!isProductActive(route.productKey, tenantId)) {
    const canBypassInactive =
      roleKey === 'business_admin' || roleKey === 'business_manager';
    if (canBypassInactive) {
      return { shouldRedirect: false, target: path as Href };
    }
    return {
      shouldRedirect: true,
      target: '/business/modules' as Href,
      reason: 'module_inactive',
      message: `Das Modul „${route.label}" ist für Ihren Mandanten nicht aktiv.`,
    };
  }
  return { shouldRedirect: false, target: path as Href };
}
