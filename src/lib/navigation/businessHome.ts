import { Platform } from 'react-native';

/** Web has one central desktop; native keeps its existing dashboard route. */
export const BUSINESS_HOME_ROUTE = Platform.OS === 'web' ? '/' : '/business';

export function isLegacyBusinessHomePath(pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '').toLowerCase();
  return path === '/business' || path === '/business/dashboard' || path === '/zentrale';
}
