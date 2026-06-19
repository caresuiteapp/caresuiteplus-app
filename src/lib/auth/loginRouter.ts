import type { Href } from 'expo-router';
import type { AuthLoginType } from './auth.types';

export function resolveLoginRoute(loginType: AuthLoginType): Href {
  switch (loginType) {
    case 'business':
      return '/auth/business-login' as Href;
    case 'employee_portal':
      return '/auth/employee-login' as Href;
    case 'client_portal':
    case 'relative_portal':
      return '/auth/portal-code-login' as Href;
    default:
      return '/' as Href;
  }
}

export function resolvePostLoginRoute(loginType: AuthLoginType): Href {
  switch (loginType) {
    case 'business':
      return '/business' as Href;
    case 'employee_portal':
      return '/portal/employee' as Href;
    case 'client_portal':
      return '/portal/client' as Href;
    case 'relative_portal':
      return '/portal/relative' as Href;
    default:
      return '/' as Href;
  }
}

export function resolveFirstLoginRoute(loginType: AuthLoginType): Href | null {
  if (loginType === 'employee_portal') {
    return '/auth/employee-first-login' as Href;
  }
  return null;
}

export function resolveBlockedAccessMessage(): string {
  return 'Zugang gesperrt. Bitte wenden Sie sich an die Verwaltung.';
}

export function resolveInvalidPortalCodeMessage(): string {
  return 'Code ungültig oder abgelaufen.';
}

export function resolveMissingPermissionMessage(): string {
  return 'Für diesen Bereich besteht keine Berechtigung.';
}

export function isBusinessLoginIdentifier(value: string): boolean {
  return value.includes('@') || value.includes('.');
}

const AUTH_SETUP_ROUTE_PREFIXES = ['/auth/employee-first-login', '/auth/reset-password'];

/** Authenticated users may stay on these routes (password setup, recovery). */
export function isAuthSetupRoute(pathname: string): boolean {
  const pathOnly = pathname.split('?')[0]?.split('#')[0] ?? pathname;
  const normalized = pathOnly.replace(/\/$/, '') || '/';
  return AUTH_SETUP_ROUTE_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}
