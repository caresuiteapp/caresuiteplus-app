import { useEffect, useState, type PropsWithChildren } from 'react';
import { usePathname, useRootNavigationState, useRouter, useGlobalSearchParams } from 'expo-router';
import { useHydrated } from '@/hooks/useHydrated.web';
import { useAuth } from '@/lib/auth/context';
import { currentWebPath, recordWebPage } from '@/lib/navigation/webNavigationHistory';
import { rememberWebLoginReturn } from '@/lib/navigation/webLoginReturn';
import { getWebDocumentStartup } from '@/lib/navigation/webDocumentStartup';
import { webNavigationScope } from '@/hooks/useWebBackNavigation.web';
import { checkRoleAccess } from '@/lib/navigation/redirects';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';

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
  const auth = useAuth();
  const { authReady, isAuthenticated } = auth;
  const router = useRouter();
  const navigation = useRootNavigationState();
  const params = JSON.stringify(useGlobalSearchParams());
  const startup = getWebDocumentStartup();
  const scope = webNavigationScope(auth);
  const role = resolveEffectiveRoleKey(auth.profile, auth.user, auth.portalSession);
  const pathname = usePathname().replace(/\/+$/, '') || '/';
  const [mounted, setMounted] = useState(false);
  const ready = hydrated && (authReady || PUBLIC_STARTUP_PATHS.has(pathname));
  useEffect(() => {
    if (ready) setMounted(true);
  }, [ready]);
  useEffect(() => {
    if (!mounted || !authReady || !navigation?.key || startup.settled) return;
    // Let descendant navigators and Expo's parent history effect commit first.
    // Checking the address synchronously can consume the entry before it is lost.
    const timer = setTimeout(() => {
      if (!startup.settle()) return;
      const { entryPath } = startup;
      if (!entryPath) return;
      if (isAuthenticated && role && checkRoleAccess(entryPath.split(/[?#]/, 1)[0], role).shouldRedirect) return;
      if (!isAuthenticated) rememberWebLoginReturn(entryPath);
      if (/^\/auth(?:\/|$)/.test(currentWebPath())) return;
      if (currentWebPath() !== entryPath) router.replace(entryPath as never);
    }, 0);
    // An explicit Back/Close wins over an outstanding initial restoration.
    const cancel = () => startup.cancel();
    window.addEventListener('popstate', cancel);
    return () => { clearTimeout(timer); window.removeEventListener('popstate', cancel); };
  }, [authReady, isAuthenticated, mounted, navigation?.key, role, router, startup]);
  useEffect(() => {
    if (!mounted || !authReady || !isAuthenticated) return;
    // Expo commits the browser history in a parent effect; observe it afterwards.
    const record = () => {
      if (!startup.settled) return;
      if (role && checkRoleAccess(currentWebPath().split(/[?#]/, 1)[0], role).shouldRedirect) return;
      recordWebPage(scope);
    };
    const timer = setTimeout(record, 0);
    window.addEventListener('popstate', record);
    return () => { clearTimeout(timer); window.removeEventListener('popstate', record); };
  }, [authReady, isAuthenticated, mounted, navigation, params, pathname, role, scope, startup]);
  return mounted || ready ? <>{children}</> : null;
}
