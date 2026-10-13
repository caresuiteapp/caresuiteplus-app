import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { usePathname, useRootNavigationState, useRouter, useGlobalSearchParams } from 'expo-router';
import { useHydrated } from '@/hooks/useHydrated.web';
import { useAuth } from '@/lib/auth/context';
import { currentWebPath, recordWebPage } from '@/lib/navigation/webNavigationHistory';
import { rememberWebLoginReturn, safeWebReturnPath } from '@/lib/navigation/webLoginReturn';
import { webNavigationScope } from '@/hooks/useWebBackNavigation.web';
import { checkRoleAccess } from '@/lib/navigation/redirects';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';

const PUBLIC_STARTUP_PATHS = new Set([
  '/auth/forgot-password', '/auth/reset-password', '/auth/recovery-bridge',
  '/support', '/impressum', '/datenschutz', '/nutzungsbedingungen', '/agb',
]);
const documentEntryPath = typeof window === 'undefined' ? null : safeWebReturnPath(currentWebPath());

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
  // Capture before deferred nested navigators can rewrite the browser address.
  const [entryPath] = useState(() => documentEntryPath ?? (typeof window === 'undefined' ? null : safeWebReturnPath(currentWebPath())));
  const restored = useRef(false);
  const scope = webNavigationScope(auth);
  const role = resolveEffectiveRoleKey(auth.profile, auth.user, auth.portalSession);
  const pathname = usePathname().replace(/\/+$/, '') || '/';
  const [mounted, setMounted] = useState(false);
  const ready = hydrated && (authReady || PUBLIC_STARTUP_PATHS.has(pathname));
  useEffect(() => {
    if (ready) setMounted(true);
  }, [ready]);
  useEffect(() => {
    if (!mounted || !authReady || !navigation?.key || restored.current) return;
    restored.current = true;
    if (!entryPath) return;
    if (isAuthenticated && role && checkRoleAccess(entryPath.split(/[?#]/, 1)[0], role).shouldRedirect) return;
    if (!isAuthenticated) rememberWebLoginReturn(entryPath);
    // A completed auth/role redirect remains authoritative.
    if (/^\/auth(?:\/|$)/.test(currentWebPath())) return;
    if (currentWebPath() !== entryPath) router.replace(entryPath as never);
  }, [authReady, entryPath, isAuthenticated, mounted, navigation?.key, role, router]);
  useEffect(() => {
    if (!mounted || !authReady || !isAuthenticated || !restored.current) return;
    // Expo commits the browser history in a parent effect; observe it afterwards.
    const record = () => {
      if (role && checkRoleAccess(currentWebPath().split(/[?#]/, 1)[0], role).shouldRedirect) return;
      recordWebPage(scope);
    };
    const timer = setTimeout(record, 0);
    window.addEventListener('popstate', record);
    return () => { clearTimeout(timer); window.removeEventListener('popstate', record); };
  }, [authReady, isAuthenticated, mounted, navigation, params, pathname, role, scope]);
  return mounted || ready ? <>{children}</> : null;
}
