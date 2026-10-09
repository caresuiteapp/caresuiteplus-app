import { useEffect, useState, type PropsWithChildren } from 'react';
import { usePathname } from 'expo-router';
import { useHydrated } from '@/hooks/useHydrated.web';
import { useAuth } from '@/lib/auth/context';

const PUBLIC_STARTUP_PATHS = new Set([
  '/auth/forgot-password', '/auth/reset-password', '/auth/recovery-bridge',
  '/support', '/impressum', '/datenschutz', '/nutzungsbedingungen', '/agb',
]);

/**
 * Authenticated routes cannot be prerendered for a particular user. A shared
 * HTML fallback may also be served for a deep link. Keep the first tree
 * identical for every URL. On initial protected navigation, restore identity
 * before mounting the nested navigators. Mounting them behind pending guards
 * discards the initial deep link and briefly shows the module's index page.
 * After the first mount, auth changes are handled by the normal route guards;
 * they must not recreate the complete navigation tree.
 */
export function WebNavigationMount({ children }: PropsWithChildren) {
  const hydrated = useHydrated();
  const { authReady } = useAuth();
  const pathname = usePathname().replace(/\/+$/, '') || '/';
  const [mounted, setMounted] = useState(false);
  const ready = hydrated && (authReady || PUBLIC_STARTUP_PATHS.has(pathname));
  useEffect(() => {
    if (ready) setMounted(true);
  }, [ready]);
  return mounted || ready ? <>{children}</> : null;
}
