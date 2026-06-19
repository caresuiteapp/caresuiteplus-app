import type { Href } from 'expo-router';
import type { AuthLoginType } from './auth.types';
import { resolvePostLoginRoute } from './loginRouter';

/** Canonical business dashboard entry — matches app/business/(tabs)/index. */
export const BUSINESS_DASHBOARD_ROUTE = '/business' as Href;

export function resolveBusinessDashboardRoute(): Href {
  return BUSINESS_DASHBOARD_ROUTE;
}

export function resolveLoginDashboardRoute(loginType: AuthLoginType): Href {
  if (loginType === 'business') {
    return resolveBusinessDashboardRoute();
  }
  return resolvePostLoginRoute(loginType);
}
