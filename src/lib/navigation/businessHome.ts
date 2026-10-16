import { Platform } from 'react-native';

/** Keep the signed-in desktop distinct from the public start and login choice. */
export const WEB_DESKTOP_ROUTE = '/Desktop';
export const BUSINESS_HOME_ROUTE = Platform.OS === 'web' ? WEB_DESKTOP_ROUTE : '/business';

export function isLegacyBusinessHomePath(pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '').toLowerCase();
  return path === '/business' || path === '/business/dashboard' || path === '/zentrale';
}
