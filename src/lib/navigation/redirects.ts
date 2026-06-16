import type { Href } from 'expo-router';
import type { ProductKey, RoleKey } from '@/types';
import { buildWorkspaceAccessContext, checkWorkspaceAreaAccess } from '@/lib/permissions';
import { hasEffectiveModuleGateAccess } from '@/lib/modules/moduleAccessService';
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
  | 'module_coming_soon'
  | 'module_internal'
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
  options?: { tenantId?: string | null; userId?: string | null },
): RedirectDecision {
  const route = getRouteByPath(path);
  if (!route?.allowedRoles || route.allowedRoles.length === 0) {
    const workspace = checkWorkspaceAreaAccess(
      path,
      buildWorkspaceAccessContext({
        roleKey,
        tenantId: options?.tenantId ?? null,
        userId: options?.userId ?? null,
      }),
    );
    if (!workspace.allowed) {
      return {
        shouldRedirect: true,
        target: '/' as Href,
        reason: 'wrong_role',
        message: workspace.message,
      };
    }
    return { shouldRedirect: false, target: path as Href };
  }
  if (!roleKey || !route.allowedRoles.includes(roleKey)) {
    return {
      shouldRedirect: true,
      target: '/' as Href,
      reason: 'wrong_role',
      message: 'Sie haben keine Berechtigung für diesen Bereich.',
    };
  }

  const workspace = checkWorkspaceAreaAccess(
    path,
    buildWorkspaceAccessContext({
      roleKey,
      tenantId: options?.tenantId ?? null,
      userId: options?.userId ?? null,
    }),
  );
  if (!workspace.allowed) {
    return {
      shouldRedirect: true,
      target: '/' as Href,
      reason: 'wrong_role',
      message: workspace.message,
    };
  }

  return { shouldRedirect: false, target: path as Href };
}

export function checkModuleAccess(
  path: string,
  roleKey?: RoleKey | null,
  tenantId?: string | null,
): RedirectDecision {
  const scopeKey = resolveModuleScopeFromPath(path);
  if (!scopeKey) {
    return { shouldRedirect: false, target: path as Href };
  }

  const navState = resolveModuleNavState(scopeKey, { tenantId, roleKey });
  const entryLabel = navState.blockReason?.split(' ist')[0] ?? scopeKey;

  if (!navState.isVisible || navState.effectiveStatus === 'disabled') {
    const reason =
      navState.effectiveStatus === 'internal' ? 'module_internal' : 'module_disabled';
    return {
      shouldRedirect: true,
      target: '/business' as Href,
      reason,
      message: navState.blockReason ?? 'Dieses Modul ist derzeit nicht verfügbar.',
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

  if (navState.effectiveStatus === 'coming_soon' || !navState.isNavigable) {
    if (navState.effectiveStatus === 'coming_soon') {
      return {
        shouldRedirect: true,
        target: '/business/modules' as Href,
        reason: 'module_coming_soon',
        message:
          navState.blockReason ??
          `„${entryLabel}" ist in Vorbereitung und kann noch nicht geöffnet werden.`,
      };
    }

    const route = getRouteByPath(path);
    if (route?.productKey && !navState.isTenantActive) {
      return {
        shouldRedirect: true,
        target: '/business/modules' as Href,
        reason: 'module_inactive',
        message: `Das Modul „${route.label}" ist für Ihren Mandanten nicht aktiv.`,
      };
    }
  }

  return { shouldRedirect: false, target: path as Href };
}

export function checkProductAccess(
  path: string,
  roleKey?: RoleKey | null,
  tenantId?: string | null,
): RedirectDecision {
  return checkModuleAccess(path, roleKey, tenantId);
}
