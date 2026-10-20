import { usePathname } from 'expo-router';
import { isPortalRoutePath } from '@/lib/navigation/isPortalRoute';

/** True when the active route is a portal screen (`/portal/...`). */
export function useIsPortalRoute(): boolean {
  const pathname = usePathname();
  return isPortalRoutePath(pathname);
}
