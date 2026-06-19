import type { Href } from 'expo-router';
import type { ProductKey, RoleKey } from '@/types';
import { hasEffectiveModuleGateAccess } from '@/lib/modules/moduleAccessService';
import { getRouteByPath } from './routes';
import { DEMO_BUSINESS_ENTRY_ROUTE } from './demoNavigation';

export type RedirectReason =
  | 'unauthenticated'
  | 'wrong_role'
  | 'module_inactive'
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
