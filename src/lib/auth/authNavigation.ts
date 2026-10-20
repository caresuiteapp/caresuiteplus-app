import type { Href } from 'expo-router';
import { BUSINESS_HOME_ROUTE } from '@/lib/navigation/businessHome';
import type { AuthLoginType } from './auth.types';
import { resolvePostLoginRoute } from './loginRouter';

/** Canonical home for the current platform. */
export const BUSINESS_DASHBOARD_ROUTE = BUSINESS_HOME_ROUTE as Href;

export function resolveBusinessDashboardRoute(): Href {
  return BUSINESS_DASHBOARD_ROUTE;
}

export function resolveLoginDashboardRoute(loginType: AuthLoginType): Href {
  if (loginType === 'business') {
    return resolveBusinessDashboardRoute();
  }
  return resolvePostLoginRoute(loginType);
}
